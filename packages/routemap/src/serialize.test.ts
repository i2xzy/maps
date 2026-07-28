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
        { left: [{ icon: "birmingham" }, " ", { rws: "Birmingham New Street" }], cells: ["BHF"] },
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
        { type: "colspan", text: [{ icon: "gb|rail" }, " ", "interchange with ", { text: "National Rail", link: true }] },
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

describe("toWikitext label slots", () => {
  // The four slots per side, as `Module:Routemap` reads them. Its grammar comment:
  //   rowProps~~linfo4~~linfo3~~linfo2~~linfo1! !(icons)~~rinfo1~~rinfo2~~rinfo3~~rinfo4~~rowProps
  const row = (left: unknown, right: unknown) =>
    toWikitext({ rows: [{ left, right, cells: ["STR"] } as never] });

  it("writes a lone label as ONE field, which is how the wiki reads it back", () => {
    // A single field is `main` by the module's own positional default. Padding it out
    // to `~~ ~~Euston` would move the label to a different slot.
    expect(row("Euston", null)).toBe("Euston! !STR");
    expect(row(null, "Euston")).toBe("STR~~Euston");
  });

  it("orders the left side outermost-first and the right side innermost-first", () => {
    // Both sides read outward from the icons, so the source order mirrors the page.
    expect(row({ dist: "0", main: "Euston", remark: "terminus", outer: "note" }, null)).toBe(
      "note~~terminus~~Euston~~0! !STR",
    );
    expect(row(null, { dist: "0", main: "Euston", remark: "terminus", outer: "note" })).toBe(
      "STR~~0~~Euston~~terminus~~note",
    );
  });

  it("pads with a space, never with nothing, so `~~~~` can't become a signature", () => {
    // Four consecutive tildes are a MediaWiki signature. The module trims each field,
    // so a space reads as absent while keeping the tilde pairs apart.
    const out = row(null, { outer: "Bridge" });
    expect(out).toBe("STR~~ ~~ ~~ ~~Bridge");
    expect(out).not.toContain("~~~~");
  });

  it("emits two fields for a dist-only label, since one field would mean `main`", () => {
    // On the LEFT, `dist` is the field nearest `! !` — so it comes LAST and the empty
    // `main` leads. Writing "1 km~~ " instead would be read back as a main label.
    expect(row({ dist: "1 km" }, null)).toBe(" ~~1 km! !STR");
    expect(row(null, { dist: "1 km" })).toBe("STR~~1 km~~ ");
  });

  it("reproduces the units header from the template's own documentation", () => {
    // The docs give `~~km! !~~km~~` for a row labelling both columns "km". We emit a
    // space where they leave a field empty; the module trims every field, so the two
    // are the same row. Anchoring on a real documented example is the point.
    const out = toWikitext({
      rows: [{ left: { dist: "km" }, right: { dist: "km" }, cells: [] } as never],
    });
    expect(out).toBe(" ~~km! !~~km~~ ");
    expect(out.replace(/ /g, "")).toBe("~~km!!~~km~~".replace(/ /g, ""));
  });

  it("omits the outer fields entirely when nothing occupies them", () => {
    // "The third and fourth pairs of tildes can be omitted if there is no content
    // following either of them."
    expect(row({ dist: "0", main: "Euston" }, null)).toBe("Euston~~0! !STR");
    expect(row(null, { dist: "0", main: "Euston" })).toBe("STR~~0~~Euston");
  });

  it("keeps the slot object and the plain label interchangeable for one label", () => {
    expect(row({ main: "Euston" }, null)).toBe(row("Euston", null));
  });

  it("carries a slot's own formatting, not just its text", () => {
    expect(row(null, { dist: { text: "0", italic: true }, main: "Euston" })).toBe(
      "STR~~''0''~~Euston",
    );
  });
});

describe("toWikitext {{BSsplit}} runs", () => {
  const right = (text: unknown) =>
    toWikitext({ rows: [{ right: text, cells: ["BHF"] } as never] });

  it("emits an explicit split as the template, keeping neighbours beside it", () => {
    // The reason this run type exists: a logo OUTSIDE the stack. With `|` sugar the
    // logo would land on line one, inside it.
    //
    // The separating space is its own run. Runs concatenate with nothing between them,
    // so spacing is the author's to state — same as it is in the wikitext.
    expect(
      right([{ icon: "gb|rail" }, " ", { split: ["Platform 1", "Platform 2"] }]),
    ).toBe("BHF~~{{rint|gb|rail}} {{BSsplit|Platform 1|Platform 2}}");
    expect(right([{ icon: "gb|rail" }, { split: ["a", "b"] }])).toBe(
      "BHF~~{{rint|gb|rail}}{{BSsplit|a|b}}",
    );
  });

  it("still lets `|` sugar split the whole label", () => {
    expect(right("a|b")).toBe("BHF~~{{BSsplit|a|b}}");
  });

  it("carries formatted runs inside a split line", () => {
    expect(right([{ split: [[{ text: "x", italic: true }], "y"] }])).toBe(
      "BHF~~{{BSsplit|''x''|y}}",
    );
  });

  it("allows more than one split in a label, which sugar cannot express", () => {
    // Confirmed on real diagrams (Parit Buntar, Marunouchi Line): sugar splits the
    // whole label, so two independent stacks in one label need explicit runs.
    expect(right([{ split: ["a", "b"] }, " / ", { split: ["c", "d"] }])).toBe(
      "BHF~~{{BSsplit|a|b}} / {{BSsplit|c|d}}",
    );
  });

  it("resolves stations and logos nested inside a split", () => {
    expect(right([{ split: [[{ rws: "Liverpool|Lime Street" }], "note"] }])).toBe(
      "BHF~~{{BSsplit|{{rws|Liverpool|Lime Street}}|note}}",
    );
  });
});

describe("toWikitext <br> runs", () => {
  const right = (text: unknown) =>
    toWikitext({ rows: [{ right: text, cells: ["BHF"] } as never] });

  it("emits a plain <br>, not a {{BSsplit}}", () => {
    // Real diagrams use both, and they are NOT interchangeable: a split carries
    // `.RMsplit`, which the stylesheet shrinks to 90% in a side cell, while `<br>`
    // text stays full size. Normalising either way resizes the label.
    expect(right(["a", { br: true }, "b"])).toBe("BHF~~a<br>b");
  });

  it("keeps <br> and {{BSsplit}} distinct in one label", () => {
    expect(right(["a", { br: true }, "b", { split: ["c", "d"] }])).toBe(
      "BHF~~a<br>b{{BSsplit|c|d}}",
    );
  });

  it("can break a line inside a split", () => {
    expect(right([{ split: [["a", { br: true }, "b"], "c"] }])).toBe(
      "BHF~~{{BSsplit|a<br>b|c}}",
    );
  });
});

describe("toWikitext pipes in runs", () => {
  const right = (text: unknown) =>
    toWikitext({ rows: [{ right: text, cells: ["BHF"] } as never] });

  it("splits an OBJECT run's text on a pipe, like a plain string", () => {
    // The renderer always split every run's text. The serializer treated an object run
    // as unbreakable, so `{ text: "a|b" }` drew as two lines and exported a RAW pipe —
    // which ends the `{{Routemap|map=…}}` parameter and breaks the template.
    expect(right([{ text: "a|b" }])).toBe("BHF~~{{BSsplit|a|b}}");
  });

  it("keeps each line's marks when a marked run splits", () => {
    expect(right([{ text: "a|b", italic: true }])).toBe("BHF~~{{BSsplit|''a''|''b''}}");
  });

  it("emits an escaped pipe as {{!}}, not as a bare pipe or a backslash", () => {
    // `\| ` means a literal pipe. A bare `|` would end the template parameter, and a
    // backslash isn't wiki syntax at all — `{{!}}` is MediaWiki's escape for this.
    expect(right(["a\\|b"])).toBe("BHF~~a{{!}}b");
    expect(right([{ text: "a\\|b", bold: true }])).toBe("BHF~~'''a{{!}}b'''");
  });

  it("mixes a real break and an escaped pipe in one run", () => {
    expect(right(["a\\|b|c"])).toBe("BHF~~{{BSsplit|a{{!}}b|c}}");
  });

  it("never breaks a station link on the pipe in its own args", () => {
    // `{{rws|Liverpool|Lime Street}}` — that pipe is an argument separator, and its
    // display text comes from the wiki, so it is not ours to split.
    expect(right([{ rws: "Liverpool|Lime Street" }])).toBe("BHF~~{{rws|Liverpool|Lime Street}}");
  });
});
