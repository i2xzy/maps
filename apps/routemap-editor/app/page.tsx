"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  HStack,
  Input,
  Portal,
  Select,
  Splitter,
  createListCollection,
} from "@chakra-ui/react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { formatJson } from "./format-json";
import { Inspector } from "./inspector";
import {
  RouteMap,
  collectRintCodes,
  collectRwsArgs,
  createLogoResolver,
  createRwsResolver,
  expandRint,
  expandRws,
  toWikitext,
  type RouteDiagram,
  type Selection,
} from "@repo/routemap";
import { rintCatalogSeed } from "@repo/routemap/rint-catalog";

const STORAGE_KEY = "routemap-editor:config"; // legacy single-config (migrated in)
const DIAGRAMS_KEY = "routemap-editor:diagrams"; // saved diagrams list
const ACTIVE_KEY = "routemap-editor:active"; // active diagram id
const SIZE_KEY = "routemap-editor:size"; // outer: editor | right
const RIGHT_SIZE_KEY = "routemap-editor:right-size"; // inner: preview / wiki
const DEFAULT_SIZE = [40, 60]; // JSON editor | (preview + wiki)
const DEFAULT_RIGHT_SIZE = [55, 45]; // preview (top) / wiki code (bottom)

interface Diagram {
  id: string;
  name: string;
  text: string;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `d${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

const SAMPLE = `{
  "rows": [
    { "left": { "text": ["to ", { "rws": "Liverpool|Lime Street" }, " & ", { "rws": "Edinburgh|Waverley" }], "italic": true }, "cells": ["STR"] },
    { "left": "Delta Junction", "cells": ["ABZrg", "STRc3"] },
    { "cells": ["STR", "STR"] },
    { "right": "one full track…", "cells": ["STR"] },
    { "right": "…over two half (d) tracks", "cells": ["dSTR", "dSTR"] },
    { "right": "d spacer shifts to right lane", "cells": ["d", "dSTR"] },
    { "cells": ["vSTR", "exSTR"] },
    { "right": { "text": ["pedestrian walkway to", "|", { "text": "St Pancras International", "link": true, "icons": ["london|underground", "London|thameslink"] }], "italic": true }, "cells": ["BHF"] },
    { "left": "Bromford Tunnel", "cells": [{ "code": "hKRZW", "title": "bridge over water" }] },
    { "left": { "text": "Euston", "link": true, "icons": ["gb|rail", "london|underground"] }, "cells": ["KBHFe"] },
    { "type": "colspan", "text": ["interchange with ", { "text": "National Rail", "link": true }, " at all stations"], "icons": ["gb|rail"] }
  ]
}`;

// Initial state (SSR-safe: no localStorage). The mount effect replaces it from
// storage, so first paint shows the sample without a hydration mismatch.
const SEED: Diagram = { id: "seed", name: "HS2 (sample)", text: SAMPLE };

/** Catches render throws from a malformed-but-valid diagram so the editor survives. */
class PreviewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Box bg="red.subtle" color="red.fg" p="3" fontSize="sm">
          <Box fontWeight="semibold" mb="1">
            Couldn’t render this diagram
          </Box>
          <Box mb="2">
            A row or cell has an unexpected shape — often a row missing its{" "}
            <Box as="code" fontFamily="mono">
              cells
            </Box>{" "}
            array, or a field with the wrong type. Check the JSON against the last edit.
          </Box>
          <Box fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap" opacity={0.75}>
            {this.state.error.message}
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default function EditorPage() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([SEED]);
  const [activeId, setActiveId] = useState<string>(SEED.id);
  const [size, setSize] = useState<number[]>(DEFAULT_SIZE);
  const [rightSize, setRightSize] = useState<number[]>(DEFAULT_RIGHT_SIZE);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The element clicked in the preview, edited in the side Inspector. Cleared
  // when switching diagrams so a stale (row,col) can't point into the new one.
  const [selection, setSelection] = useState<Selection | null>(null);
  // Load persisted diagrams + panel sizes after mount (no SSR/hydration mismatch);
  // `hydrated` gates the saves so the initial mount can't overwrite storage.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let list: Diagram[] | null = null;
    try {
      const raw = localStorage.getItem(DIAGRAMS_KEY);
      if (raw) list = JSON.parse(raw);
    } catch {
      // ignore malformed store
    }
    if (!Array.isArray(list) || list.length === 0) {
      // First run: migrate the legacy single config if present, else seed sample.
      const legacy = localStorage.getItem(STORAGE_KEY);
      list = [legacy ? { id: newId(), name: "My diagram", text: legacy } : SEED];
    }
    setDiagrams(list);
    const savedActive = localStorage.getItem(ACTIVE_KEY);
    setActiveId(savedActive && list.some((d) => d.id === savedActive) ? savedActive : list[0]!.id);

    const loadSize = (key: string, set: (s: number[]) => void) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (Array.isArray(s) && s.length === 2) set(s);
      } catch {
        // ignore malformed stored size
      }
    };
    loadSize(SIZE_KEY, setSize);
    loadSize(RIGHT_SIZE_KEY, setRightSize);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(diagrams));
  }, [diagrams, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId, hydrated]);

  // Switching diagrams: drop any selection (its indices belong to the old one).
  useEffect(() => {
    setSelection(null);
  }, [activeId]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  }, [size, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(RIGHT_SIZE_KEY, JSON.stringify(rightSize));
  }, [rightSize, hydrated]);

  // The active diagram's text is the editor buffer; edits update it in the list.
  const text = diagrams.find((d) => d.id === activeId)?.text ?? "";
  const setText = (t: string) =>
    setDiagrams((ds) => ds.map((d) => (d.id === activeId ? { ...d, text: t } : d)));

  const activeName = diagrams.find((d) => d.id === activeId)?.name ?? "";
  const collection = useMemo(
    () => createListCollection({ items: diagrams.map((d) => ({ label: d.name, value: d.id })) }),
    [diagrams],
  );

  const newDiagram = () => {
    const id = newId();
    setDiagrams((ds) => [...ds, { id, name: `Diagram ${ds.length + 1}`, text: SAMPLE }]);
    setActiveId(id);
  };
  const openRename = () => {
    setRenameValue(activeName);
    setRenameOpen(true);
  };
  const confirmRename = () => {
    const name = renameValue.trim();
    if (name) setDiagrams((ds) => ds.map((d) => (d.id === activeId ? { ...d, name } : d)));
    setRenameOpen(false);
  };
  const confirmDelete = () => {
    const next = diagrams.filter((d) => d.id !== activeId);
    setDiagrams(next);
    setActiveId(next[0]!.id);
    setDeleteOpen(false);
  };

  const parsed = useMemo<{ diagram: RouteDiagram | null; error: string | null }>(() => {
    try {
      return { diagram: JSON.parse(text) as RouteDiagram, error: null };
    } catch (e) {
      return { diagram: null, error: (e as Error).message };
    }
  }, [text]);

  // Resolve {{rint}} logos ({ region, name }) to files via the wiki API, live, so
  // labels stay in sync with wiki. Cached in the package; merged as they resolve.
  const [rintFiles, setRintFiles] = useState<Awaited<ReturnType<typeof expandRint>>>({});
  useEffect(() => {
    if (!parsed.diagram) return;
    const codes = collectRintCodes(parsed.diagram);
    if (codes.length === 0) return;
    let cancelled = false;
    expandRint(codes).then((m) => {
      if (!cancelled) setRintFiles((prev) => ({ ...prev, ...m }));
    });
    return () => {
      cancelled = true;
    };
  }, [parsed.diagram]);
  // Seed from the catalog snapshot so a logo you just picked draws immediately
  // instead of blinking in a round-trip later; the live API result then wins,
  // which is what keeps a stale snapshot from being authoritative.
  const rintSeed = useMemo(
    () => (parsed.diagram ? rintCatalogSeed(collectRintCodes(parsed.diagram)) : {}),
    [parsed.diagram],
  );
  const resolveLogo = useMemo(
    () => createLogoResolver({ ...rintSeed, ...rintFiles }),
    [rintSeed, rintFiles],
  );

  // Resolve {{rws}} station links ({ rws: "args" }) via the wiki API, live.
  const [rwsMap, setRwsMap] = useState<Awaited<ReturnType<typeof expandRws>>>({});
  useEffect(() => {
    if (!parsed.diagram) return;
    const args = collectRwsArgs(parsed.diagram);
    if (args.length === 0) return;
    let cancelled = false;
    expandRws(args).then((m) => {
      if (!cancelled) setRwsMap((prev) => ({ ...prev, ...m }));
    });
    return () => {
      cancelled = true;
    };
  }, [parsed.diagram]);
  const resolveRws = useMemo(() => createRwsResolver(rwsMap), [rwsMap]);
  // Editor: link references resolve to Wikipedia articles. (The HS2 app would map
  // the same references to its own internal urls instead.)
  const resolveHref = (ref: string) =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(ref.replace(/ /g, "_"))}`;

  // Serialized {{Routemap}} wiki source (read-only output). Guarded like `parsed`
  // and the preview boundary, so a transient/partial diagram can't crash the page.
  const wikitext = useMemo(() => {
    try {
      return parsed.diagram ? toWikitext(parsed.diagram) : "";
    } catch {
      return "";
    }
  }, [parsed.diagram]);

  // JSON syntax highlighting + inline parse-error markers (gutter + squiggles).
  const extensions = useMemo(() => [json(), lintGutter(), linter(jsonParseLinter())], []);

  // Wrap the formatted JSON to the editor pane's current width (chars that fit
  // before horizontal scroll), so it reflows when you drag the splitter.
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const paneMaxWidth = (): number => {
    const view = cmRef.current?.view;
    if (!view) return 80;
    // Real char width: CodeMirror's defaultCharacterWidth under-reports, so
    // measure the editor's actual font with canvas (monospace = uniform width).
    const cs = getComputedStyle(view.contentDOM);
    const font = cs.font && cs.font.length ? cs.font : `${cs.fontSize} ${cs.fontFamily}`;
    const ctx = document.createElement("canvas").getContext("2d");
    let charW = view.defaultCharacterWidth;
    if (ctx) {
      ctx.font = font;
      charW = ctx.measureText("0".repeat(20)).width / 20 || charW;
    }
    // Visible viewport minus the gutter (contentDOM grows to the widest line).
    const gutter = view.dom.querySelector(".cm-gutters");
    const gutterW = gutter ? gutter.getBoundingClientRect().width : 0;
    const usable = view.scrollDOM.clientWidth - gutterW - 10; // margin for the trailing comma
    return Math.max(40, Math.floor(usable / charW));
  };
  const format = () => {
    try {
      setText(formatJson(JSON.parse(text), 2, paneMaxWidth()));
    } catch {
      // invalid JSON: nothing to format
    }
  };

  return (
    <>
      <Splitter.Root
      height="100dvh"
      width="100%"
      panels={[
        { id: "editor", minSize: 15 },
        { id: "right", minSize: 20 },
      ]}
      size={size}
      onResize={(details) => setSize(details.size)}
    >
      <Splitter.Panel id="editor" p="0" height="100%">
        <Flex direction="column" height="100%" minW="0" width="100%">
          <Flex align="center" justify="space-between" gap="2" px="3" py="2" borderBottomWidth="1px" borderColor="border">
            <HStack gap="2" minW="0">
              <Select.Root
                collection={collection}
                value={[activeId]}
                onValueChange={(e) => setActiveId(e.value[0] ?? activeId)}
                size="xs"
                width="200px"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Diagram" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {collection.items.map((item) => (
                        <Select.Item item={item} key={item.value}>
                          <Select.ItemText>{item.label}</Select.ItemText>
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
              <Button size="xs" colorPalette="blue" onClick={newDiagram}>
                New
              </Button>
            </HStack>
            <HStack gap="2">
              <Button size="xs" variant="outline" onClick={openRename}>
                Rename
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                disabled={diagrams.length <= 1}
              >
                Delete
              </Button>
              <Button size="xs" variant="outline" onClick={format} disabled={parsed.error != null}>
                Format
              </Button>
            </HStack>
          </Flex>
          <Box flex="1" minH="0" overflow="hidden">
            <CodeMirror
              ref={cmRef}
              value={text}
              onChange={setText}
              extensions={extensions}
              height="100%"
              style={{ height: "100%", fontSize: 13 }}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
            />
          </Box>
        </Flex>
      </Splitter.Panel>

      <Splitter.ResizeTrigger id="editor:right" />

      <Splitter.Panel id="right" p="0" height="100%">
        <Splitter.Root
          orientation="vertical"
          height="100%"
          width="100%"
          panels={[
            { id: "preview", minSize: 15 },
            { id: "wiki", minSize: 15 },
          ]}
          size={rightSize}
          onResize={(details) => setRightSize(details.size)}
        >
          <Splitter.Panel id="preview" p="0" width="100%">
            <Flex height="100%" width="100%" minW="0">
              {/* Inner scroll container: the Splitter.Panel itself clips (overflow
                  hidden), so scroll here when the diagram is taller/wider than the
                  pane. A background click clears the selection; cell/label clicks
                  stopPropagation so they don't bubble here. */}
              <Box flex="1" minW="0" height="100%" overflow="auto" p="6" onClick={() => setSelection(null)}>
                {parsed.diagram ? (
                  <PreviewBoundary key={text}>
                    <RouteMap
                      diagram={parsed.diagram}
                      resolveLogo={resolveLogo}
                      resolveHref={resolveHref}
                      resolveRws={resolveRws}
                      selection={selection}
                      onSelect={setSelection}
                    />
                  </PreviewBoundary>
                ) : null}
              </Box>
              <Box
                width="360px"
                flexShrink="0"
                height="100%"
                overflow="auto"
                borderLeftWidth="1px"
                borderColor="border"
                bg="bg.subtle"
              >
                {parsed.diagram ? (
                  <Inspector
                    diagram={parsed.diagram}
                    selection={selection}
                    onChange={(d) => setText(formatJson(d, 2, paneMaxWidth()))}
                    onSelect={setSelection}
                    resolveRws={resolveRws}
                    resolveLogo={resolveLogo}
                  />
                ) : (
                  <Box p="4" fontSize="sm" color="fg.muted">
                    Fix the JSON to edit visually.
                  </Box>
                )}
              </Box>
            </Flex>
          </Splitter.Panel>

          <Splitter.ResizeTrigger id="preview:wiki" />

          <Splitter.Panel id="wiki" p="0" width="100%">
            <Flex direction="column" height="100%" minW="0" width="100%">
              <Flex align="center" justify="space-between" px="3" py="2" borderBottomWidth="1px" borderColor="border">
                <Heading size="sm">Wiki code (read-only)</Heading>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigator.clipboard?.writeText(wikitext)}
                  disabled={!wikitext}
                >
                  Copy
                </Button>
              </Flex>
              <Box
                flex="1"
                minH="0"
                overflow="auto"
                p="3"
                fontFamily="mono"
                fontSize="xs"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
              >
                {wikitext}
              </Box>
            </Flex>
          </Splitter.Panel>
        </Splitter.Root>
      </Splitter.Panel>
      </Splitter.Root>

      <Dialog.Root open={renameOpen} onOpenChange={(e) => setRenameOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Rename diagram</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                  }}
                />
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setRenameOpen(false)}>
                  Cancel
                </Button>
                <Button colorPalette="blue" onClick={confirmRename} disabled={!renameValue.trim()}>
                  Save
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={(e) => setDeleteOpen(e.open)} role="alertdialog">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete diagram</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                Delete “{activeName}”? This can&apos;t be undone.
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button colorPalette="red" onClick={confirmDelete}>
                  Delete
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
