import { describe, expect, it } from "vitest";
import { fromWikitext } from "./from-wikitext";
import { toWikitext } from "./serialize";

/** Cell shapes the form or a consumer can produce. */
const CELLS: [string, unknown][] = [
  ["none", []],
  ["one blank", [null]],
  ["two blanks", [null, null]],
  ["empty string", [""]],
  ["code", ["STR"]],
  ["code + blank", ["STR", null]],
  ["blank + code", [null, "STR"]],
  ["object", [{ kind: "track" }]],
  ["spacer object", [{ kind: "spacer" }]],
  ["spacer + code", [{ kind: "spacer" }, "STR"]],
  ["width spacer", ["d"]],
  ["stack of two", [["STR", "BHF"]]],
  ["stack of one", [["STR"]]],
  ["stack object", [{ stack: ["STR", "BHF"] }]],
  ["unmodelled code", [{ code: "WASSERq" }]],
];

/** Label shapes, used on left and right. */
const LABELS: [string, unknown][] = [
  ["absent", undefined],
  ["empty string", ""],
  ["plain", "Euston"],
  ["runs", ["to ", { text: "X", bold: true }]],
  ["main slot", { main: "Euston" }],
  ["main+dist", { main: "Euston", dist: "1 km" }],
  ["dist only", { dist: "1 km" }],
  ["remark only", { remark: "note" }],
  ["all four slots", { outer: "o", remark: "r", main: "m", dist: "d" }],
  ["icon run", [{ icon: "gb|rail" }]],
  ["rws run", [{ rws: "A|B" }]],
  ["raw run", [{ raw: "{{x|y}}" }]],
  ["split only", [{ split: [["a"], ["b"]] }]],
  ["text + split", ["to ", { split: [["a"], ["b"]] }]],
  ["object w/ marks", { text: "x", italic: true }],
  ["empty array", []],
  ["array w/ empty string", [""]],
];

/**
 * Every model shape the editor (or a consumer building JSON) can produce must survive a trip
 * through wikitext.
 *
 * The model is deliberately more permissive than the format — it holds `cells: []`, a label of
 * `[""]`, a stack of one — and each of those needs either a valid spelling or to be unreachable.
 * Two real bugs came from that gap in one afternoon: an empty row serialised to a blank line and
 * vanished, and a row of two blanks couldn't shrink to one. This is the systematic version of
 * finding them one report at a time.
 *
 * The property is deliberately TWO things. Text being a fixed point catches content loss; the row
 * surviving catches structural loss. With only the first, a vanishing row left "" on both sides
 * and the harness reported success — verified by reverting the fix and watching it stay green.
 */
describe("every model shape survives a round trip", () => { it("keeps the row and its wikitext", () => {
  const bad: string[] = [];
  let n = 0;
  const check = (label: string, row: unknown) => {
    n++;
    let a: string, b: string;
    try { a = toWikitext({ rows: [row] } as never); } catch (e) { bad.push(`${label}: THREW serialising — ${(e as Error).message}`); return; }
    try {
      const parsed = fromWikitext(a);
      // The ROW must survive, not just the text. A vanishing row leaves both sides as "" so a
      // text-only comparison reports success — which is exactly how this harness first missed
      // the empty-row bug it was written to find.
      if (parsed.rows.length !== 1) {
        bad.push(`${label}: row VANISHED — ${JSON.stringify(a)} parsed to ${parsed.rows.length} rows`);
        return;
      }
      b = toWikitext({ ...parsed, rows: parsed.rows.map((r) => ({ ...r, src: undefined })) } as never);
    } catch (e) { bad.push(`${label}: THREW re-parsing ${JSON.stringify(a)} — ${(e as Error).message}`); return; }
    if (a !== b) bad.push(`${label}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  };

  // Every cell shape against every label shape, on each side, with and without a row property —
  // the combinations are where the holes were, not the shapes alone.
  for (const [cn, cells] of CELLS)
    for (const [ln, label] of LABELS) {
      check(`L(${ln}) cells(${cn})`, { left: label, cells });
      check(`R(${ln}) cells(${cn})`, { right: label, cells });
      check(`L+R(${ln}) cells(${cn})`, { left: label, right: label, cells });
      check(`L(${ln}) cells(${cn}) props`, { left: label, cells, props: "fontsize=main" });
    }
  // Slot labels holding each run kind, since a slot is a label in its own right.
  for (const [ln, label] of LABELS)
    for (const slot of ["dist", "main", "remark", "outer"])
      check(`slot ${slot}(${ln})`, { left: { [slot]: label }, cells: ["STR"] });
  for (const [cn, cells] of CELLS) check(`props cells(${cn})`, { cells, props: "bg=#003399" });
  for (const [ln, label] of LABELS) check(`colspan(${ln})`, { type: "colspan", text: label });

  // Named, not counted: a failure should say which shape and what happened to it.
  expect({ checked: n, lost: bad }).toEqual({ checked: n, lost: [] });
}); });
