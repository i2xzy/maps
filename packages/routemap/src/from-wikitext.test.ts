import { describe, expect, it } from "vitest";
import corpus from "./__fixtures__/real-diagrams.json";
import realTemplates from "./__fixtures__/real-templates.json";
import { fromRoutemap, fromWikitext, mapParam, parseLabelText, toRoutemap } from "./from-wikitext";
import { toWikitext } from "./serialize";

/**
 * A row reduced to explicit SLOT ASSIGNMENTS — what the row MEANS, not how it's spelled.
 *
 * This replaced a string normaliser that trimmed each field and dropped trailing empties,
 * which was unsound on the left. Left fields are read BACKWARDS from `! !`, so a trailing
 * field is the LOW slot (`dist`) and dropping an empty one shifts every slot by one:
 * `A~~B! !STR` (dist=B, main=A) and `A~~B~~! !STR` (main=B, remark=A) squashed to the same
 * string while meaning different things. It also called 58 rows failures that differ only in
 * spelling — `X~~ ~~Label` and `X~~Label` both put Label in `main`, by the lone-field rule.
 *
 * Measured both ways over the corpus: the string version overstated nothing (so the floor
 * was never lying in the dangerous direction) and understated 6 rows.
 *
 * Transcribed from `Module:Routemap`'s rules and deliberately NOT built on our own parser —
 * an instrument that shares the implementation it measures can only agree with it.
 *
 *   left:  fields read BACKWARDS from `! !`   -> dist, main, remark, outer
 *   right: fields read FORWARDS from the icons -> dist, main, remark, outer
 *   a LONE field on either side is `main`, never `dist`
 *   anything past the 4th slot is a row property and must be carried, not dropped —
 *   dropping it made an earlier version of this agree with itself and report a flat 100%
 */
const SLOTS = ["dist", "main", "remark", "outer"] as const;

const assignSlots = (fields: string[], backwards: boolean): Record<string, unknown> => {
  const f = fields.map((x) => x.trim());
  while (f.length && f[f.length - 1] === "") f.pop(); // absent trailing fields
  if (f.length === 0) return {};
  const ordered = backwards ? [...f].reverse() : f;
  if (ordered.length === 1) return ordered[0] ? { main: ordered[0]! } : {};
  const out: Record<string, unknown> = {};
  const extra = ordered.slice(SLOTS.length).filter(Boolean);
  if (extra.length) out.extra = extra;
  ordered.slice(0, SLOTS.length).forEach((v, i) => {
    if (v) out[SLOTS[i]!] = v;
  });
  return out;
};

const norm = (line: string): string => {
  const at = line.indexOf("! !");
  const rhs = at >= 0 ? line.slice(at + 3) : line;
  const rf = rhs.split("~~");
  const icons = (rf.shift() ?? "").trim();
  return JSON.stringify({
    left: assignSlots((at >= 0 ? line.slice(0, at) : "").split("~~"), true),
    icons,
    right: assignSlots(rf, false),
  });
};

const rows = Object.entries(corpus as Record<string, string>).flatMap(([title, body]) =>
  body.split("\n").filter((l) => l.trim() !== "").map((line) => ({ title, line })),
);

/**
 * Parse and serialize with PROVENANCE STRIPPED, which is what measures the parser.
 *
 * `fromWikitext` records each row's original text and `toWikitext` re-emits it for an
 * untouched row — so measuring the round-trip without removing it scores 99.4% and tests
 * nothing but the copy. Dropping `src` puts the parser back under the microscope.
 */
const roundTrip = (line: string): string => {
  const d = fromWikitext(line);
  return toWikitext({ ...d, rows: d.rows.map((r) => ({ ...r, src: undefined })) });
};

describe("fromWikitext round-trip", () => {
  /**
   * The safety property for editable wikitext: parse then serialize must not change the
   * row. Anything this loses is destroyed the moment a user makes one GUI edit.
   *
   * A ratchet, not a target. 21 real diagrams, 917 rows. Raise the floor as the remaining
   * classes are closed; never lower it to make a change pass.
   *
   * Now 865/917 = 94.3%, and the 52 that fail are ONE feature plus one straggler: 51 are a
   * text cell (`*text`) inside the icon strip, 1 is a row property (`bg=#003399`).
   *
   * Lowered ONCE, from 94%, and only because the CORPUS was wrong: the extractor ran to
   * the end of the page rather than the end of the `{{Routemap}}` call, so 119 lines of
   * `|map2 =`, `}}<noinclude>` and `{{documentation}}` were being counted as diagram rows.
   * They round-tripped trivially, so removing them took 119 off both the numerator and the
   * denominator. Nothing about the parser changed; the ratio just stopped being flattered
   * by junk. Raised to 94% when `norm` became slot-aware — see above; that was the
   * instrument getting more honest, not the parser improving.
   */
  it("preserves at least 94% of real rows, semantically", () => {
    const kept = rows.filter(({ line }) => norm(roundTrip(line)) === norm(line));
    expect(kept.length / rows.length).toBeGreaterThan(0.94);
  });

  it("never throws on a real row", () => {
    // A parser that crashes on real input is worse than one that misreads it: the whole
    // diagram becomes unopenable rather than one row being wrong.
    for (const { title, line } of rows) {
      expect(() => roundTrip(line), `${title}: ${line}`).not.toThrow();
    }
  });

  it("reads the slots backwards on the left and forwards on the right", () => {
    // The module's own rule, and the thing prose documentation glosses over.
    const row = fromWikitext("outer~~remark~~Euston~~0 km! !KBHFa~~0~~note~~far~~farther").rows[0]!;
    expect(row).toMatchObject({
      left: { outer: "outer", remark: "remark", main: "Euston", dist: "0 km" },
      right: { dist: "0", main: "note", remark: "far", outer: "farther" },
    });
  });

  it("reads a lone field as `main`, never as `dist`", () => {
    expect(fromWikitext("Euston! !STR~~note").rows[0]).toMatchObject({
      left: "Euston",
      right: "note",
    });
  });

  it("keeps an overlay stack, including an empty base layer", () => {
    expect(fromWikitext("STR!~BHF").rows[0]).toMatchObject({ cells: [["STR", "BHF"]] });
    // `!~vHST` is an empty base with an overlay — dropping the blank makes it a plain cell.
    expect(fromWikitext("!~vHST").rows[0]).toMatchObject({ cells: [["", "vHST"]] });
  });

  it("carries wikitext it doesn't model through verbatim", () => {
    // The pipes in an unknown template are ARGUMENTS. Kept as plain text the serializer
    // would read them as line breaks and wrap the lot in a {{BSsplit}}.
    const src = "STR~~{{BSto|[[Template:X|X]]|to {{rws|Y}}|it=all}}";
    expect(toWikitext(fromWikitext(src))).toBe(src);
  });

  it("keeps a File: image whole rather than reading it as a link", () => {
    const src = "STR~~[[File:BSicon TRAM.svg|20px|link=|alt=|TRAM]]";
    expect(toWikitext(fromWikitext(src))).toBe(src);
  });

  it("keeps a multi-run mark span whole", () => {
    // The source wrote ONE pair of quotes around the span; marking each run separately
    // would emit a pair around each. See the "marks around a template" block.
    const src = "STR~~''to {{rws|Marple}}''";
    expect(toWikitext(fromWikitext(src))).toBe(src);
  });
});

describe("parseLabelText", () => {
  it("reads the templates we model into runs", () => {
    expect(parseLabelText("{{rint|gb|rail}} {{rws|Euston}}")).toEqual([
      { icon: "gb|rail" },
      " ",
      { rws: "Euston" },
    ]);
  });

  it("reads {{BSsplit}} as a split run", () => {
    expect(parseLabelText("{{BSsplit|a|b}}")).toEqual([{ split: [["a"], ["b"]] }]);
  });

  it("reads <br> as a break run, distinct from a split", () => {
    expect(parseLabelText("a<br>b")).toEqual(["a", { br: true }, "b"]);
  });

  it("reads {{!}} back as the model's escaped pipe", () => {
    // A bare `|` in the model means a line break, so a literal pipe has to be escaped.
    expect(parseLabelText("a{{!}}b")).toEqual(["a\\|b"]);
  });

  it("reads a piped wikilink, and a bare one as link:true", () => {
    expect(parseLabelText("[[Euston]]")).toEqual([{ text: "Euston", link: true }]);
    expect(parseLabelText("[[Euston station|Euston]]")).toEqual([
      { text: "Euston", link: "Euston station" },
    ]);
  });
});

describe("fromRoutemap / toRoutemap (the {{Routemap}} call)", () => {
  const templates = realTemplates as Record<string, string>;

  it("rebuilds every real wrapper byte-for-byte", () => {
    // Not "semantically" — byte-for-byte. A wrapper param is opaque to us, so the only
    // way to know none was lost or reformatted is that the text is identical. This is
    // what makes editable wikitext safe: `legend`, `top`, `navbar` and per-page styling
    // would otherwise be destroyed by one GUI edit.
    for (const [title, src] of Object.entries(templates)) {
      const d = fromRoutemap(src);
      const body = (mapParam(d, "map") ?? "").trim();
      expect(toRoutemap(d, body), title).toBe(src);
    }
  });

  it("keeps params in order, names and spacing verbatim", () => {
    const d = fromRoutemap("{{Routemap\n|navbar = X\n|title = Y\n|map =\nSTR\n}}");
    expect(d.map?.params?.map((p) => p.name)).toEqual(["navbar ", "title ", "map "]);
    // `mapParam` trims the NAME for lookup, but a value keeps every character it had —
    // including the newline before the next `|`. That is why the wrapper rebuilds
    // byte-for-byte, so it's asserted rather than trimmed away.
    expect(mapParam(d, "title")).toBe(" Y\n");
    expect(d.rows).toHaveLength(1);
  });

  it("interprets no param, not even title", () => {
    // A title we "understood" is a title we could silently reformat. It stays text.
    const d = fromRoutemap("{{Routemap|title=<b>X</b>|map=\nSTR\n}}");
    expect(mapParam(d, "title")).toBe("<b>X</b>");
  });

  it("leaves a bare map body working without a wrapper", () => {
    expect(toWikitext(fromWikitext("STR~~x"))).toBe("STR~~x");
    expect(fromRoutemap("STR~~x").map).toBeUndefined();
  });

  it("carries map2 and friends verbatim, though it can't edit their rows yet", () => {
    // {{Routemap}} takes map2/map3. Preserved as text — lossless, not yet editable.
    const src = "{{Routemap|map=\nSTR\n|map2=\nBHF\n}}";
    const d = fromRoutemap(src);
    expect(mapParam(d, "map2")).toBe("\nBHF\n");
    expect(toRoutemap(d, "STR")).toBe(src);
  });
});

describe("marks around a template", () => {
  it("marks a single link run rather than falling back to raw", () => {
    // `'''[[X|Y]]'''` is fully representable — a link run carries bold. Bailing to raw
    // here was over-conservative and it showed: 119 of the corpus's 340 raw runs were
    // spans like this, rendering as muted placeholders instead of real labels.
    expect(parseLabelText("'''[[Junction (rail)|Junctions]]'''")).toEqual([
      { text: "Junctions", link: "Junction (rail)", bold: true },
    ]);
  });

  it("marks a single rws run", () => {
    // The serializer wraps an rws run's body too, so a mark survives it.
    expect(parseLabelText("''{{rws|Marple}}''")).toEqual([{ rws: "Marple", italic: true }]);
  });

  it("keeps a MULTI-run span whole, because the quotes wrapped all of it", () => {
    // One pair of quotes in the source. Marking each run separately would emit a pair
    // around each, which is a different string — `''to ''''{{rws|Marple}}''`.
    expect(parseLabelText("''to {{rws|Marple}}''")).toEqual([
      { raw: "''to {{rws|Marple}}''" },
    ]);
  });

  it("keeps a span containing an icon whole", () => {
    // An `{ icon }` run has no field for a mark and the serializer returns before
    // wrapping, so the mark would vanish.
    expect(parseLabelText("''{{rint|gb|rail}}''")).toEqual([{ raw: "''{{rint|gb|rail}}''" }]);
  });
});

describe("provenance: exporting an imported diagram", () => {
  it("emits an untouched row's ORIGINAL text, byte for byte", () => {
    // The point of the whole mechanism: import, edit one row, copy back, and every other
    // byte is exactly as the article had it.
    const src = "{{left|{{rws|X}}}}~~ ~~ ! !\\tSTR red\\c~~ ~~&nbsp; ~~far";
    expect(toWikitext(fromWikitext(src))).toBe(src);
  });

  it("re-serializes a row the user DID change", () => {
    const d = fromWikitext("Euston! !KBHFe");
    const row = d.rows[0] as { left?: unknown };
    row.left = "Euston Square";
    expect(toWikitext(d)).toBe("Euston Square! !KBHFe");
  });

  it("protects rows the parser does NOT round-trip, which is the hard case", () => {
    // Comparing serialized text would agree only where the round-trip already works.
    // Comparing MODELS protects a row precisely because its text can't be reproduced.
    const kept = rows.filter(({ line }) => toWikitext(fromWikitext(line)) === line);
    const lossy = rows.filter(({ line }) => roundTrip(line) !== line.trim());
    expect(lossy.length).toBeGreaterThan(100); // there are plenty of these
    expect(kept.length / rows.length).toBeGreaterThan(0.99); // and provenance covers them
  });

  it("keeps provenance out of the way once a row is edited", () => {
    // A stale `src` would mean an edit that shows in the preview and not in the export.
    // Nothing has to remember to clear it: the model comparison notices.
    const d = fromWikitext("STR~~note");
    (d.rows[0] as { right?: unknown }).right = "changed";
    expect(toWikitext(d)).toBe("STR~~changed");
  });
});

describe("a mark around the whole field", () => {
  it("becomes a LABEL-level italic, not a run mark", () => {
    // What the wiki means by it, and what the model already has. Read as a run mark, a span
    // covering several runs can't distribute one pair of quotes across them, so the parser
    // used to give up and emit an opaque `{ raw }` — which then flattened on every edit.
    expect(fromWikitext("''to {{rws|A}} & {{rws|B}}''! !STR").rows[0]).toMatchObject({
      left: { text: ["to ", { rws: "A" }, " & ", { rws: "B" }], italic: true },
    });
  });

  it("does the same for bold, and folds a nested pair", () => {
    expect(fromWikitext("'''X'''! !STR").rows[0]).toMatchObject({ left: { text: "X", bold: true } });
  });

  it("leaves two separate spans alone", () => {
    // `''a'' and ''b''` also starts and ends with the marker. Stripping its outer pair
    // would give `a'' and ''b` — two labels spliced into one.
    const row = fromWikitext("''a'' and ''b''! !STR").rows[0] as { left?: unknown };
    expect(JSON.stringify(row.left)).not.toContain("and ''b");
    expect(toWikitext(fromWikitext("''a'' and ''b''! !STR"))).toBe("''a'' and ''b''! !STR");
  });

  it("keeps a colspan row's mark on the row itself", () => {
    // A colspan has its own `italic`, so it doesn't want a wrapper object around its text.
    expect(fromWikitext("-colspan-1\n''interchange here''").rows[0]).toMatchObject({
      type: "colspan",
      text: "interchange here",
      italic: true,
    });
  });
});
