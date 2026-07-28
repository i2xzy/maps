import { describe, expect, it } from "vitest";
import { canonicalizeDiagram, migrateDiagram, needsMigration } from "./migrate";
import { toWikitext } from "./serialize";
import type { RouteDiagram } from "./types";

/**
 * The acceptance test is the WIKITEXT, not the shape: a migrated diagram has to emit
 * exactly what the old serializer emitted for the old document. The expectations below
 * are derived from the rules that code actually used —
 *
 *   left  label: icons.join(" ") + (text ? " " + text : "")
 *   right label: (text ? text + " " : "") + icons.join(" ")
 *   run:         text + (text ? " " : "") + icons.join(" ")
 *   colspan:     the left rule
 */
const wiki = (d: unknown) => toWikitext(migrateDiagram(d as RouteDiagram));

describe("migrateDiagram", () => {
  it("leads a left label with its logos, as the old serializer did", () => {
    expect(wiki({ rows: [{ left: { text: "Euston", icons: ["gb|rail"] }, cells: ["KBHFe"] }] })).toBe(
      "{{rint|gb|rail}} Euston! !KBHFe",
    );
  });

  it("trails a right label with its logos", () => {
    expect(wiki({ rows: [{ right: { text: "OOC", icons: ["gb|rail"] }, cells: ["BHF"] }] })).toBe(
      "BHF~~OOC {{rint|gb|rail}}",
    );
  });

  it("separates several logos with single spaces", () => {
    expect(
      wiki({ rows: [{ left: { text: "X", icons: ["gb|rail", "london|underground"] }, cells: ["BHF"] }] }),
    ).toBe("{{rint|gb|rail}} {{rint|london|underground}} X! !BHF");
  });

  it("keeps a whole-label link on the text, not on the logos", () => {
    // The link wrapped only the text before, and the label-level link would be dropped
    // once `text` became an array — the serializer only honours it for a plain string.
    expect(
      wiki({ rows: [{ left: { text: "Euston", link: true, icons: ["gb|rail"] }, cells: ["KBHFe"] }] }),
    ).toBe("{{rint|gb|rail}} [[Euston]]! !KBHFe");
  });

  it("keeps a whole-label station link", () => {
    expect(
      wiki({ rows: [{ left: { rws: "Birmingham New Street", icons: ["birmingham"] }, cells: ["BHF"] }] }),
    ).toBe("{{rint|birmingham}} {{rws|Birmingham New Street}}! !BHF");
  });

  it("trails a RUN's logos after its own text", () => {
    expect(
      wiki({ rows: [{ right: [{ text: "St Pancras", icons: ["london|underground"] }], cells: ["BHF"] }] }),
    ).toBe("BHF~~St Pancras {{rint|london|underground}}");
  });

  it("adds no space for a run that had no text of its own", () => {
    // The old code emitted `${s}${s ? " " : ""}${icons}` — no text meant no space, and
    // the neighbouring run carried it. Getting this wrong would double the gap.
    expect(wiki({ rows: [{ left: [{ icons: ["air"] }, " X"], cells: ["STR"] }] })).toBe(
      "{{rint|air}} X! !STR",
    );
  });

  it("treats a colspan row like a left label", () => {
    expect(
      wiki({ rows: [{ type: "colspan", text: "interchange here", icons: ["gb|rail"] }] }),
    ).toBe("-colspan-1\n{{rint|gb|rail}} interchange here");
  });

  it("keeps whole-label italic wrapping everything, logos included", () => {
    expect(wiki({ rows: [{ left: { text: "note", italic: true, icons: ["air"] }, cells: ["STR"] }] })).toBe(
      "''{{rint|air}} note''! !STR",
    );
  });

  it("migrates logos nested inside a slot and inside a split", () => {
    expect(
      wiki({ rows: [{ left: { dist: "0", main: { text: "X", icons: ["air"] } }, cells: ["STR"] }] }),
    ).toBe("{{rint|air}} X~~0! !STR");
    expect(
      wiki({ rows: [{ right: [{ split: [[{ text: "a", icons: ["air"] }], "b"] }], cells: ["STR"] }] }),
    ).toBe("STR~~{{BSsplit|a {{rint|air}}|b}}");
  });

  it("accepts a single icon written without the array wrapper", () => {
    expect(
      wiki({ rows: [{ left: { text: "X", icons: { region: "london", name: "underground" } }, cells: ["STR"] }] }),
    ).toBe("{{rint|london|underground}} X! !STR");
  });

  it("merges the seams the conversion leaves behind", () => {
    // A run carrying both text and logos becomes text + space + logos, and the text
    // half is an object with nothing on it but `text`. Left as-is the output shows the
    // conversion's seams: `{ text: " Hello" }, " "` where `" Hello "` says the same.
    const d = migrateDiagram({
      rows: [{ right: [{ text: " Hello", icons: ["bus|1", "bus|1"] }], cells: ["BHF"] }],
    } as never);
    expect((d.rows[0] as { right: unknown }).right).toEqual([
      " Hello ",
      { icon: "bus|1" },
      " ",
      { icon: "bus|1" },
    ]);
  });

  it("collapses a marks-free object run to a bare string", () => {
    const d = migrateDiagram({
      rows: [{ right: [{ text: "a" }, { text: "b" }, { icons: ["air"] }], cells: ["BHF"] }],
    } as never);
    expect((d.rows[0] as { right: unknown }).right).toEqual(["ab", { icon: "air" }]);
  });

  it("keeps an object run that carries marks", () => {
    const d = migrateDiagram({
      rows: [{ right: [{ text: "a", italic: true }, { icons: ["air"] }], cells: ["BHF"] }],
    } as never);
    expect((d.rows[0] as { right: unknown }).right).toEqual([
      { text: "a", italic: true },
      { icon: "air" },
    ]);
  });

  it("leaves a current diagram completely alone", () => {
    const current: RouteDiagram = {
      rows: [{ left: [{ icon: "gb|rail" }, " ", "Euston"], cells: ["KBHFe"] } as never],
    };
    expect(migrateDiagram(current)).toBe(current); // same object, not a copy
    expect(needsMigration(current)).toBe(false);
  });

  it("is idempotent", () => {
    const old = { rows: [{ left: { text: "X", icons: ["air"] }, cells: ["STR"] }] } as unknown as RouteDiagram;
    const once = migrateDiagram(old);
    expect(migrateDiagram(once)).toBe(once);
    expect(toWikitext(migrateDiagram(once))).toBe(toWikitext(once));
  });

  it("spots an old diagram however deeply the icons are buried", () => {
    expect(needsMigration({ rows: [{ left: { text: "X", icons: ["air"] } }] })).toBe(true);
    expect(needsMigration({ rows: [{ right: [{ split: [[{ icons: ["air"] }]] }] }] })).toBe(true);
    expect(needsMigration({ rows: [{ left: "plain", cells: ["STR"] }] })).toBe(false);
  });
});

describe("canonicalizeDiagram", () => {
  const right = (d: RouteDiagram) => (d.rows[0] as { right: unknown }).right;
  const of = (runs: unknown) =>
    canonicalizeDiagram({ rows: [{ right: runs, cells: ["BHF"] }] } as never);

  it("tidies a document that is already current", () => {
    // `migrateDiagram` stops early here and returns the same object, which is right for
    // a load-time call. Format is a deliberate action, so it goes further.
    expect(right(of([{ text: "a" }, { text: "b" }, { icon: "air" }]))).toEqual([
      "ab",
      { icon: "air" },
    ]);
  });

  it("still migrates an old document on the way", () => {
    expect(right(of([{ text: "X", icons: ["air"] }]))).toEqual(["X ", { icon: "air" }]);
  });

  it("changes how a CURRENT document reads, never what it says", () => {
    // The property that makes this safe behind a Format button. Scoped to documents
    // that are already current: for an old one the wikitext is SUPPOSED to change,
    // because today's serializer drops its logos entirely. That case is covered by the
    // migrateDiagram tests, which assert the old output instead.
    const cases: unknown[] = [
      [{ text: "a" }, { text: "b" }],
      [{ text: "X" }, " ", { icon: "air" }, " ", { icon: "bus" }],
      [{ text: "a|b", italic: true }],
      [{ rws: "Liverpool|Lime Street" }, " ", { icon: "gb|rail" }],
      [{ split: [[{ text: "a" }, { text: "b" }], "c"] }],
      ["keep\\|escaped"],
    ];
    for (const runs of cases) {
      const before = toWikitext({ rows: [{ right: runs, cells: ["BHF"] }] } as never);
      expect(toWikitext(of(runs)), JSON.stringify(runs)).toBe(before);
    }
  });

  it("doesn't array-wrap a text value that was a plain string", () => {
    // Everything goes through the run pipeline, which returns an array. Assigning that
    // straight to `text` rewrote `"text": "X"` as `"text": ["X"]` on Format — same value,
    // written worse, on every label carrying a mark.
    const row = { left: { text: "Handsacre Junction", italic: true }, cells: ["STR"] };
    expect(canonicalizeDiagram({ rows: [row] } as never).rows[0]).toEqual(row);
  });

  it("keeps an array when it holds more than one run", () => {
    const row = { left: { text: ["a ", { rws: "B" }], italic: true }, cells: ["STR"] };
    expect(canonicalizeDiagram({ rows: [row] } as never).rows[0]).toEqual(row);
  });

  it("leaves a plain string label alone", () => {
    expect(right(of("Euston"))).toBe("Euston");
  });
});
