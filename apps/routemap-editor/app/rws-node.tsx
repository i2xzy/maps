"use client";

/**
 * A TipTap inline atom node for an `{{rws}}` station link. The node stores only
 * the rws `args`; its display text is resolved at render time (like the wiki),
 * via a `RwsResolver` supplied through React context — so the editor shows the
 * station's display name while the popover edits the underlying arguments.
 */
import { createContext, useContext, type ReactNode } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Box } from "@chakra-ui/react";
import type { RwsEntry } from "@repo/routemap";

export type RwsResolver = (args: string) => RwsEntry | undefined;

// Provided above <EditorContent>; React portals keep node views in this tree, so
// the resolver (and its updates as the wiki data loads) reach the node view.
const RwsResolverContext = createContext<RwsResolver | undefined>(undefined);
export const RwsResolverProvider = RwsResolverContext.Provider;

function RwsNodeView({ node, editor, getPos, selected }: NodeViewProps): ReactNode {
  const resolve = useContext(RwsResolverContext);
  const args = (node.attrs.args as string) ?? "";
  const entry = resolve?.(args);
  // Until the wiki resolves the args, show them as a readable fallback.
  const display = entry?.display ?? (args ? args.replace(/\|/g, " ") : "station");
  // Select the whole node on click so the toolbar can edit/remove it, and the
  // "Station" popover reopens on its args.
  const select = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos != null) editor.commands.setNodeSelection(pos);
  };
  return (
    <NodeViewWrapper as="span" style={{ whiteSpace: "nowrap" }}>
      <Box
        as="span"
        data-rws=""
        color="blue.fg"
        textDecoration="underline"
        textDecorationStyle="dotted"
        cursor="pointer"
        borderRadius="sm"
        bg={selected ? "blue.subtle" : undefined}
        outline={selected ? "1px solid" : undefined}
        outlineColor="blue.emphasized"
        title={entry ? entry.target : `{{rws|${args}}}`}
        onMouseDown={(e) => {
          e.preventDefault();
          select();
        }}
      >
        {display}
      </Box>
    </NodeViewWrapper>
  );
}

/** The `rws` node: `<RwsNode>` in the editor ↔ `{ rws: args }` in the model. */
export const RwsNode = Node.create({
  name: "rws",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { args: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-rws]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-rws": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RwsNodeView);
  },
});
