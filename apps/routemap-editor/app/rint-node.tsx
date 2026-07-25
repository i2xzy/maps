"use client";

/**
 * A TipTap inline atom node for one {{rint}} transit logo. The image is resolved at
 * render time through a `LogoResolver` from React context — the same shape
 * `RouteMap` takes — so the editor shows the real logo, and shows it the moment the
 * wiki lookup lands.
 *
 * Mirrors `rws-node.tsx`: store the wiki arguments, resolve for display. The stored
 * attribute is the whole `LabelIcon`, not just a code string, so the rarer forms
 * (`{ file }`, or a code with an explicit `size`/`alt`) survive a round-trip
 * instead of being flattened to their code.
 */
import { createContext, useContext, type ReactNode } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Box, Image } from "@chakra-ui/react";
import { iconFile, rintCode, type LabelIcon, type ResolvedLogo } from "@repo/routemap";
import { findRintCatalogEntry, rintCatalogLabel } from "@repo/routemap/rint-catalog";

/** Resolves a logo for display. A bare rint code IS a `LabelIcon`, so this is
 *  exactly the `resolveLogo` the renderer uses — no adapter needed. */
export type LogoResolver = (icon: LabelIcon) => ResolvedLogo;

const LogoResolverContext = createContext<LogoResolver | undefined>(undefined);
export const LogoResolverProvider = LogoResolverContext.Provider;

/**
 * A logo's name for display — the operator or line it stands for, e.g. "London
 * Underground". Falls back to the underlying code or file only when the catalog
 * doesn't know it, which means a hand-written diagram used something we can't name.
 */
export function iconLabel(icon: LabelIcon): string {
  const code = rintCode(icon);
  const entry = code ? findRintCatalogEntry(code) : undefined;
  return entry ? rintCatalogLabel(entry) : (code ?? iconFile(icon) ?? "");
}

function RintNodeView({ node, editor, getPos, selected }: NodeViewProps): ReactNode {
  const resolve = useContext(LogoResolverContext);
  const icon = (node.attrs.icon ?? "") as LabelIcon;
  const name = iconLabel(icon);
  const url = name ? resolve?.(icon)?.url : undefined;

  const select = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos != null) editor.commands.setNodeSelection(pos);
  };

  return (
    <NodeViewWrapper as="span" style={{ whiteSpace: "nowrap" }}>
      <Box
        as="span"
        data-rint=""
        display="inline-flex"
        alignItems="center"
        verticalAlign="middle"
        borderRadius="sm"
        px="0.5"
        cursor="pointer"
        bg={selected ? "blue.subtle" : undefined}
        outline={selected ? "1px solid" : undefined}
        outlineColor="blue.emphasized"
        title={name}
        onMouseDown={(e) => {
          e.preventDefault();
          select();
        }}
      >
        {url ? (
          <Image src={url} alt={name} height="14px" width="auto" maxWidth="none" />
        ) : (
          /* Unresolved: the renderer silently omits these, but in the editor an
             invisible node is one you can't select to delete. Name it instead. */
          <Box as="span" fontSize="2xs" color="fg.muted" borderWidth="1px" borderRadius="sm" px="0.5">
            {name || "Unknown logo"}
          </Box>
        )}
      </Box>
    </NodeViewWrapper>
  );
}

/** The `rint` node: `<RintNode>` in the editor ↔ an entry in a run's `icons`. */
export const RintNode = Node.create({
  name: "rint",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      // The icon is usually a bare code string but may be an object, and HTML
      // attributes are strings — so objects go through JSON on the way out and
      // back. (Only paste/copy takes this path; the model round-trip is JSON.)
      icon: {
        default: "",
        parseHTML: (el) => {
          const raw = el.getAttribute("data-icon") ?? "";
          try {
            return JSON.parse(raw) as LabelIcon;
          } catch {
            return raw; // a plain code string isn't valid JSON
          }
        },
        renderHTML: (attrs) => ({
          "data-icon": typeof attrs.icon === "string" ? attrs.icon : JSON.stringify(attrs.icon),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-rint]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-rint": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RintNodeView);
  },
});
