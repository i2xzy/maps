"use client";

/**
 * A TipTap inline atom node for a `{{BSsplit}}` sharing its label with other content.
 *
 * A split that IS the whole label is edited line by line (`splitLinesOf` in the inspector) —
 * 30 of the 39 in the fixture. The other 9 sit inside running text, and for those the caret
 * has to be able to move past the split to reach the words either side of it. That's an atom:
 * an indivisible block the caret steps over, exactly like the logo, station and raw chips.
 *
 * A node WITH content — a split containing editable `splitLine` children, TipTap's table
 * extension as the reference — would let the lines be typed into directly. It also brings
 * caret-entry, Enter/Backspace at line boundaries and whole-node selection, none of which
 * works under jsdom. The lines are editable in the panel beneath instead, which needs none of
 * that and reuses the editor the whole-label case already uses.
 *
 * Shown as its lines stacked small, so the chip reads like the thing it renders as.
 */
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { TextRun } from "@repo/routemap";
import type { ReactElement } from "react";

/** The visible text of a run, for the chip's preview only. */
function runText(run: TextRun): string {
  if (typeof run === "string") return run;
  if ("text" in run && typeof run.text === "string") return run.text;
  if ("rws" in run && run.rws) return run.rws.split("|").pop() ?? "";
  if ("raw" in run) return "…";
  return "";
}

function SplitNodeView({ node }: { node: { attrs: Record<string, unknown> } }): ReactElement {
  let lines: TextRun[][] = [];
  try {
    lines = JSON.parse(String(node.attrs.lines ?? "[]")) as TextRun[][];
  } catch {
    lines = [];
  }
  return (
    <NodeViewWrapper
      as="span"
      title="Split — edit its lines below"
      style={{
        display: "inline-table",
        verticalAlign: "middle",
        margin: "-3px 0",
        fontSize: "90%",
        outline: "1px dotted currentColor",
        outlineOffset: "1px",
        borderRadius: "2px",
        padding: "0 2px",
        cursor: "default",
      }}
    >
      {lines.map((line, i) => (
        <span key={i} style={{ display: "table-row" }}>
          <span style={{ display: "table-cell", lineHeight: 1.05 }}>
            {line.map(runText).join("") || " "}
          </span>
        </span>
      ))}
    </NodeViewWrapper>
  );
}

/** The `split` node: `<SplitNode>` in the editor ↔ a `{ split }` run in the model. */
export const SplitNode = Node.create({
  name: "split",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      // The lines are runs, so they travel as JSON — HTML attributes are strings, and only
      // copy/paste takes that path. The model round-trip is JSON either way.
      lines: {
        default: "[]",
        parseHTML: (el) => el.getAttribute("data-split") ?? "[]",
        renderHTML: (attrs) => ({ "data-split": String(attrs.lines ?? "[]") }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-split]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-split": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SplitNodeView);
  },
});
