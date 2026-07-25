import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { RouteDiagram, Selection } from "@repo/routemap";
import { Inspector } from "./inspector";
import { renderWithChakra } from "./test-utils";

// The label RTE is a TipTap/ProseMirror editor, which is unreliable under jsdom;
// its conversion logic is covered in label-doc.test.ts and it's verified in the
// browser. Here we stand it in with a plain input so the inspector wiring and the
// rest of the row panel stay testable.
vi.mock("./label-editor", () => ({
  LabelRichEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: unknown;
    onChange: (v: unknown) => void;
    ariaLabel?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  ),
}));

// A stateful host holding both the diagram and the selection, like the page — so
// a click in the inspector (which nudges selection) re-renders the tree for real.
function Controlled({ initial, select }: { initial: RouteDiagram; select?: Selection | null }): React.ReactElement {
  const [d, setD] = useState<RouteDiagram>(initial);
  const [sel, setSel] = useState<Selection | null>(select ?? null);
  return (
    <>
      <Inspector diagram={d} selection={sel} onChange={setD} onSelect={setSel} />
      <pre data-testid="json">{JSON.stringify(d)}</pre>
      <pre data-testid="sel">{JSON.stringify(sel)}</pre>
    </>
  );
}
const model = (): RouteDiagram => JSON.parse(screen.getByTestId("json").textContent!);
const sel = (): Selection | null => JSON.parse(screen.getByTestId("sel").textContent!);

const CELL = (kind: string): RouteDiagram => ({ rows: [{ cells: [{ kind } as never] }] });

describe("Inspector: nothing selected", () => {
  it("shows a hint and can add a row", () => {
    renderWithChakra(<Controlled initial={{ rows: [] }} />);
    expect(screen.getByText(/Click a cell or a row/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Row" }));
    expect(model().rows).toHaveLength(1);
    // The new row is selected so you can edit its labels straight away.
    expect(sel()).toEqual({ kind: "row", row: 0 });
  });

  it("falls back to the hint when the selection points at a deleted row", () => {
    renderWithChakra(<Controlled initial={{ rows: [] }} select={{ kind: "cell", row: 5, col: 0 }} />);
    expect(screen.getByText(/Click a cell or a row/)).toBeTruthy();
  });
});

describe("Inspector: cell selection", () => {
  it("shows icon controls and the serialized code for the selected cell", () => {
    renderWithChakra(<Controlled initial={CELL("station")} select={{ kind: "cell", row: 0, col: 0 }} />);
    expect(screen.getByText("Cell 1 of 1")).toBeTruthy();
    expect(screen.getByText("Kind")).toBeTruthy(); // captions shown in proper case
    expect(screen.getByText("BHF")).toBeTruthy();
  });

  it("adds a cell after the selected one and selects it", () => {
    renderWithChakra(<Controlled initial={CELL("track")} select={{ kind: "cell", row: 0, col: 0 }} />);
    fireEvent.click(screen.getByLabelText("Add cell"));
    expect((model().rows![0] as { cells: unknown[] }).cells).toHaveLength(2);
    expect(sel()).toEqual({ kind: "cell", row: 0, col: 1 });
  });

  it("deletes the selected cell and falls back to the row when it was the last", () => {
    renderWithChakra(<Controlled initial={CELL("track")} select={{ kind: "cell", row: 0, col: 0 }} />);
    fireEvent.click(screen.getByLabelText("Delete cell"));
    expect((model().rows![0] as { cells: unknown[] }).cells).toHaveLength(0);
    expect(sel()).toEqual({ kind: "row", row: 0 });
  });

  it("moves a cell right and keeps the selection on it", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [{ kind: "track" } as never, { kind: "station" } as never] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Move right"));
    expect((model().rows![0] as { cells: unknown[] }).cells).toEqual([{ kind: "station" }, { kind: "track" }]);
    expect(sel()).toEqual({ kind: "cell", row: 0, col: 1 });
  });

  it("moves a cell down into the row below, keeping its column, and follows it", () => {
    renderWithChakra(
      <Controlled
        initial={{
          rows: [
            { cells: [{ kind: "track" } as never, { kind: "station" } as never] },
            { cells: [{ kind: "track" } as never] },
          ],
        }}
        select={{ kind: "cell", row: 0, col: 1 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Move to row below"));
    const rows = model().rows! as { cells: unknown[] }[];
    expect(rows[0]!.cells).toEqual([{ kind: "track" }]);
    // col 1 clamps to the shorter target row's end (index 1).
    expect(rows[1]!.cells).toEqual([{ kind: "track" }, { kind: "station" }]);
    expect(sel()).toEqual({ kind: "cell", row: 1, col: 1 });
  });

  it("disables 'move to row above' for the top row", () => {
    renderWithChakra(<Controlled initial={CELL("track")} select={{ kind: "cell", row: 0, col: 0 }} />);
    expect(screen.getByLabelText("Move to row above")).toHaveProperty("disabled", true);
  });

  it("edits a plain BSicon code cell, and writes it back as a code", () => {
    // Hand-written and pasted diagrams are made of bare codes (`["STR","STR"]`).
    // Before this they showed a thumbnail and nothing else, so the form only ever
    // edited cells the form itself had created.
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["BHF"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    // Decoded into the semantic controls: BHF is a station.
    expect(screen.getByText("Kind")).toBeTruthy();
    expect(screen.getByText("BHF")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Add cell"));
    // Still a terse string, not an object — the row must not blow up into JSON
    // nobody wants to read just because a cell was selected.
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBe("BHF");
  });

  it("leaves a code it cannot model semantically alone", () => {
    // `WASSERq` decodes to the raw `{ code }` escape hatch, so there is nothing for
    // the controls to edit — it keeps the read-only fallback rather than being
    // coerced into a shape that would lose it.
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["WASSERq"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    expect(screen.queryByText("Kind")).toBeNull();
    expect(screen.getByText("WASSERq")).toBeTruthy();
  });

  it("shows a placeholder, not a broken image, when a preview has no file", () => {
    // Option previews combine fields freely and plenty of the results were never
    // drawn on Commons. A broken-image glyph reads as "this control is broken".
    renderWithChakra(<Controlled initial={CELL("station")} select={{ kind: "cell", row: 0, col: 0 }} />);
    const img = screen.getAllByRole("img")[0]!;
    expect(img.isConnected).toBe(true);
    fireEvent.error(img);
    // That specific <img> is replaced by the dashed placeholder. Asserting on the
    // element rather than its alt text, because several previews share a code.
    expect(img.isConnected).toBe(false);
  });

  it("promotes a single cell to an overlay stack and collapses it back", () => {
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["BHF"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Overlay/ }));
    // The existing icon becomes the base; the new one layers over it.
    // The new layer is a code too, so a stack of codes doesn't grow a lone object.
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toEqual(["BHF", "STR"]);
    expect(screen.getByText("Base")).toBeTruthy();
    expect(screen.getByText("Overlay 1")).toBeTruthy();

    // Removing a layer collapses back to a plain cell, not a one-element array.
    fireEvent.click(screen.getAllByLabelText("Remove layer")[1]!);
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBe("BHF");
  });

  it("edits each layer of an existing stack independently", () => {
    // Over half the rows of a real diagram are `!~` stacks; they used to be JSON-only.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [["STR", "BHF"]] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    // One set of controls per layer, each decoded from its code.
    expect(screen.getAllByText("Kind")).toHaveLength(2);
    expect(screen.getByText("STR")).toBeTruthy();
    expect(screen.getByText("BHF")).toBeTruthy();
  });

  it("reorders stack layers, and the arrows match the list", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [["STR", "BHF"]] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    // "Move layer down" on the base sends it below the overlay in the list, which is
    // the model order the JSON and the wikitext `a!~b` both use.
    fireEvent.click(screen.getAllByLabelText("Move layer down")[0]!);
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toEqual(["BHF", "STR"]);
    // Ends are disabled rather than wrapping.
    expect(screen.getAllByLabelText("Move layer up")[0]).toHaveProperty("disabled", true);
    expect(screen.getAllByLabelText("Move layer down")[1]).toHaveProperty("disabled", true);
  });

  it("keeps an icon ref's title when its code is edited", () => {
    // The sample's `hKRZW` cell carries a tooltip. The icon controls know nothing
    // about `title`, so losing it on the first edit would be worse than not editing.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [{ code: "hKRZW", title: "bridge over water" } as never] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    expect(screen.getByText("Kind")).toBeTruthy(); // decoded, not read-only
    expect(screen.getByText("hKRZW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Overlay/ }));
    const base = (model().rows![0] as { cells: unknown[][] }).cells[0]![0];
    expect(base).toEqual({ code: "hKRZW", title: "bridge over water" });
  });

  it("turns an empty column into an icon", () => {
    renderWithChakra(<Controlled initial={{ rows: [{ cells: [null] }] }} select={{ kind: "cell", row: 0, col: 0 }} />);
    expect(screen.getByText(/Empty column/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add icon" }));
    expect((model().rows![0] as { cells: unknown[] }).cells).toEqual([{ kind: "track" }]);
  });
});

describe("Inspector: row selection (labels & colspan)", () => {
  it("reveals an editor via 'Add … label' and edits both sides", () => {
    renderWithChakra(<Controlled initial={{ rows: [{ cells: [] }] }} select={{ kind: "row", row: 0 }} />);
    // Empty labels start as add-buttons, not editors.
    expect(screen.queryByLabelText("Left label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add left label" }));
    fireEvent.change(screen.getByLabelText("Left label"), { target: { value: "Euston" } });
    expect(model().rows![0]).toEqual({ cells: [], left: "Euston" });
    fireEvent.click(screen.getByRole("button", { name: "Add right label" }));
    fireEvent.change(screen.getByLabelText("Right label"), { target: { value: "note" } });
    expect(model().rows![0]).toEqual({ cells: [], left: "Euston", right: "note" });
  });

  it("shows the editor (not an add-button) when a label already has text, and removes it", () => {
    renderWithChakra(<Controlled initial={{ rows: [{ left: "Euston", cells: [] }] }} select={{ kind: "row", row: 0 }} />);
    expect(screen.queryByRole("button", { name: "Add left label" })).toBeNull();
    expect(screen.getByLabelText("Left label")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove left label"));
    expect(model().rows![0]).toEqual({ cells: [] });
    expect(screen.getByRole("button", { name: "Add left label" })).toBeTruthy();
  });

  it("keeps a label carrying a title as a JSON-only fallback (no RTE clobber)", () => {
    // `title` is the one label field the editor can't represent, so it must not
    // be handed to the RTE, which would drop it on the first keystroke.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { text: "x", title: "hover" }, cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.getByText(/Rich label — edit in JSON/)).toBeTruthy();
  });

  it("hides the logo strip on a plain single-line label", () => {
    // On one line, whole-label icons and an inline logo are the same wikitext, so a
    // second control for it is just clutter — the editor toolbar covers that case.
    renderWithChakra(
      <Controlled initial={{ rows: [{ left: "Euston", cells: [] }] }} select={{ kind: "row", row: 0 }} />,
    );
    expect(screen.queryByRole("button", { name: /^Logo$/ })).toBeNull();
  });

  it("shows the logo strip on a multi-line label, where placement differs", () => {
    // Outside a {{BSsplit}} the logo sits against the whole stack; inside, on one
    // line. Wikipedia uses both, so this has to stay reachable.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "Penang|Perak", cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Logo$/ })).toBeTruthy();
  });

  it("shows the logo strip whenever the label already has whole-label icons", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { text: "Euston", icons: ["gb|rail"] }, cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    // Single line, but the icons exist — they must be visible and removable.
    expect(screen.getByLabelText("Remove National Rail")).toBeTruthy();
  });

  it("edits a label's whole-label logos without disturbing its text", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { text: "Euston", link: true, icons: ["gb|rail", "not|acode"] }, cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    // Icons are a strip beside the editor, not a JSON fallback.
    expect(screen.queryByText(/Rich label — edit in JSON/)).toBeNull();
    expect(screen.getByLabelText("Left label")).toBeTruthy();

    // An uncatalogued code has no name, so the chip falls back to showing it raw.
    fireEvent.click(screen.getByLabelText("Remove not|acode"));
    expect((model().rows![0] as { left?: unknown }).left).toEqual({ text: "Euston", link: true, icons: ["gb|rail"] });

    // Dropping the last one collapses `icons` away rather than leaving `[]`.
    // A catalogued logo is named, not shown as a template code.
    fireEvent.click(screen.getByLabelText("Remove National Rail"));
    expect((model().rows![0] as { left?: unknown }).left).toEqual({ text: "Euston", link: true });
  });

  it("keeps whole-label logos when the label's text is edited", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { text: "Euston", icons: ["gb|rail"] }, cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    // The icons live outside the document, so a text edit has to re-attach them.
    fireEvent.change(screen.getByLabelText("Left label"), { target: { value: "Euston station" } });
    expect((model().rows![0] as { left?: unknown }).left).toEqual({ text: "Euston station", icons: ["gb|rail"] });
  });

  it("edits colspan text", () => {
    renderWithChakra(
      <Controlled initial={{ rows: [{ type: "colspan", text: "old" }] }} select={{ kind: "row", row: 0 }} />,
    );
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect((model().rows![0] as { text: string }).text).toBe("new");
  });
});

describe("Inspector: row actions", () => {
  it("deletes the selected row and clears the selection", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [{ kind: "track" } as never] }, { cells: [{ kind: "station" } as never] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Delete row"));
    expect(model().rows).toEqual([{ cells: [{ kind: "station" }] }]);
    expect(sel()).toBeNull();
  });

  it("does not show row tools or + row on a cell panel", () => {
    renderWithChakra(<Controlled initial={CELL("track")} select={{ kind: "cell", row: 0, col: 0 }} />);
    expect(screen.queryByLabelText("Delete row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Row" })).toBeNull();
    expect(screen.getByLabelText("Delete cell")).toBeTruthy();
  });

  it("moves the selected row down and follows it", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "first", cells: [] }, { left: "second", cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Move row down"));
    expect(model().rows!.map((r) => (r as { left: string }).left)).toEqual(["second", "first"]);
    expect(sel()).toEqual({ kind: "row", row: 1 });
  });

  it("the below bar inserts a row directly under the selected one, not at the end", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "first", cells: [] }, { left: "second", cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Insert row below"));
    expect(model().rows!.map((r) => (r as { left?: string }).left)).toEqual(["first", undefined, "second"]);
    expect(sel()).toEqual({ kind: "row", row: 1 });
  });

  it("the above bar inserts a row directly above the selected one and selects it", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "first", cells: [] }, { left: "second", cells: [] }] }}
        select={{ kind: "row", row: 1 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Insert row above"));
    expect(model().rows!.map((r) => (r as { left?: string }).left)).toEqual(["first", undefined, "second"]);
    expect(sel()).toEqual({ kind: "row", row: 1 });
  });

  it("the below bar places a deep copy right after the selected row", () => {
    renderWithChakra(
      <Controlled initial={{ rows: [{ left: "A", cells: [{ kind: "track" } as never] }] }} select={{ kind: "row", row: 0 }} />,
    );
    fireEvent.click(screen.getByLabelText("Duplicate row below"));
    const rows = model().rows!;
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ left: "A", cells: [{ kind: "track" }] });
    expect(sel()).toEqual({ kind: "row", row: 1 });
  });

  it("the above bar places a copy right before the selected row", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "first", cells: [] }, { left: "second", cells: [] }] }}
        select={{ kind: "row", row: 1 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Duplicate row above"));
    expect(model().rows!.map((r) => (r as { left?: string }).left)).toEqual(["first", "second", "second"]);
    expect(sel()).toEqual({ kind: "row", row: 1 });
  });

  it("exposes move/insert/duplicate in both bars plus delete, all icon-only", () => {
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: [] }, { cells: [] }] }} select={{ kind: "row", row: 0 }} />,
    );
    for (const label of [
      "Move row up",
      "Move row down",
      "Insert row above",
      "Insert row below",
      "Duplicate row above",
      "Duplicate row below",
      "Delete row",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    // No worded add/duplicate buttons anymore.
    expect(screen.queryByRole("button", { name: "Row below" })).toBeNull();
  });
});
