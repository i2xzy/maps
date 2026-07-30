import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteMap } from "./render";
import {
  collectRintCodes,
  collectRwsArgs,
  collectTextTemplates,
  badgeTemplateCall,
  createTextResolver,
  expandableCall,
  iconTemplateCall,
  TEXT_TEMPLATES,
  textTemplateCall,
} from "./rint";
import { fromWikitext } from "./from-wikitext";
import { toWikitext } from "./serialize";
import diagrams from "./__fixtures__/real-diagrams.json";

describe("textTemplateCall", () => {
  it("recognises the station-link family and normalises the call", () => {
    expect(textTemplateCall("{{tram|Derker}}")).toBe("tram|Derker");
    expect(textTemplateCall("{{ stnlnk | Leeds }}")).toBe("stnlnk | Leeds");
  });

  it("leaves the layout family alone", () => {
    // {{BSto}} and friends expand to HTML we can't render, so the placeholder is better
    // than the expansion. Deliberately not expandable.
    expect(textTemplateCall("{{BSto|a|b}}")).toBe(null);
    expect(textTemplateCall("{{left|x}}")).toBe(null);
    expect(textTemplateCall("plain text")).toBe(null);
    expect(textTemplateCall("{{tram|x}} trailing")).toBe(null); // not a bare call
  });
});

describe("collectTextTemplates", () => {
  it("finds station links in every slot, not just main", () => {
    // `normalizeSide` only understands a plain SideLabel, so a slots-based side used to
    // hide everything but `main` from the collectors.
    const diagram = fromWikitext("{{stl|Outer}}~~{{tram|Remark}}~~{{stnlnk|Main}}! !STR");
    expect(collectTextTemplates(diagram).sort()).toEqual(["stl|Outer", "stnlnk|Main", "tram|Remark"]);
  });

  it("finds one nested inside a {{BSsplit}}", () => {
    const diagram = fromWikitext("A! !STR~~{{BSsplit|{{tram|Derker}}|second}}");
    expect(collectTextTemplates(diagram)).toContain("tram|Derker");
  });

  it("reports what the real diagrams need, deduplicated", () => {
    const calls = new Set<string>();
    for (const body of Object.values(diagrams as Record<string, string>)) {
      for (const call of collectTextTemplates(fromWikitext(body))) calls.add(call);
    }
    // Enough to be worth batching, few enough to fit in a couple of requests.
    expect(calls.size).toBeGreaterThan(40);
  });
});

describe("rendering a resolved station link", () => {
  const diagram = fromWikitext("A! !STR~~{{tram|Derker}}");

  it("renders the expansion as a real link, not a muted placeholder", () => {
    const html = renderToStaticMarkup(
      <RouteMap
        diagram={diagram}
        resolveText={createTextResolver({ "tram|Derker": "[[Derker tram stop|Derker]]" })}
        resolveHref={(ref) => `https://en.wikipedia.org/wiki/${ref.replace(/ /g, "_")}`}
      />,
    );
    expect(html).toContain("Derker_tram_stop");
    expect(html).toContain(">Derker<");
    // The placeholder styling is gone: no italic-muted span holding the raw wikitext.
    expect(html).not.toContain("{{tram|Derker}}");
  });

  it("keeps the placeholder when nothing resolves", () => {
    // Not fetched yet, or the request failed. Must degrade to today's behaviour rather
    // than rendering nothing — the label still has to say something.
    const html = renderToStaticMarkup(<RouteMap diagram={diagram} />);
    expect(html).toContain("{{tram|Derker}}");
  });

  it("resolves a station link nested in a split", () => {
    const nested = fromWikitext("A! !STR~~{{BSsplit|{{tram|Derker}}|below}}");
    const html = renderToStaticMarkup(
      <RouteMap
        diagram={nested}
        resolveText={createTextResolver({ "tram|Derker": "[[Derker tram stop|Derker]]" })}
      />,
    );
    expect(html).toContain(">Derker<");
    expect(html).toContain("below");
  });
});

describe("guarding against a misclassified template", () => {
  it("refuses an expansion that is markup rather than label text", async () => {
    // `{{BSsrws}}` reads like a station link and expands to a <table> with templatestyles.
    // It was in TEXT_TEMPLATES on the strength of its name until the expansions were
    // actually checked. Names are not evidence; this is the backstop for the next one.
    expect(textTemplateCall("{{BSsrws|Manchester|Piccadilly}}")).toBe(null);

    const { expandTextTemplates } = await import("./rint");
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ expandtemplates: { wikitext: '<table class="x">markup</table>' } }),
      )) as typeof fetch;
    try {
      // Force a name through the whitelist to prove the fetch-side guard fires too.
      TEXT_TEMPLATES.add("madeup");
      const out = await expandTextTemplates(["madeup|x"]);
      expect(out["madeup|x"]).toBeUndefined();
    } finally {
      TEXT_TEMPLATES.delete("madeup");
      globalThis.fetch = original;
    }
  });
});

describe("collectors see every slot, not just main", () => {
  // All three collectors used `normalizeSide`, which only understands a plain SideLabel —
  // so a slots-based side returned null and a logo or station link in `remark`/`dist`/
  // `outer` was never fetched, and rendered as nothing at all.
  const slotted = {
    rows: [
      {
        left: {
          outer: [{ icon: "london|underground" }],
          remark: [{ rws: "Liverpool|Lime Street" }],
          dist: [{ raw: "{{stnlnk|Shepley}}" }],
          main: ["plain"],
        },
        cells: ["STR"],
      },
    ],
  } as unknown as Parameters<typeof collectRwsArgs>[0];

  it("finds a {{rws}} link in a remark slot", () => {
    expect(collectRwsArgs(slotted)).toEqual(["Liverpool|Lime Street"]);
  });

  it("finds a {{rint}} logo in an outer slot", () => {
    expect(collectRintCodes(slotted)).toEqual(["london|underground"]);
  });

  it("finds a station-link template in a dist slot", () => {
    expect(collectTextTemplates(slotted)).toEqual(["stnlnk|Shepley"]);
  });

  it("still honours whole-label rws sugar on a colspan row", () => {
    // `{ rws }` with no text is a single station run; the walker must not lose that.
    const colspan = { rows: [{ type: "colspan", rws: "Edinburgh|Waverley" }] } as unknown as Parameters<
      typeof collectRwsArgs
    >[0];
    expect(collectRwsArgs(colspan)).toEqual(["Edinburgh|Waverley"]);
  });
});

describe("file-producing templates render as logos", () => {
  it("turns {{rmri}} into an image, not a placeholder", () => {
    const diagram = fromWikitext("A! !STR~~{{rmri|u}}");
    const html = renderToStaticMarkup(
      <RouteMap
        diagram={diagram}
        resolveText={createTextResolver({
          "rmri|u": "[[File:Arrow Blue Up 001.svg|10px|alt=Up arrow|link=]]",
        })}
      />,
    );
    // Spaces, not underscores: parseRintExpansion normalises MediaWiki titles, so the url
    // is percent-encoded rather than underscore-joined.
    expect(html).toContain("Arrow%20Blue%20Up%20001.svg");
    expect(html).toContain('alt="Up arrow"');
    expect(html).not.toContain("{{rmri|u}}");
  });

  it("carries the size the template asked for", () => {
    const diagram = fromWikitext("A! !STR~~{{ric|Kolkata Metro|orange}}");
    const html = renderToStaticMarkup(
      <RouteMap
        diagram={diagram}
        resolveText={createTextResolver({
          "ric|Kolkata Metro|orange": "[[File:Kolkata Metro Orange Line.svg|16px|link=X]]",
        })}
      />,
    );
    expect(html).toMatch(/width="16"|width:16px|16px/);
  });

  it("keeps the placeholder when the expansion holds no file", () => {
    // {{rcb}} expands to a styled <span>, so there's nothing to draw. Degrading to the
    // placeholder is the point — an empty label would lose the content entirely.
    const diagram = fromWikitext("A! !STR~~{{rmri|u}}");
    const html = renderToStaticMarkup(
      <RouteMap diagram={diagram} resolveText={createTextResolver({ "rmri|u": "<span>M2</span>" })} />,
    );
    expect(html).toContain("{{rmri|u}}");
  });

  it("classifies each family and excludes the one that only looks related", () => {
    expect(iconTemplateCall("{{rmri|u}}")).toBe("rmri|u");
    expect(iconTemplateCall("{{ric|Kolkata Metro|orange}}")).toBe("ric|Kolkata Metro|orange");
    expect(iconTemplateCall("{{tram|Derker}}")).toBe(null); // text family, not icon
    expect(iconTemplateCall("{{rcb|Sofia Metro|M2|croute}}")).toBe(null); // a styled span
    expect(expandableCall("{{tram|Derker}}")).toBe("tram|Derker");
    expect(expandableCall("{{rmri|u}}")).toBe("rmri|u");
    expect(expandableCall("{{BSto|a|b}}")).toBe(null);
  });

  it("collects both families in one list, so they share one request", () => {
    const diagram = fromWikitext("{{rmri|u}}! !STR~~{{tram|Derker}}");
    expect(collectTextTemplates(diagram).sort()).toEqual(["rmri|u", "tram|Derker"]);
  });
});

describe("{{enlarge}} is a file, not a text wrapper", () => {
  it("renders the magnifier glyph its argument names", () => {
    // Reads like `{{small|x}}` and behaves like `{{rint}}`: the argument is a LINK TARGET
    // and the expansion is a File. Grouped by what it expands to, not what it looks like.
    expect(iconTemplateCall("{{enlarge|Manchester Metrolink}}")).toBe("enlarge|Manchester Metrolink");
    const diagram = fromWikitext("A! !STR~~{{enlarge|Foo}}");
    const html = renderToStaticMarkup(
      <RouteMap
        diagram={diagram}
        resolveText={createTextResolver({
          "enlarge|Foo": "[[File:Gnome-searchtool.svg|10px|link=Template:Foo|enlarge…]]",
        })}
      />,
    );
    expect(html).toContain("Gnome-searchtool.svg");
    expect(html).not.toContain("{{enlarge|Foo}}");
  });
});

describe("a File link written straight into a label", () => {
  it("renders as an image with no resolver and no fetch", () => {
    // Real diagrams put the transport-mode glyphs in labels as already-expanded wikitext.
    // Nothing to resolve, so this must work with no `resolveText` at all — the whole
    // substitution pass used to bail out when none was supplied.
    const diagram = fromWikitext("A! !STR~~[[File:BSicon TRAM.svg|20px|link=|alt=|TRAM]]");
    const html = renderToStaticMarkup(<RouteMap diagram={diagram} />);
    expect(html).toContain("BSicon%20TRAM.svg");
    expect(html).not.toContain("[[File:");
  });

  it("leaves an ordinary wikilink alone", () => {
    // Only File/Image. Swallowing `[[Foo|Bar]]` here would turn a station link into a
    // broken image.
    const diagram = fromWikitext("A! !STR~~[[Longsight railway station|Longsight]]");
    const html = renderToStaticMarkup(<RouteMap diagram={diagram} resolveHref={(r) => `/${r}`} />);
    expect(html).toContain(">Longsight<");
    // The row's STR cell is an image, so assert no image was made FROM the link.
    expect(html).not.toMatch(/<img[^>]*Longsight/);
  });
});

describe("{{BSto}} becomes the split it expands to", () => {
  const html = (line: string) =>
    renderToStaticMarkup(<RouteMap diagram={fromWikitext(line)} resolveHref={(r) => `/${r}`} />);

  it("stacks the two lines, second italic, with no fetch", () => {
    const out = html("A! !STR~~{{BSto|Manchester|Leeds}}");
    expect(out).toContain("Manchester");
    expect(out).toContain("Leeds");
    // Our renderer builds the .RMsplit table with inline styles rather than the class, so
    // assert the structure that matters: a stacked inline-table at 90%, not a <br>.
    expect(out).toContain("display:inline-table");
    expect(out).toContain("font-size:90%");
    expect(out).not.toContain("<br");
    expect(out).toMatch(/italic[^<]*"?>Leeds|font-style:italic/);
    expect(out).not.toContain("{{BSto");
  });

  it("treats the third positional arg as a link on BOTH lines", () => {
    // Measured against the live template. Reading it as a third line — the obvious guess
    // from the name — would render the target as visible text.
    const out = html("A! !STR~~{{BSto|Manchester|Leeds|Some Article}}");
    expect(out).toContain('href="/Some Article"');
    expect(out).not.toContain(">Some Article<");
  });

  it("ignores it=, which the live template ignores too", () => {
    // `it=all` and `it=none` expand identically, so it is not an italics switch despite the
    // name. Real diagrams pass `it=all`, and it must not be mistaken for a positional arg.
    const withIt = html("A! !STR~~{{BSto|Manchester|Leeds|it=all}}");
    expect(withIt).toContain("Manchester");
    expect(withIt).not.toContain("it=all");
    expect(withIt).not.toContain('href="/it=all"');
  });

  it("still round-trips the wikitext unchanged", () => {
    // Substituted at render only. The model keeps `{ raw }`, so nothing about export moves.
    const line = "A! !STR~~{{BSto|Manchester|Leeds}}";
    const d = fromWikitext(line);
    expect(toWikitext({ ...d, rows: d.rows.map((r) => ({ ...r, src: undefined })) })).toBe(line);
  });
});

describe("layout wrappers render their content", () => {
  const html = (line: string) =>
    renderToStaticMarkup(<RouteMap diagram={fromWikitext(line)} resolveHref={(r) => `/${r}`} />);

  it("unwraps {{left}} and {{right}} to the label inside", () => {
    expect(html("A! !STR~~{{left|Longsight}}")).toContain("Longsight");
    expect(html("A! !STR~~{{left|Longsight}}")).not.toContain("{{left");
    expect(html("A! !STR~~{{right|Withington}}")).toContain("Withington");
  });

  it("takes {{float}}'s content from after its named args", () => {
    // `{{float|left=0|top=-8px|X}}` — reading the FIRST positional arg would be fine here,
    // but reading arg 1 blindly would print "left=0".
    const out = html("A! !STR~~{{float|left=0|top=-8px|Sofia University}}");
    expect(out).toContain("Sofia University");
    expect(out).not.toContain("top=-8px");
    expect(out).not.toContain("left=0");
  });

  it("parses the content, so a wikilink inside still links", () => {
    const out = html("A! !STR~~{{left|[[Longsight railway station|Longsight]]}}");
    expect(out).toContain('href="/Longsight railway station"');
    expect(out).toContain(">Longsight<");
  });

  it("renders {{pad}} as space, never as its measurement", () => {
    // Its argument is a length. Treating it as a content wrapper printed "1em" in the label.
    const out = html("A! !STR~~{{pad|1em}}");
    expect(out).not.toContain("1em");
    expect(out).not.toContain("{{pad");
  });

  it("renders {{0}} as a digit-width space", () => {
    // It hides a zero purely to reserve a digit's width, which is what U+2007 means.
    const out = html("A! !STR~~{{0}}");
    expect(out).toContain(" ");
    expect(out).not.toContain("{{0}}");
  });

  it("leaves a wrapper with no content alone", () => {
    // `{{left}}` with nothing in it has nothing to unwrap to; dropping it would silently
    // delete the run rather than show it.
    expect(html("A! !STR~~{{left}}")).toContain("{{left}}");
  });
});

describe("the escaped pipe inside a template call", () => {
  const html = (line: string) =>
    renderToStaticMarkup(<RouteMap diagram={fromWikitext(line)} resolveHref={(r) => `/${r}`} />);

  it("reads {{float{{!}}X}} as {{float|X}}", () => {
    // Authors must escape the pipe here: a real one would end the enclosing
    // {{Routemap|map=…}} parameter. Unparsed, the name came back as `float{{!}}15'`.
    const out = html("A! !STR~~{{float{{!}}15'}}");
    expect(out).toContain("15");
    expect(out).not.toContain("{{float");
  });

  it("handles named args written the same way", () => {
    const out = html("A! !STR~~{{float{{!}}left=0{{!}}top=-8px{{!}}Sofia}}");
    expect(out).toContain("Sofia");
    expect(out).not.toContain("top=-8px");
  });

  it("leaves a VISIBLE {{!}} separator alone", () => {
    // The other use of {{!}}: a literal pipe between two station links. Unescaping here would
    // split the wrapper's content in two and silently drop the first half.
    const out = html("A! !STR~~{{left|Alpha {{!}} Beta}}");
    expect(out).toContain("Alpha");
    expect(out).toContain("Beta");
  });
});

describe("{{rws}} shares the batch", () => {
  it("resolves many stations in ONE request", async () => {
    // It was one request per station: 309 across the corpus and 66 for a single diagram —
    // worse than the 10-to-2 saving the {{rint}} catalog exists to provide.
    const { expandRws } = await import("./rint");
    const urls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      urls.push(String(url));
      const text = decodeURIComponent(new URL(String(url)).searchParams.get("text") ?? "");
      // Echo one wikilink per call, in order, joined by the separator the batcher uses.
      const wikitext = text
        .split("@ROUTEMAP-SPLIT@")
        .map((call) => {
          const station = call.replace(/^\{\{rws\|/, "").replace(/\}\}$/, "");
          return `[[${station} station|${station}]]`;
        })
        .join("@ROUTEMAP-SPLIT@");
      return new Response(JSON.stringify({ expandtemplates: { wikitext } }));
    }) as typeof fetch;
    try {
      const stations = Array.from({ length: 12 }, (_, i) => `Batched${i}`);
      const out = await expandRws(stations);
      expect(urls).toHaveLength(1);
      expect(Object.keys(out)).toHaveLength(12);
      expect(out.Batched0).toEqual({ target: "Batched0 station", display: "Batched0" });

      // A repeat asks for nothing and hands back the SAME object — the editor diffs the
      // resolved map by identity to decide whether to re-render.
      const again = await expandRws(stations);
      expect(urls).toHaveLength(1);
      expect(again.Batched0).toBe(out.Batched0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("{{rcb}} route badges", () => {
  const EXPANSION =
    '<span style="color:inherit;background-color:#1C75BB;border:.075em solid #1C75BB;' +
    'border-radius:.5em;padding:0 .3em">[[Sofia Metro#M2 line|' +
    '<span style="color:white;font-weight:bold;font-size:inherit;white-space:nowrap">2</span>]]</span>';

  const html = (resolve?: Record<string, string>) =>
    renderToStaticMarkup(
      <RouteMap
        diagram={fromWikitext("A! !STR~~{{rcb|Sofia Metro|M2|croute}}")}
        resolveText={resolve ? createTextResolver(resolve) : undefined}
        resolveHref={(r) => `/${r}`}
      />,
    );

  it("pulls the link and label out of the pill markup", () => {
    const out = html({ "rcb|Sofia Metro|M2|croute": EXPANSION });
    expect(out).toContain('href="/Sofia Metro#M2 line"');
    expect(out).toContain(">2<");
    expect(out).not.toContain("{{rcb");
    // The markup itself is never emitted — only two extracted fields.
    expect(out).not.toContain("background-color");
    expect(out).not.toContain("border-radius");
  });

  it("keeps the placeholder when the shape isn't the one we checked", () => {
    // Half a badge is worse than none. Both fields must parse or nothing is substituted.
    const out = html({ "rcb|Sofia Metro|M2|croute": "<span>no link here</span>" });
    expect(out).toContain("{{rcb");
  });

  it("is the only family allowed to return markup", () => {
    // The guard that rejects markup is what makes a misfiled name fail closed — {{BSsrws}}
    // looked like a station link and expands to a table. rcb is an explicit exception
    // because we parse its shape rather than render it.
    expect(badgeTemplateCall("{{rcb|Sofia Metro|M2|croute}}")).toBe("rcb|Sofia Metro|M2|croute");
    expect(badgeTemplateCall("{{BSsrws|Manchester|Piccadilly}}")).toBe(null);
    expect(expandableCall("{{rcb|a|b}}")).toBe("rcb|a|b");
  });
});
