"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, useEditorState, type Editor } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { Button, HStack, IconButton, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { LuLink2, LuLink2Off, LuTrainFront } from "react-icons/lu";
import { Control, RichTextEditor } from "@ui/components/rich-text-editor";
import type { SideLabel } from "@repo/routemap";
import { docToLabel, labelToDoc } from "./label-doc";
import { RwsNode, RwsResolverProvider, type RwsResolver } from "./rws-node";
import { RintNode, LogoResolverProvider, type LogoResolver } from "./rint-node";
import { RintPickerPopover } from "./rint-picker";

// Labels only take the wiki's bold/italic + links; block/list nodes are turned
// off so the editor can't create structure a label can't hold. Enter = a new
// paragraph = a `|` BSsplit line (handled by the label-doc converter). Links
// don't navigate on click while editing.
const labelExtensions = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    strike: false,
    horizontalRule: false,
    link: { openOnClick: false },
  }),
  RwsNode,
  RintNode,
];

const key = (v: SideLabel | null | undefined): string => JSON.stringify(v ?? null);

/**
 * Rich-text editor for one side label's text (bold / italic / link / line breaks).
 * The parent's `value` re-derives on every keystroke (model → formatJson → parse),
 * so we only push it into the editor when it actually differs from what we last
 * emitted — otherwise setContent would fight the cursor.
 */
export function LabelRichEditor({
  value,
  onChange,
  ariaLabel,
  resolveRws,
  resolveLogo,
}: {
  value: SideLabel | null | undefined;
  onChange: (v: SideLabel | undefined) => void;
  ariaLabel?: string;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  const lastEmitted = useRef<string>(key(value));

  const editor = useEditor({
    extensions: labelExtensions,
    content: labelToDoc(value),
    immediatelyRender: false, // Next SSR: render the editor after mount
    editorProps: {
      // Click a wikilink to select its whole range (parity with clicking a
      // station chip, which selects the whole node).
      handleClick(view, pos) {
        const linkType = view.state.schema.marks.link;
        if (!linkType) return false;
        const range = getMarkRange(view.state.doc.resolve(pos), linkType);
        if (!range) return false;
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const next = docToLabel(editor.getJSON());
      lastEmitted.current = key(next);
      onChange(next);
    },
  });

  // External change (e.g. a direct JSON edit) that isn't our own last emit.
  useEffect(() => {
    if (!editor) return;
    const incoming = key(value);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      editor.commands.setContent(labelToDoc(value), { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <RwsResolverProvider value={resolveRws}>
      <LogoResolverProvider value={resolveLogo}>
        <RichTextEditor.Root
          editor={editor}
          aria-label={ariaLabel}
          css={{
            "--content-padding-x": "spacing.2",
            "--content-padding-y": "spacing.1.5",
            "--content-min-height": "sizes.8",
            fontSize: "sm",
          }}
        >
          <RichTextEditor.Toolbar variant="fixed" py="1" px="1.5">
            <RichTextEditor.ControlGroup>
              <Control.Bold />
              <Control.Italic />
              {editor && <LinkControl editor={editor} resolveRws={resolveRws} />}
              {editor && <LogoControl editor={editor} />}
            </RichTextEditor.ControlGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content />
        </RichTextEditor.Root>
      </LogoResolverProvider>
    </RwsResolverProvider>
  );
}

/**
 * Logo control: inserts a {{rint}} transit logo at the caret, chosen from the
 * grid picker. Replaces the selection, so picking while a logo node is selected
 * swaps it — the same gesture as re-picking an emoji.
 */
function LogoControl({ editor }: { editor: Editor }): ReactNode {
  return (
    <RintPickerPopover
      trigger={
        <IconButton size="2xs" variant="ghost" aria-label="Insert logo" title="Insert transit logo">
          <LuTrainFront />
        </IconButton>
      }
      onPick={(code) => editor.chain().focus().insertContent({ type: "rint", attrs: { icon: code } }).run()}
    />
  );
}

/**
 * Link control: a `LuLink2` button opening a popover that adds/edits either a
 * plain **Wikilink** (a link mark, `[[link]]`) or a **Station** ({{rws}}) node.
 * The field defaults to the current link/args, else the selected text (both a
 * wikilink and a station usually take the station name). A `LuLink2Off` button
 * appears only when the selection is a link or station, to remove it.
 */
// {{rws}} positional args: [station name (required), location/disambiguator, display text].
const RWS_FIELDS = [
  { label: "Station", placeholder: "Station name" },
  { label: "Location", placeholder: "e.g. Merseyside (optional)" },
  { label: "Display", placeholder: "Custom text (optional)" },
] as const;

const splitArgs = (s: string): string[] => {
  const parts = s ? s.split("|") : [];
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
};
// Join back, preserving positions (so a display with no location -> `name||display`)
// but trimming trailing empties (`name|location` / `name`).
const joinArgs = (a: string[]): string => {
  const parts = a.map((s) => s.trim());
  while (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  return parts.join("|");
};

function LinkControl({ editor, resolveRws }: { editor: Editor; resolveRws?: RwsResolver }): ReactNode {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "rws">("link");
  const [value, setValue] = useState(""); // wikilink target
  const [args, setArgs] = useState<string[]>(["", "", ""]); // station: [name, location, display]
  // Re-render as the selection changes. A link is "active" when the caret is in
  // link-marked text; a station is targeted only when its node is *node-selected*
  // (clicking the chip) — NOT merely when the caret borders one, so a plain text
  // selection in an rws label isn't mistaken for the station.
  const linkActive = useEditorState({ editor, selector: ({ editor }) => !!editor?.isActive("link") }) ?? false;
  const rwsSelected =
    useEditorState({
      editor,
      selector: ({ editor }) => {
        const sel = editor?.state.selection;
        return sel instanceof NodeSelection && sel.node.type.name === "rws";
      },
    }) ?? false;

  // The plain text a station shows (for converting it to text / a wikilink).
  const displayOf = (a: string) => resolveRws?.(a)?.display ?? (a ? a.replace(/\|/g, " ") : "station");
  const setArg = (i: number, v: string) => setArgs((a) => a.map((x, j) => (j === i ? v : x)));

  const apply = () => {
    const chain = editor.chain().focus();
    if (mode === "rws") {
      // Insert / replace the selection (or the selected station) with a station.
      // Requires a station name (arg 1).
      if (args[0]?.trim()) chain.insertContent({ type: "rws", attrs: { args: joinArgs(args) } }).run();
    } else {
      const v = value.trim();
      if (!v) {
        chain.extendMarkRange("link").unsetLink().run();
      } else if (rwsSelected) {
        // Convert the selected station into linked text (display + link).
        const cur = (editor.getAttributes("rws").args as string) ?? "";
        chain.insertContent({ type: "text", text: displayOf(cur), marks: [{ type: "link", attrs: { href: v } }] }).run();
      } else if (editor.state.selection.empty && !linkActive) {
        // No selection: insert the target as linked text so a link always appears.
        chain.insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href: v } }] }).run();
      } else {
        chain.extendMarkRange("link").setLink({ href: v }).run();
      }
    }
    setOpen(false);
  };

  // "Unlink": strip the link-ness but keep the text. For a link mark that's
  // unsetLink; for a station node it's a replace with its plain display text.
  const unlink = () => {
    if (rwsSelected) {
      const args = (editor.getAttributes("rws").args as string) ?? "";
      editor.chain().focus().insertContent(displayOf(args)).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
  };

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(e) => {
          if (e.open) {
            // Seed the popover: a node-selected station edits its args; otherwise
            // a wikilink (existing href, else the selected text). Also seed the
            // station arg fields from the selected text, so switching to Station
            // keeps what you had.
            const { from, to } = editor.state.selection;
            const selText = editor.state.doc.textBetween(from, to, " ");
            if (rwsSelected) {
              setMode("rws");
              setArgs(splitArgs((editor.getAttributes("rws").args as string) ?? ""));
            } else {
              const existing = editor.getAttributes("link").href as string | undefined;
              setMode("link");
              setValue(existing ?? selText);
              setArgs([selText, "", ""]); // seed the station name if they switch modes
            }
          }
          setOpen(e.open);
        }}
        positioning={{ placement: "bottom-start" }}
      >
        <Popover.Trigger asChild>
          <IconButton size="2xs" variant={linkActive || rwsSelected ? "subtle" : "ghost"} aria-label="Link" title="Link">
            <LuLink2 />
          </IconButton>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content width="auto">
              <Popover.Body p="2">
                <Stack gap="2">
                  <HStack gap="1">
                    <Button
                      size="2xs"
                      variant={mode === "link" ? "subtle" : "ghost"}
                      onClick={() => {
                        // Leaving Station: default the wikilink target to the
                        // display name (rws args make a poor page title).
                        if (mode === "rws") setValue(displayOf(joinArgs(args)));
                        setMode("link");
                      }}
                    >
                      Wikilink
                    </Button>
                    <Button
                      size="2xs"
                      variant={mode === "rws" ? "subtle" : "ghost"}
                      onClick={() => {
                        // Entering Station from a wikilink: seed the name with the target.
                        if (mode === "link" && value.trim()) setArgs([value.trim(), "", ""]);
                        setMode("rws");
                      }}
                    >
                      Station
                    </Button>
                  </HStack>
                  <Stack gap="1.5">
                    {/* Same row shape (label + width-48 input) in both modes so the
                        popover width doesn't jump when switching; Apply below. */}
                    {mode === "link" ? (
                      <HStack gap="2">
                        <Text fontSize="xs" color="fg.muted" width="14" flexShrink="0">
                          Target
                        </Text>
                        <Input
                          size="xs"
                          width="48"
                          autoFocus
                          placeholder="Page title"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") apply();
                          }}
                        />
                      </HStack>
                    ) : (
                      RWS_FIELDS.map((f, i) => (
                        <HStack key={f.label} gap="2">
                          <Text fontSize="xs" color="fg.muted" width="14" flexShrink="0">
                            {f.label}
                          </Text>
                          <Input
                            size="xs"
                            width="48"
                            autoFocus={i === 0}
                            placeholder={f.placeholder}
                            value={args[i] ?? ""}
                            onChange={(e) => setArg(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") apply();
                            }}
                          />
                        </HStack>
                      ))
                    )}
                    <Button size="xs" alignSelf="flex-end" onClick={apply}>
                      Apply
                    </Button>
                  </Stack>
                </Stack>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
      {(linkActive || rwsSelected) && (
        <IconButton size="2xs" variant="ghost" aria-label="Unlink" title="Unlink" onClick={unlink}>
          <LuLink2Off />
        </IconButton>
      )}
    </>
  );
}
