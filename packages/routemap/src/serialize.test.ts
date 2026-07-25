import { describe, expect, it } from "vitest";
import { toWikitext } from "./serialize";

describe("toWikitext", () => {
  it("emits the map body only (row lines, no {{Routemap}} wrapper)", () => {
    const out = toWikitext({ rows: [{ cells: ["STR"] }, { cells: ["BHF"] }] });
    expect(out).toBe("STR\nBHF");
    expect(out).not.toContain("{{Routemap");
    expect(out).not.toContain("| map =");
  });

  it("joins cells with \\, overlays with !~, keeps spacers/empties", () => {
    const out = toWikitext({
      rows: [{ cells: ["CONTg", null, null, null] }, { cells: [["STR", "exSTR"], "d", null] }],
    });
    expect(out).toContain("CONTg\\\\\\"); // 3 trailing empties
    expect(out).toContain("STR!~exSTR\\d\\"); // overlay, spacer "d", trailing empty
  });

  it("emits left/right labels around cells", () => {
    const out = toWikitext({ rows: [{ left: "Euston", right: "note", cells: ["STR"] }] });
    expect(out).toContain("Euston! !STR~~note");
  });

  it("serializes rws, generic links, rint logos, italic", () => {
    const out = toWikitext({
      rows: [
        {
          left: {
            text: ["to ", { rws: "Liverpool|Lime Street" }, " & ", { text: "the WCML", link: true }],
            italic: true,
          },
          cells: ["STR"],
        },
        { left: { rws: "Birmingham New Street", icons: ["birmingham"] }, cells: ["BHF"] },
      ],
    });
    expect(out).toContain("{{rws|Liverpool|Lime Street}}");
    expect(out).toContain("[[the WCML]]");
    expect(out).toMatch(/''to .*''! !STR/); // italic-wrapped left label
    expect(out).toContain("{{rint|birmingham}} {{rws|Birmingham New Street}}! !BHF"); // logo before station
  });

  it("wraps a single run in bold/italic marks", () => {
    const out = toWikitext({
      rows: [{ left: ["plain ", { text: "loud", bold: true }, " ", { text: "soft", italic: true }], cells: ["STR"] }],
    });
    expect(out).toContain("'''loud'''");
    expect(out).toContain("''soft''");
  });

  it("wraps multi-line text in {{BSsplit}} and emits colspans", () => {
    const out = toWikitext({
      rows: [
        { right: "pedestrian walkway to|St Pancras International", cells: ["BHF"] },
        { type: "colspan", text: ["interchange with ", { text: "National Rail", link: true }], icons: ["gb|rail"] },
      ],
    });
    expect(out).toContain("~~{{BSsplit|pedestrian walkway to|St Pancras International}}");
    expect(out).toContain("-colspan-1\n{{rint|gb|rail}} interchange with [[National Rail]]");
  });

  it("does not throw on a row with no cells (label-only / mid-edit paste)", () => {
    // A valid-JSON row that omits the (type-required) `cells` array must not
    // crash serialization — this took down the whole editor via the wikitext memo.
    const out = toWikitext({ rows: [{ left: "Handsacre Jn" } as never] });
    expect(out).toBe("Handsacre Jn! !");
  });
});

describe("toWikitext (diagram defaults)", () => {
  it("threads diagram-level defaults (state) into serialized cells (objects + strings)", () => {
    const out = toWikitext({ defaults: { state: "disused" }, rows: [{ cells: [{ kind: "track" }, "STR"] }] });
    expect(out).toBe("exSTR\\exSTR"); // both the object and the decodable string inherit ex
  });
});
