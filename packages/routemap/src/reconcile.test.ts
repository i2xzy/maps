import { describe, expect, it } from "vitest";
import { fromWikitext } from "./from-wikitext";
import { reconcileRows } from "./reconcile";
import { toWikitext } from "./serialize";
import type { RouteDiagram } from "./types";

describe("reconcileRows", () => {
  it("keeps the model of a row whose line didn't change", () => {
    // The reported bug: a label authored as `{ text: [...], italic: true }` serializes to
    // `''to {{rws|A}} & {{rws|B}}''` and parses back as one opaque `{ raw }` run. Typing a
    // character anywhere in the wikitext pane re-parsed everything and flattened it.
    const authored: RouteDiagram = {
      rows: [
        { left: { text: ["to ", { rws: "Liverpool|Lime Street" }], italic: true }, cells: ["STR"] },
        { left: "Delta Junction", cells: ["ABZrg"] },
      ],
    };
    const text = toWikitext(authored);
    const reparsed = fromWikitext(text);
    // Parsing alone loses the structure…
    expect(JSON.stringify(reparsed.rows[0])).toContain('"raw"');
    // …and reconciling gets it back, because the line is unchanged.
    const merged = reconcileRows(reparsed, authored);
    expect(merged.rows[0]).toBe(authored.rows[0]);
    expect(merged.rows[1]).toBe(authored.rows[1]);
  });

  it("takes the newly parsed row where the line DID change", () => {
    const before: RouteDiagram = { rows: [{ left: "Euston", cells: ["KBHFe"] }] };
    const merged = reconcileRows(fromWikitext("Euston Square! !KBHFe"), before);
    expect(merged.rows[0]).not.toBe(before.rows[0]);
    expect(merged.rows[0]).toMatchObject({ left: "Euston Square" });
  });

  it("keeps untouched rows when one line in the middle changes", () => {
    const before: RouteDiagram = {
      rows: [{ left: "A", cells: ["STR"] }, { left: "B", cells: ["STR"] }, { left: "C", cells: ["STR"] }],
    };
    const merged = reconcileRows(fromWikitext("A! !STR\nEDITED! !STR\nC! !STR"), before);
    expect(merged.rows[0]).toBe(before.rows[0]);
    expect(merged.rows[1]).not.toBe(before.rows[1]);
    expect(merged.rows[2]).toBe(before.rows[2]);
  });

  it("maps two identical lines to two rows, not one row twice", () => {
    // Each previous row is consumed once. Reusing the same object for both would alias
    // them, so editing one would change the other.
    const before: RouteDiagram = { rows: [{ cells: ["STR"] }, { cells: ["STR"] }] };
    const merged = reconcileRows(fromWikitext("STR\nSTR"), before);
    expect(merged.rows).toHaveLength(2);
    expect(merged.rows[0]).not.toBe(merged.rows[1]);
  });

  it("matches a row already edited through the GUI, by what it serializes to NOW", () => {
    // Not by its original `src`: a GUI-edited row's text is its re-serialization, and it
    // must still be reusable when the user then types elsewhere in the pane.
    const imported = fromWikitext("Euston! !KBHFe\nOOC! !BHF");
    (imported.rows[0] as { left?: unknown }).left = "Euston Square";
    const text = toWikitext(imported); // "Euston Square! !KBHFe\nOOC! !BHF"
    const merged = reconcileRows(fromWikitext(text), imported);
    expect(merged.rows[0]).toBe(imported.rows[0]);
    expect(merged.rows[1]).toBe(imported.rows[1]);
  });

  it("passes the parse through when there's nothing to reconcile against", () => {
    const parsed = fromWikitext("STR");
    expect(reconcileRows(parsed, null)).toBe(parsed);
    expect(reconcileRows(parsed, { rows: [] })).toBe(parsed);
  });
});
