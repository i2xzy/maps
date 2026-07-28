import { describe, expect, it } from "vitest";
import corpus from "./__fixtures__/real-diagrams.json";
import realTemplates from "./__fixtures__/real-templates.json";
import { fromRoutemap, fromWikitext, mapParam, parseLabelText, toRoutemap } from "./from-wikitext";
import { toWikitext } from "./serialize";

/**
 * `Module:Routemap` trims every `~~`/`! !` field, so whitespace padding changes no
 * rendered output. Normalising the same way separates "we lost something" from "we
 * wrote the same row differently" — only the first is a defect.
 */
const norm = (line: string) => {
  const parts = line.split("! !");
  // A leading `! !` with nothing before it declares no left fields, same as omitting it.
  if (parts.length > 1 && parts[0]!.trim() === "") parts.shift();
  return parts
    .map((part) => {
      const f = part.split("~~").map((x) => x.trim());
      // Trailing empty fields are absent fields.
      while (f.length > 1 && f[f.length - 1] === "") f.pop();
      return f.join("~~");
    })
    .join("! !")
    .trim();
};

const rows = Object.entries(corpus as Record<string, string>).flatMap(([title, body]) =>
  body.split("\n").filter((l) => l.trim() !== "").map((line) => ({ title, line })),
);

describe("fromWikitext round-trip", () => {
  /**
   * The safety property for editable wikitext: parse then serialize must not change the
   * row. Anything this loses is destroyed the moment a user makes one GUI edit.
   *
   * A ratchet, not a target. 22 real diagrams, 1,036 rows. Raise the floor as the
   * remaining classes are closed; never lower it to make a change pass.
   */
  it("preserves at least 94% of real rows, semantically", () => {
    const kept = rows.filter(({ line }) => norm(toWikitext(fromWikitext(line))) === norm(line));
    expect(kept.length / rows.length).toBeGreaterThan(0.94);
  });

  it("never throws on a real row", () => {
    // A parser that crashes on real input is worse than one that misreads it: the whole
    // diagram becomes unopenable rather than one row being wrong.
    for (const { title, line } of rows) {
      expect(() => toWikitext(fromWikitext(line)), `${title}: ${line}`).not.toThrow();
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
