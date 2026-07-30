import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { loadBsiconFilter } from "@repo/routemap";
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
/** The BSicon code is an editable input now, so read its value rather than page text. */
const codes = (): string[] =>
  screen.getAllByLabelText("BSicon code").map((el) => (el as HTMLInputElement).value);
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
    expect(codes()).toEqual(["BHF"]);
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
    expect(codes()).toEqual(["BHF"]);
    fireEvent.click(screen.getByLabelText("Add cell"));
    // Still a terse string, not an object — the row must not blow up into JSON
    // nobody wants to read just because a cell was selected.
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBe("BHF");
  });

  it("leaves a code it cannot model semantically alone, but offers a way out", () => {
    // `WASSERq` decodes to the raw `{ code }` escape hatch, so there is nothing for the
    // controls to edit — it keeps the code rather than being coerced into a shape that
    // would lose it. But offering NO control at all was a dead end: with no JSON pane in
    // production you could delete the cell and not change it.
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["WASSERq"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    expect(screen.queryByText("Kind")).toBeNull();
    expect(codes()).toEqual(["WASSERq"]);

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toEqual({ kind: "track" });
    expect(screen.getByText("Kind")).toBeTruthy(); // now editable
  });

  it("lets you type any BSicon code, including ones the model can't produce", () => {
    // The only way into the ~200,000 real BSicons our encoder can't build. "Replace" could
    // take you AWAY from an unmodelled code; nothing could take you to one, so the wikitext
    // pane was the sole route in.
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["STR"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    const field = screen.getByLabelText("BSicon code");
    fireEvent.change(field, { target: { value: "WASSERq" } });
    // Kept as a code, because that's what it is — not coerced into a shape that loses it.
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBe("WASSERq");
  });

  it("decodes a typed code into the semantic controls, keeping the terse string", () => {
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["WASSERq"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    expect(screen.queryByText("Kind")).toBeNull(); // unmodelled: no controls
    fireEvent.change(screen.getByLabelText("BSicon code"), { target: { value: "BHF" } });
    // The controls appear, and the cell stays a bare code — a string cell doesn't get
    // promoted to JSON just because it was retyped.
    expect(screen.getByText("Kind")).toBeTruthy();
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBe("BHF");
  });

  it("does not warn about a real icon our encoder simply can't build", async () => {
    // `WASSERq` is on Commons and is outside the encoder's range, so it was never a key in
    // the existence filter. Reading that absence as "no such file" told users their good
    // code was broken — a wrong warning is worse than none.
    await loadBsiconFilter();
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["STR"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    fireEvent.change(screen.getByLabelText("BSicon code"), { target: { value: "WASSERq" } });
    expect(screen.queryByText(/No file on Commons/)).toBeNull();
  });

  it("writes the same shape whichever cell you typed into", () => {
    // The code field used to sit inside IconFields for modelled cells and outside it for
    // unmodelled ones, so typing `BHF` gave a bare string from one and `{ kind: "station" }`
    // from the other. One field at the cell level, one rule: a typed code is a code.
    for (const start of ["STR", "WASSERq"]) {
      const { unmount } = renderWithChakra(
        <Controlled initial={{ rows: [{ cells: [start] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
      );
      fireEvent.change(screen.getByLabelText("BSicon code"), { target: { value: "BHF" } });
      expect((model().rows![0] as { cells: unknown[] }).cells[0], start).toBe("BHF");
      unmount();
    }
  });

  it("keeps a ref's title when its code is retyped", () => {
    // `{ code, title }` metadata the controls know nothing about must survive the keystroke.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [{ code: "hKRZW", title: "bridge over water" } as never] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("BSicon code"), { target: { value: "WASSERq" } });
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toEqual({
      code: "WASSERq",
      title: "bridge over water",
    });
  });

  it("warns about a code with no file, but still accepts it", async () => {
    // A hint, never a block: the filter has a known false-positive rate, is a snapshot, and
    // a user typing an unfamiliar code is likelier to be right about Commons than we are.
    //
    // The filter has to be loaded explicitly — it's fetched on demand to stay out of the
    // first-load chunk, and until it arrives every code reads as existing. So this asserts
    // the warning, and the test above (which doesn't load it) shows the quiet default.
    await loadBsiconFilter();
    renderWithChakra(
      <Controlled initial={{ rows: [{ cells: ["STR"] }] }} select={{ kind: "cell", row: 0, col: 0 }} />,
    );
    fireEvent.change(screen.getByLabelText("BSicon code"), { target: { value: "kSTR" } });
    expect(screen.getByText(/No file on Commons/)).toBeTruthy();
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toBeTruthy();
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
    // The existing icon becomes the base; the new one layers over it. The new layer is the
    // semantic object form, which is the document's convention now that Format canonicalizes
    // cells — a bare code here would make it the odd one out among its neighbours. The base
    // keeps whatever shape it already had.
    expect((model().rows![0] as { cells: unknown[] }).cells[0]).toEqual(["BHF", { kind: "track" }]);
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
    expect(codes()).toEqual(["STR", "BHF"]);
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
    expect(codes()).toEqual(["hKRZW"]);
    fireEvent.click(screen.getByRole("button", { name: /Overlay/ }));
    const base = (model().rows![0] as { cells: unknown[][] }).cells[0]![0];
    expect(base).toEqual({ code: "hKRZW", title: "bridge over water" });
  });

  it("offers a 2–3 option enum as radio cards, including a card back to unset", () => {
    // A dropdown you must open to read two choices is two clicks for no information, so
    // fields with 2–3 options render as cards. Each card previews the icon you'd get,
    // because the option names (`l`, `1`, `over`) mean nothing without the picture.
    //
    // Structure only. Under jsdom the group still carries Ark's `data-ssr` when the
    // assertions run and no click — on the input, the label or the control — reaches a
    // handler, so an interaction assertion here would pass or fail for reasons unrelated
    // to this code. Picking and clearing ARE verified in a real browser (STR → STRo →
    // STR → STRu). What's locked in here is the part that regresses silently: that the
    // control is a labelled radio group carrying the right options and previews.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ cells: [{ kind: "track", level: "over" }] }] }}
        select={{ kind: "cell", row: 0, col: 0 }}
      />,
    );
    const level = screen.getByRole("radiogroup", { name: /level/i });
    const card = (name: RegExp | string) => within(level).getByRole("radio", { name }).closest("label")!;
    const preview = (name: RegExp | string) => card(name).querySelector("img")!.getAttribute("src");

    // Every option, plus the explicit way back to unset — needed because Ark fires no
    // change event when you click the already-selected item, so re-click can't clear.
    expect(within(level).getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "__none__",
      "over",
      "under",
    ]);
    expect(preview("—")).toContain("BSicon_STR.svg"); // the icon with `level` cleared
    expect(preview(/over/i)).toContain("BSicon_STRo.svg");
    expect(preview(/under/i)).toContain("BSicon_STRu.svg");
  });

  it("edits an empty column as the spacer it already is", () => {
    // An absent cell IS a full-width spacer — that's how it renders and what it serializes
    // to. It used to get a different panel entirely, so the same thing in the diagram had
    // two unrelated forms depending on whether Format had been pressed.
    renderWithChakra(<Controlled initial={{ rows: [{ cells: [null] }] }} select={{ kind: "cell", row: 0, col: 0 }} />);
    expect(screen.getByText("Kind")).toBeTruthy();
    expect(screen.queryByText(/Empty column/)).toBeNull();
    // And selecting it writes nothing: the cell is still null until something changes.
    expect((model().rows![0] as { cells: unknown[] }).cells).toEqual([null]);
  });
});

describe("Inspector: row selection (labels & colspan)", () => {
  it("edits the main label of each side, keeping the plain string shape", () => {
    renderWithChakra(<Controlled initial={{ rows: [{ left: "Euston", right: "note", cells: [] }] }} select={{ kind: "row", row: 0 }} />);
    fireEvent.change(screen.getByLabelText("Left main text"), { target: { value: "Euston Square" } });
    // A plain label stays a plain string rather than being promoted to { main: … }.
    expect(model().rows![0]).toEqual({ left: "Euston Square", right: "note", cells: [] });
    fireEvent.change(screen.getByLabelText("Right main text"), { target: { value: "changed" } });
    expect(model().rows![0]).toEqual({ left: "Euston Square", right: "changed", cells: [] });
  });

  it("keeps a row's properties when its label is edited in the GUI", () => {
    // The point of modelling `props` at all. Provenance keeps an UNTOUCHED row byte-exact,
    // so `fontsize=main` survived a paste — but the moment someone edited the row through
    // the form it was re-serialized from the model, and anything the model didn't hold was
    // gone. A restyled row with no indication why.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: "Euston", props: "fontsize=main", cells: ["STR"] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Left main text"), { target: { value: "Euston Square" } });
    expect(model().rows![0]).toEqual({
      left: "Euston Square",
      props: "fontsize=main",
      cells: ["STR"],
    });
  });

  it("shows an editor per occupied slot, named by side and slot", () => {
    // Both sides have a "Main text", so the accessible name has to carry the side too.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { main: "Euston", dist: "0 km" }, right: "note", cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.getByLabelText("Left main text")).toBeTruthy();
    expect(screen.getByLabelText("Left distance or time")).toBeTruthy();
    expect(screen.getByLabelText("Right main text")).toBeTruthy();
    // Unoccupied slots aren't rendered as empty editors; they live in the add menu.
    expect(screen.queryByLabelText("Left remark")).toBeNull();
  });

  it("removes a slot, and demotes the side back to a plain label", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ left: { main: "Euston", remark: "terminus" }, cells: [] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove left remark"));
    // Back to the string it would have been written as, not `{ main: "Euston" }` —
    // otherwise the JSON drifts to the verbose form the first time anyone adds a slot.
    expect(model().rows![0]).toEqual({ left: "Euston", cells: [] });
    expect(screen.queryByLabelText("Left remark")).toBeNull();
  });

  it("offers the unused slots to add, and drops the whole side when emptied", () => {
    renderWithChakra(<Controlled initial={{ rows: [{ left: "Euston", cells: [] }] }} select={{ kind: "row", row: 0 }} />);
    // One add affordance per side, not one button per empty slot.
    expect(screen.getAllByRole("button", { name: /^Add label$/ })).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("Remove left main text"));
    expect(model().rows![0]).toEqual({ cells: [] });
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
    // The message now says WHY and points somewhere the user can actually go — the JSON
    // pane it used to name isn't in the production build.
    expect(screen.getByText(/can’t model — edit it in the wikitext panel/)).toBeTruthy();
  });




  it("edits a whole-label {{BSsplit}} one line at a time", () => {
    // 30 of the 39 splits in the fixture ARE the whole label, which is why this beats an
    // inline node: every hard part of that (caret across a line boundary, Enter/Backspace at
    // the edges) exists only for a split sitting inside running text.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ right: [{ split: [["factory"], ["or works"]] }], cells: ["STR"] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.queryByText(/can’t model/)).toBeNull(); // no longer a dead end
    fireEvent.change(screen.getByLabelText("Right main text line 2"), { target: { value: "or mill" } });
    expect((model().rows![0] as { right: unknown }).right).toEqual([
      { split: [["factory"], ["or mill"]] },
    ]);
  });

  it("adds and removes split lines, collapsing below two", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ right: [{ split: [["a"], ["b"]] }], cells: ["STR"] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Line/ }));
    expect((model().rows![0] as unknown as { right: [{ split: unknown[] }] }).right[0].split).toHaveLength(3);

    fireEvent.click(screen.getByTitle("Remove line 3"));
    fireEvent.click(screen.getByTitle("Remove line 2"));
    // One line isn't a split — it collapses, rather than leaving a stack of one nobody sees.
    expect((model().rows![0] as { right: unknown }).right).toEqual(["a"]);
  });

  it("edits both the text and the lines when a split shares its label", () => {
    // The other 9. The split is an atom chip in the RTE so the caret can reach the words
    // either side of it, and its lines get the same per-line editors underneath — which is
    // why this needed no ProseMirror node-with-content.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ right: ["to ", { split: [["a"], ["b"]] }], cells: ["STR"] }] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.queryByText(/can’t model/)).toBeNull();
    // The surrounding text is editable...
    expect(screen.getByLabelText("Right main text")).toBeTruthy();
    // ...and so is each line of the split.
    fireEvent.change(screen.getByLabelText("Right main text line 2"), { target: { value: "B!" } });
    expect((model().rows![0] as { right: unknown }).right).toEqual(["to ", { split: [["a"], ["B!"]] }]);
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

describe("Inspector: colspan rows", () => {
  it("edits rich colspan text in the RTE, not a dead end", () => {
    // The other half of the dead end the side labels had: "(Rich colspan — edit in JSON)"
    // named a pane that isn't in the production build.
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ type: "colspan", text: ["a ", { text: "b", italic: true }] } as never] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    expect(screen.queryByText(/edit in JSON/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Colspan text"), { target: { value: "changed" } });
    expect((model().rows![0] as { text: unknown }).text).toBe("changed");
  });

  it("edits a whole-label split in a colspan row line by line", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ type: "colspan", text: [{ split: [["a"], ["b"]] }] } as never] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Colspan text line 2"), { target: { value: "B" } });
    expect((model().rows![0] as { text: unknown }).text).toEqual([{ split: [["a"], ["B"]] }]);
  });

  it("still edits plain colspan text as a plain field", () => {
    renderWithChakra(
      <Controlled
        initial={{ rows: [{ type: "colspan", text: "all stations" } as never] }}
        select={{ kind: "row", row: 0 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Colspan text"), { target: { value: "some stations" } });
    expect((model().rows![0] as { text: unknown }).text).toBe("some stations");
  });
});
