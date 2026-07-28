import { describe, expect, it } from "vitest";
import { fromWikitext } from "./from-wikitext";
import { pruneProvenance, reconcileRows } from "./reconcile";
import { toWikitext } from "./serialize";
import type { RouteDiagram } from "./types";

describe("reconcileRows", () => {
  it("keeps the model of a row whose line didn't change", () => {
    // `title` is the clearest case: the serializer never emits it, so ANY wikitext
    // round-trip loses it. Reconciling keeps it for a row nobody touched.
    const authored: RouteDiagram = {
      rows: [
        { left: { text: "Euston", title: "hover text" }, cells: ["KBHFe"] },
        { left: "Delta Junction", cells: ["ABZrg"] },
      ],
    };
    const reparsed = fromWikitext(toWikitext(authored));
    // Parsing alone drops it…
    expect(JSON.stringify(reparsed.rows[0])).not.toContain("hover text");
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

describe("pruneProvenance", () => {
  it("drops src where the row reproduces its own line", () => {
    // ~82% of rows round-trip byte-exactly, so their `src` is the same bytes the
    // serializer would produce anyway — pure noise, and it doubles the document.
    const d = pruneProvenance(fromWikitext("Euston! !KBHFe\nOOC! !BHF"));
    expect(d.rows.every((r) => (r as { src?: string }).src === undefined)).toBe(true);
    expect(toWikitext(d)).toBe("Euston! !KBHFe\nOOC! !BHF");
  });

  it("keeps src where the row does NOT reproduce its own line", () => {
    // A row the parser reads less than perfectly is exactly the one that needs it.
    const src = "{{left|{{rws|X}}}}~~ ~~ ! !\\tSTR red\\c~~ ~~&nbsp; ~~far";
    const d = pruneProvenance(fromWikitext(src));
    expect((d.rows[0] as { src?: string }).src).toBe(src);
    expect(toWikitext(d)).toBe(src);
  });

  it("still reconciles a pruned row, via its own serialization", () => {
    // Pruning must not cost the import-side protection: with no `src`, the match key is
    // the row's serialization, which for a pruned row IS the line it came from.
    const before = pruneProvenance(fromWikitext("A! !STR\nB! !STR"));
    (before.rows[0] as { left?: unknown }).left = { text: "A", title: "hover" };
    const merged = reconcileRows(fromWikitext(toWikitext(before)), before);
    expect(merged.rows[1]).toBe(before.rows[1]);
    expect(JSON.stringify(merged.rows[0])).toContain("hover");
  });

  it("leaves a diagram with no provenance alone", () => {
    const authored: RouteDiagram = { rows: [{ left: "Euston", cells: ["KBHFe"] }] };
    expect(pruneProvenance(authored).rows[0]).toBe(authored.rows[0]);
  });
});
