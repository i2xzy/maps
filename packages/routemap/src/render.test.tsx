import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import { RouteMap } from "./render";

const diagram: RouteDiagram = {
  rows: [
    { cells: ["STR"] },
    { left: "Delta Junction", cells: ["ABZrg", "STRc3"] },
    { cells: [{ code: "BHF", title: "a station", href: "/f/1" }] },
    { type: "colspan", text: "interchange with National Rail" },
  ],
};

const html = renderToStaticMarkup(
  <RouteMap diagram={diagram} resolveIcon={(c) => `/icons/${c}.svg`} cellSize={40} />,
);

describe("RouteMap (HTML table)", () => {
  it("renders an HTML table with <img> icons (not SVG)", () => {
    expect(html).toContain("<table");
    expect(html).not.toContain("<svg");
    expect(html).toContain('src="/icons/STR.svg"');
    expect(html).toContain('src="/icons/ABZrg.svg"');
    expect(html).toContain('src="/icons/STRc3.svg"');
  });

  it("renders row labels and a spanning colspan row", () => {
    expect(html).toContain("Delta Junction");
    expect(html).toContain("interchange with National Rail");
    expect(html).toMatch(/colspan="3"/i); // spans label + icons + label
  });

  it("wraps a linked icon in an anchor with alt/title", () => {
    expect(html).toContain('href="/f/1"');
    expect(html).toContain('alt="a station"');
    expect(html).toContain('title="a station"');
  });

  it("sizes icons by height (aspect ratio), never an explicit width", () => {
    const full = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["STR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(full).toContain("height:40px");
    expect(full).not.toMatch(/<img[^>]*[;"]width:/); // no explicit width property (max-width is fine)

    // A half-width (d) icon renders identically — its 250x500 SVG makes it half
    // as wide on its own, so the model/HTML don't set a width either.
    const half = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["dSTR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(half).toContain('src="dSTR"');
    expect(half).toContain("height:40px");
    expect(half).not.toMatch(/<img[^>]*[;"]width:/);
  });

  it("wraps a label onto separate lines with `|` (BSsplit)", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ right: "pedestrian walkway to|St Pancras International", cells: ["BHF"] }] }}
        resolveIcon={(c) => c}
      />,
    );
    expect(out).toContain("inline-table"); // two lines -> {{BSsplit}} table
    expect(out).toContain("pedestrian walkway to");
    expect(out).toContain("St Pancras International");
  });

  it("links runs via resolveHref, including multiple links in one text value", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{
          rows: [
            {
              left: [
                "change for ",
                { text: "National Rail", link: true },
                " and ",
                { text: "the Tube", link: "London Underground" },
              ],
              cells: ["BHF"],
            },
          ],
        }}
        resolveIcon={(c) => c}
        resolveHref={(ref) => `/x/${ref.replace(/ /g, "_")}`}
      />,
    );
    expect(out).toMatch(/<a href="\/x\/National_Rail"[^>]*>National Rail<\/a>/); // link:true -> ref = text
    expect(out).toMatch(/<a href="\/x\/London_Underground"[^>]*>the Tube<\/a>/); // explicit ref
    // hover title defaults to the target ref (like a wiki [[link]])
    expect(out).toContain('title="National Rail"');
    expect(out).toContain('title="London Underground"');
    expect(out).toContain("change for "); // plain runs stay unlinked
    expect(out).not.toMatch(/<a[^>]*>change for/);
    // text links: browser-default color, underline on hover only (override app resets)
    expect(out).toMatch(/<a[^>]*class="rm-link"[^>]*>National Rail<\/a>/);
    expect(out).toContain(".rm-link{color:revert;text-decoration:none}");
    expect(out).toContain(".rm-link:hover{text-decoration:underline}");
  });

  it("stacks !~ overlays with the first icon as the in-flow base", () => {
    const out = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: [["STR", "exSTR"]] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    // base STR is in flow; overlay exSTR is absolutely positioned on top.
    expect(out).toContain('src="STR"');
    expect(out).toContain('src="exSTR"');
    expect(out).toMatch(/position:\s*absolute/i);
    // wider overlays must be free to overflow, not clamped by a max-width reset.
    expect(out).toMatch(/max-width:\s*none/i);
  });

  it("uses a bare width-prefix base to size a stacked column (no phantom image)", () => {
    const out = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: [["d", "KRZ"]] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(out).not.toContain('src="d"'); // base "d" is an empty spacer, not an image
    expect(out).toContain('src="KRZ"'); // overlay renders
    expect(out).toContain("width:20px"); // base sets the column to half of 40
  });

  it("applies italic/bold to a side label", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: { text: "St Pancras", italic: true, bold: true }, cells: ["BHF"] }] }}
        resolveIcon={(c) => c}
      />,
    );
    expect(out).toMatch(/font-style:\s*italic/i);
    expect(out).toMatch(/font-weight:\s*bold/i);
    expect(out).toMatch(/font-size:\s*90%/i); // italic labels render smaller (wiki)
  });

  it("renders inline label logos via resolveLogo(icon): string code + { file }", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{
          rows: [
            {
              left: { text: "Euston", icons: ["gb|rail", { file: "Underground (no text).svg", size: 16 }] },
              cells: ["BHF"],
            },
          ],
        }}
        resolveIcon={(c) => c}
        resolveLogo={(icon) =>
          typeof icon !== "string" && "file" in icon
            ? { url: `/logos/${icon.file}` }
            : { url: `/rint/${icon as string}`, size: 10 }
        }
      />,
    );
    expect(out).toContain("Euston");
    expect(out).toContain('src="/rint/gb|rail"'); // bare-string rint code
    expect(out).toContain('src="/logos/Underground (no text).svg"'); // { file } escape hatch
    expect(out).toContain("width:10px"); // rint's size is a width bound
    expect(out).not.toContain("BSicon_"); // logos are not BSicon-resolved
  });

  it("renders logos on a colspan row", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ type: "colspan", text: "interchange with National Rail", icons: ["gb|rail"] }] }}
        resolveIcon={(c) => c}
        resolveLogo={(icon) => (typeof icon === "string" ? { url: `/rint/${icon}` } : { url: "" })}
      />,
    );
    expect(out).toMatch(/colspan="3"/i);
    expect(out).toContain("interchange with National Rail");
    expect(out).toContain('src="/rint/gb|rail"'); // colspan logo renders
  });

  it("renders inline logos on a specific run of a split (multi-line) label", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{
          rows: [
            {
              right: {
                text: ["walkway to", "|", { text: "St Pancras", icons: ["london|underground"] }],
                italic: true,
              },
              cells: ["BHF"],
            },
          ],
        }}
        resolveIcon={(c) => c}
        resolveLogo={(icon) => (typeof icon === "string" ? { url: `/rint/${icon}` } : { url: "" })}
      />,
    );
    expect(out).toContain("inline-table"); // "|" -> two lines
    expect(out).toContain("walkway to");
    expect(out).toContain("St Pancras");
    expect(out).toContain('src="/rint/london|underground"'); // logo on the second line's run
  });

  it("renders an rws station run: resolved display + link, else nothing", () => {
    const diagram: RouteDiagram = {
      rows: [{ left: { text: ["to ", { rws: "Liverpool|Lime Street" }] }, cells: ["STR"] }],
    };
    const resolveRws = (args: string) =>
      args === "Liverpool|Lime Street"
        ? { target: "Liverpool (Lime Street) railway station", display: "Liverpool" }
        : undefined;

    const out = renderToStaticMarkup(
      <RouteMap
        diagram={diagram}
        resolveIcon={(c) => c}
        resolveRws={resolveRws}
        resolveHref={(ref) => `/w/${ref.replace(/ /g, "_")}`}
      />,
    );
    expect(out).toContain("to "); // plain run
    // display + title come from rws, href from resolveHref(target)
    expect(out).toMatch(
      /<a href="\/w\/Liverpool_\(Lime_Street\)_railway_station" title="Liverpool \(Lime Street\) railway station"[^>]*>Liverpool<\/a>/,
    );

    // unresolved -> the station renders nothing (no broken text)
    const unresolved = renderToStaticMarkup(
      <RouteMap diagram={diagram} resolveIcon={(c) => c} resolveRws={() => undefined} />,
    );
    expect(unresolved).toContain("to ");
    expect(unresolved).not.toContain("Liverpool");
    expect(unresolved).not.toContain("Lime Street");
  });

  it("accepts a whole-label rws (sugar for a single station run)", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: { rws: "Euston", icons: ["gb|rail"] }, cells: ["KBHFe"] }] }}
        resolveIcon={(c) => c}
        resolveLogo={(icon) => (typeof icon === "string" ? { url: `/rint/${icon}` } : { url: "" })}
        resolveRws={(a) => (a === "Euston" ? { target: "Euston railway station", display: "Euston" } : undefined)}
        resolveHref={(ref) => `/w/${ref.replace(/ /g, "_")}`}
      />,
    );
    expect(out).toMatch(/<a href="\/w\/Euston_railway_station"[^>]*>Euston<\/a>/);
    expect(out).toContain('src="/rint/gb|rail"'); // whole-label logo still on the outer edge
  });

  it("omits a rint logo whose code isn't resolved yet", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: { text: "X", icons: ["london|underground"] }, cells: [""] }] }}
        resolveIcon={(c) => c}
        resolveLogo={() => ({ url: "" })} // nothing resolved
      />,
    );
    expect(out).toContain("X");
    expect(out).not.toContain("<img"); // cell is a blank spacer; logo omitted until resolved
  });

  it("keeps the spaces between text runs when a label has logos", () => {
    // Regression: the label was wrapped in `inline-flex`, which makes every run a
    // flex item, and a flex item trims its own leading/trailing whitespace — so
    // " London " lost both spaces and the words ran together. A container `gap` hid
    // it by spacing every item; removing the gap exposed it.
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{
          rows: [
            {
              right: {
                text: [{ icons: ["bicycle"] }, " London ", { text: "Bridge", link: true }, " Hello"],
                icons: ["bus"],
              },
              cells: ["BHF"],
            },
          ],
        }}
        resolveIcon={(c) => c}
        resolveLogo={() => ({ url: "/f/x.svg", size: 14 })}
        resolveHref={(ref) => `/w/${ref}`}
      />,
    );
    const text = out.replace(/<[^>]+>/g, "");
    expect(text).toContain(" London Bridge Hello");
    // No flex anywhere in a label: it is inline text and must lay out as such.
    expect(out).not.toContain("inline-flex");
    expect(out).not.toContain("gap:");
  });

  it("spaces logos from text with a literal space, exactly as the wikitext does", () => {
    // Wikipedia gives label logos no margin at all — spacing is the space the author
    // typed between `{{rint|…}}` and the text. serialize.ts writes those spaces, so
    // the render has to put them in the same places or the two disagree.
    const render = (diagram: RouteDiagram) =>
      renderToStaticMarkup(
        <RouteMap diagram={diagram} resolveIcon={(c) => c} resolveLogo={() => ({ url: "/f/x.svg", size: 13 })} />,
      );
    // The label cell, with each logo collapsed to a marker so spaces are visible.
    const shape = (html: string) => {
      // Both label cells are present; take whichever one has content.
      const cells = [...html.matchAll(/text-align:(?:right|left)">(.*?)<\/td>/gs)].map((m) => m[1] ?? "");
      const cell = cells.find((c) => c.trim() !== "") ?? "";
      return cell.replace(/<img[^>]*>/g, "@").replace(/<[^>]+>/g, "");
    };

    // Left label, outer-edge icons: logos, space, text.
    expect(shape(render({ rows: [{ left: { text: "X", icons: ["air"] }, cells: ["STR"] }] }))).toBe("@ X");
    // Right label: text, space, logos.
    expect(shape(render({ rows: [{ right: { text: "X", icons: ["air"] }, cells: ["STR"] }] }))).toBe("X @");
    // Two logos in one set are separated by a space too.
    expect(shape(render({ rows: [{ left: { text: "X", icons: ["air", "bus"] }, cells: ["STR"] }] }))).toBe("@ @ X");
    // A run carrying text AND icons gets one space between them…
    expect(shape(render({ rows: [{ left: { text: [{ text: "X", icons: ["air"] }] }, cells: ["STR"] }] }))).toBe("X @");
    // …but a lone `{ icons: [...] }` run adds none, because the neighbouring text owns
    // it — which is why the author's " X" keeps its leading space.
    expect(shape(render({ rows: [{ left: { text: [{ icons: ["air"] }, " X"] }, cells: ["STR"] }] }))).toBe("@ X");
    // No authored space and no margin means they really do touch, as on the wiki.
    expect(shape(render({ rows: [{ left: { text: [{ icons: ["air"] }, "X"] }, cells: ["STR"] }] }))).toBe("@X");
  });

  it("gives label logos no margin and no flex, like Wikipedia", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: { text: "X", icons: ["air"] }, cells: ["STR"] }] }}
        resolveIcon={(c) => c}
        resolveLogo={() => ({ url: "/f/x.svg", size: 13 })}
      />,
    );
    expect(out).not.toContain("margin:0 1.5px");
    expect(out).not.toContain("inline-flex");
    expect(out).not.toContain("gap:");
    // The LABEL image aligns itself, inline — `display:block` belongs to the icon
    // row (.RMir), which is a separate cell and keeps it.
    const labelCell = /text-align:right">(.*?)<\/td>/s.exec(out)?.[1] ?? "";
    expect(labelCell).toMatch(/<img[^>]*vertical-align:middle/);
    expect(labelCell).not.toContain("display:block");
    // Stated, not inherited: a host reset of `img { display: block }` would otherwise
    // put every logo on its own line.
    expect(labelCell).toMatch(/<img[^>]*display:inline/);
  });

  it("renders a rint logo as a link (operator article) with a tooltip", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: { text: "X", icons: ["air"] }, cells: ["STR"] }] }}
        resolveIcon={(c) => c}
        // simulate expandRint having resolved the code -> file/link/alt
        resolveLogo={() => ({ url: "/f/FLUG.svg", size: 13, link: "Lists of airports", alt: "Airport interchange" })}
        resolveHref={(ref) => `/w/${ref.replace(/ /g, "_")}`}
      />,
    );
    // logo wrapped in an anchor to the operator article, hover = article title
    expect(out).toMatch(/<a href="\/w\/Lists_of_airports" title="Lists of airports"[^>]*>\s*<img[^>]*src="\/f\/FLUG.svg"/);
    expect(out).toContain('alt="Airport interchange"'); // descriptive alt on the img
  });

  it("gives a bare width-prefix cell an explicit spacer width", () => {
    const spacer = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["d", "STR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(spacer).toContain("width:20px"); // "d" = half of 40
  });
});

describe("RouteMap: per-run marks", () => {
  it("styles bold/italic on individual runs, not the whole label", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: ["plain ", { text: "loud", bold: true }, { text: "soft", italic: true }], cells: ["STR"] }] }}
        resolveIcon={(c) => c}
      />,
    );
    expect(out).toMatch(/font-weight:bold[^<]*>loud/);
    expect(out).toMatch(/font-style:italic[^<]*>soft/);
  });
});

describe("RouteMap: selection (editor)", () => {
  it("stays a pure render (no pointer cursor) without onSelect", () => {
    expect(html).not.toContain("cursor:pointer");
  });

  it("marks cells and labels as clickable when onSelect is provided", () => {
    const out = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ left: "A", cells: ["STR"] }] }} resolveIcon={(c) => c} onSelect={() => {}} />,
    );
    expect(out).toContain("cursor:pointer");
  });

  it("highlights the selected cell with an outline", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ cells: ["STR", "BHF"] }] }}
        resolveIcon={(c) => c}
        onSelect={() => {}}
        selection={{ kind: "cell", row: 0, col: 1 }}
      />,
    );
    expect(out).toContain("outline:2px solid #3182ce");
  });
});
