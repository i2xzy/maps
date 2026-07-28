import { describe, expect, it } from "vitest";
import { migrateDiagram, needsMigration } from "./migrate";
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
