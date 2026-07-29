"use client";

/**
 * A TipTap inline atom node for one run of wikitext we don't model.
 *
 * This exists to unblock editing, not to enable it. Measured over the 21-diagram fixture,
 * **280 of 1199 labels (23%) fell back to "Rich label — edit in JSON"** — and with no JSON
 * pane in production that meant a label nobody could edit. The fallback is also
 * all-or-nothing, so a single `{{BSto}}` made the plain text around it unreachable too.
 *
 * `{ raw }` caused 241 of those 280. A raw run is OPAQUE by definition — its content is
 * wikitext we couldn't decompose — so it doesn't need editable content, only to exist as a
 * thing the caret can move past and the user can select and delete. That's an atom, exactly
 * like the logo and station chips.
 *
 * The remaining 39 are `{ split }`, which genuinely wants a node WITH content (its lines are
 * editable text), and that is a separate and much larger job.
 *
 * Shown as its own wikitext, truncated and muted — the same treatment the renderer gives it,
 * so the chip in the editor and the thing on the diagram read as the same object.
 */
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { ReactElement } from "react";

function RawNodeView({ node }: { node: { attrs: Record<string, unknown> } }): ReactElement {
  const raw = String(node.attrs.raw ?? "");
  return (
    <NodeViewWrapper
      as="span"
      title={raw}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        maxWidth: "12em",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: 0.55,
        fontStyle: "italic",
        // A faint outline so it reads as one indivisible object rather than as text the
        // caret can enter — which is what an atom is.
        outline: "1px dotted currentColor",
        outlineOffset: "1px",
        borderRadius: "2px",
        padding: "0 2px",
        cursor: "default",
      }}
    >
      {raw}
    </NodeViewWrapper>
  );
}

/** The `raw` node: `<RawNode>` in the editor ↔ a `{ raw }` run in the model. */
export const RawNode = Node.create({
  name: "raw",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw") ?? "",
        renderHTML: (attrs) => ({ "data-raw": String(attrs.raw ?? "") }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-raw]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-raw": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RawNodeView);
  },
});
