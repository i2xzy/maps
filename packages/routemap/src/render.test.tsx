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
    // Seven, because a row is seven columns: the four label cells per side that
    // Module:Routemap emits (outer/main/dist each side) plus the icon strip.
    expect(html).toMatch(/colspan="7"/i);
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
    // Italic is ONLY italic. We used to shrink italic labels to 90% and blame
    // Wikipedia for it, but Template:Routemap/styles.css never ties font-size to
    // italic — the 90% belongs to `.RMsplit` and `.RMsi`. The wrong trigger also
    // made the editor lossy, because it folds label-level italic onto runs and the
    // size went with it.
    expect(out).not.toMatch(/font-size:\s*90%/i);
  });

  it("renders a label-level italic exactly like the same italic on its runs", () => {
    // The editor folds label-level `italic`/`bold` onto the runs, because a TipTap
    // document only has per-run marks. That fold is only lossless if the two render
    // identically — which they didn't while label-level italic also meant 90%, so
    // touching an italic annotation label in the GUI visibly resized it.
    const cell = (diagram: RouteDiagram) =>
      /text-align:right">(.*?)<\/td>/s.exec(
        renderToStaticMarkup(<RouteMap diagram={diagram} resolveIcon={(c) => c} />),
      )?.[1] ?? "";
    const atLabel = cell({ rows: [{ left: { text: "note", italic: true }, cells: ["STR"] }] });
    const atRun = cell({ rows: [{ left: [{ text: "note", italic: true }], cells: ["STR"] }] });

    for (const html of [atLabel, atRun]) {
      expect(html).toMatch(/font-style:\s*italic/i);
      expect(html).not.toMatch(/font-size/i);
    }
    // Same for bold, the other field the fold moves.
    for (const d of [
      { rows: [{ left: { text: "note", bold: true }, cells: ["STR"] }] },
      { rows: [{ left: [{ text: "note", bold: true }], cells: ["STR"] }] },
    ] as RouteDiagram[]) {
      expect(cell(d)).toMatch(/font-weight:\s*bold/i);
      expect(cell(d)).not.toMatch(/font-size/i);
    }
  });

  it("shrinks a multi-line side label, like .RMsplit — and only in a side cell", () => {
    // `table.routemap .RMl > .RMsplit, .RMr > .RMsplit { font-size: 90% }`, with no
    // condition on italic. The rule is scoped to the main side cells, so a colspan
    // row's split is full size.
    const render = (diagram: RouteDiagram) =>
      renderToStaticMarkup(<RouteMap diagram={diagram} resolveIcon={(c) => c} />);
    const split = /display:inline-table[^"]*/;

    expect(split.exec(render({ rows: [{ left: "foo|bar", cells: ["STR"] }] }))?.[0]).toContain("font-size:90%");
    expect(split.exec(render({ rows: [{ right: "foo|bar", cells: ["STR"] }] }))?.[0]).toContain("font-size:90%");
    // Not conditional on italic any more — plain multi-line gets it too (above), and
    // a single-line italic label does not.
    expect(render({ rows: [{ left: { text: "x", italic: true }, cells: ["STR"] }] })).not.toContain("font-size:90%");
    // Colspan row: a split, but not a side cell.
    expect(
      split.exec(render({ rows: [{ type: "colspan", text: "foo|bar" }] }))?.[0],
    ).not.toContain("font-size");
  });

  it("renders inline label logos via resolveLogo(icon): string code + { file }", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{
          rows: [
            {
              left: [{ icon: "gb|rail" }, " ", { icon: { file: "Underground (no text).svg", size: 16 } }, " ", "Euston"],
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
        diagram={{ rows: [{ type: "colspan", text: [{ icon: "gb|rail" }, " ", "interchange with National Rail"] }] }}
        resolveIcon={(c) => c}
        resolveLogo={(icon) => (typeof icon === "string" ? { url: `/rint/${icon}` } : { url: "" })}
      />,
    );
    expect(out).toMatch(/colspan="7"/i);
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
                text: ["walkway to", "|", { text: "St Pancras" }, " ", { icon: "london|underground" }],
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
        diagram={{ rows: [{ left: [{ icon: "gb|rail" }, " ", { rws: "Euston" }], cells: ["KBHFe"] }] }}
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
        diagram={{ rows: [{ left: [{ icon: "london|underground" }, " ", "X"], cells: [""] }] }}
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
                text: [{ icon: "bus" }, " ", { icon: "bicycle" }, " London ", { text: "Bridge", link: true }, " Hello"],
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

    // Every space is one the author wrote. There is no implicit spacing left anywhere:
    // logos are runs, so the model says exactly what the wikitext says, which is the
    // whole point of dropping the outer-edge rule and the per-run icon list.
    const left = (text: unknown) =>
      shape(render({ rows: [{ left: text, cells: ["STR"] } as never] }));

    expect(left([{ icon: "air" }, " ", "X"])).toBe("@ X");
    expect(left(["X", " ", { icon: "air" }])).toBe("X @");
    expect(left([{ icon: "air" }, " ", { icon: "bus" }, " ", "X"])).toBe("@ @ X");
    // No authored space and no margin means they really do touch, as on the wiki.
    expect(left([{ icon: "air" }, "X"])).toBe("@X");
    // A space between two logos is a run like any other.
    expect(left([{ icon: "air" }, { icon: "bus" }])).toBe("@@");
    // And the author's own leading space survives, which is the bug that started all
    // this: an inline-flex label trimmed it and ran the words together.
    expect(left([{ icon: "air" }, " X"])).toBe("@ X");
  });

  it("gives label logos no margin and no flex, like Wikipedia", () => {
    const out = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left: [{ icon: "air" }, " ", "X"], cells: ["STR"] }] }}
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
        diagram={{ rows: [{ left: [{ icon: "air" }, " ", "X"], cells: ["STR"] }] }}
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

describe("RouteMap label slots", () => {
  const render = (left: unknown, right: unknown) =>
    renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ left, right, cells: ["BHF"] } as never] }}
        resolveIcon={(c) => c}
      />,
    );
  /** The <td>s of the single rendered row, in document order. */
  const cells = (html: string) => [...html.matchAll(/<td[^>]*>.*?<\/td>/gs)].map((m) => m[0]);

  it("keeps the row seven columns wide however many slots are used", () => {
    // The count is what aligns labels from row to row. An absent `outer` is absorbed
    // by the main cell's colspan rather than the row losing a column.
    // `/i` because React's server renderer emits `colSpan`, not `colspan`.
    const bare = cells(render("Euston", "note"));
    expect(bare).toHaveLength(5); // RMl, RMl1, icons, RMr1, RMr
    expect(bare.filter((c) => /colspan="2"/i.test(c))).toHaveLength(2);

    const full = cells(render({ main: "Euston", outer: "L" }, { main: "note", outer: "R" }));
    expect(full).toHaveLength(7); // both RMl4 and RMr4 now exist
    expect(full.filter((c) => /colspan="2"/i.test(c))).toHaveLength(0);
  });

  it("puts `remark` beside `main` in one cell, outward from the icons on each side", () => {
    const [l, , , , r] = cells(
      render({ main: "Euston", remark: "terminus" }, { main: "note", remark: "far" }),
    );
    // Position, not a regex over the markup between them: left reads remark-then-main
    // and right main-then-remark, so both run outward from the icons.
    expect(l!.indexOf("terminus")).toBeLessThan(l!.indexOf("Euston"));
    expect(r!.indexOf("note")).toBeLessThan(r!.indexOf("far"));
  });

  it("renders `remark` inline, so it sits beside `main` rather than under it", () => {
    // Module:Routemap uses a <div> here purely because "HTML Tidy forced the use of
    // div instead of span", then forces `display:inline` back in the stylesheet. A
    // block here would drop every remark onto its own line.
    const html = render({ main: "Euston", remark: "terminus" }, null);
    expect(html).toMatch(/<span style="display:inline[^"]*"[^>]*>/);
  });

  it("shrinks dist, remark and outer to 90% but never `main`", () => {
    // `.RMsi` is 90%; info2 is the only full-size slot.
    const small = render({ main: "Euston", dist: "0 km", remark: "t", outer: "o" }, null);
    expect([...small.matchAll(/font-size:90%/g)]).toHaveLength(3);

    const mainOnly = render("Euston", null);
    expect(mainOnly).not.toMatch(/font-size:\s*90%/i);
  });

  it("leaves an unused slot's cell genuinely empty", () => {
    // Not a 90% wrapper round nothing: an empty cell should carry no markup at all.
    const html = render("Euston", null);
    expect(html).toContain("></td>");
    expect(html).not.toMatch(/<span[^>]*><\/span>/);
  });

  it("aligns `main` toward the icons and `dist` away from them", () => {
    // Straight from the stylesheet, and NOT symmetric by position: `.RMl` is
    // text-align right while `.RMl1`, the cell nearer the icons, is left.
    const html = render({ main: "Euston", dist: "0 km" }, { main: "note", dist: "1" });
    const [l, l1, , r1, r] = cells(html);
    expect(l).toMatch(/text-align:right/);
    expect(l1).toMatch(/text-align:left/);
    expect(r1).toMatch(/text-align:right/);
    expect(r).toMatch(/text-align:left/);
  });
});

describe("RouteMap {{BSsplit}} runs", () => {
  const render = (right: unknown) =>
    renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ right, cells: ["BHF"] } as never] }}
        resolveIcon={(c) => c}
        resolveLogo={() => ({ url: "/logo.svg" })}
      />,
    );

  it("stacks a split run's lines in its own table", () => {
    const html = render([{ split: ["Platform 1", "Platform 2"] }]);
    expect(html).toContain("inline-table");
    expect(html).toContain("Platform 1");
    expect(html).toContain("Platform 2");
  });

  // React emits a <link rel="preload"> for every image in the document head, so
  // searching the WHOLE document for the logo url finds that instead of the <img> and
  // any ordering assertion passes vacuously. Compare inside the row only.
  const row = (right: unknown) => /<tr[\s\S]*?<\/tr>/.exec(render(right))![0];

  it("keeps a neighbouring logo OUTSIDE the stack", () => {
    // The whole reason for the run type. The logo must precede the table, not sit in
    // its first row — that's the difference between `{{rint|x}} {{BSsplit|a|b}}` and
    // `{{BSsplit|{{rint|x}} a|b}}`.
    // The logo url, not `<img>` — the row also contains the BHF cell icon.
    const html = row([{ icon: "gb|rail" }, " ", { split: ["a", "b"] }]);
    expect(html).toContain("/logo.svg");
    expect(html.indexOf("/logo.svg")).toBeLessThan(html.indexOf("inline-table"));
  });

  it("puts a logo INSIDE the stack when it's written inside a line", () => {
    const html = row([{ split: [[{ icon: "gb|rail" }, "a"], "b"] }]);
    expect(html).toContain("/logo.svg");
    expect(html.indexOf("inline-table")).toBeLessThan(html.indexOf("/logo.svg"));
  });

  it("renders two independent splits in one label", () => {
    const html = render([{ split: ["a", "b"] }, " / ", { split: ["c", "d"] }]);
    expect([...html.matchAll(/inline-table/g)]).toHaveLength(2);
  });

  it("shrinks a split run to 90% in a side cell, like the `|` sugar does", () => {
    // Both go through one component, so `.RMsplit`'s rule can't apply to only one.
    expect(render([{ split: ["a", "b"] }])).toMatch(/font-size:90%/);
    const colspan = renderToStaticMarkup(
      <RouteMap
        diagram={{ rows: [{ type: "colspan", text: [{ split: ["a", "b"] }] } as never] }}
        resolveIcon={(c) => c}
      />,
    );
    // Scoped to .RMl/.RMr, so a colspan row's split is full size.
    expect(colspan).not.toMatch(/font-size:\s*90%/);
  });
});

describe("RouteMap <br> runs", () => {
  const row = (right: unknown) =>
    /<tr[\s\S]*?<\/tr>/.exec(
      renderToStaticMarkup(
        <RouteMap diagram={{ rows: [{ right, cells: ["BHF"] } as never] }} resolveIcon={(c) => c} />,
      ),
    )![0];

  it("renders a real <br>, with no split table and no 90%", () => {
    const html = row(["a", { br: true }, "b"]);
    expect(html).toContain("<br/>");
    // The distinction that matters: no `.RMsplit` table means no shrink.
    expect(html).not.toContain("inline-table");
    expect(html).not.toMatch(/font-size:\s*90%/);
  });

  it("shrinks the split but not the <br> in the same label", () => {
    const html = row(["a", { br: true }, "b", { split: ["c", "d"] }]);
    expect(html).toContain("<br/>");
    expect(html).toContain("inline-table");
    // One 90%, from the split alone.
    expect([...html.matchAll(/font-size:90%/g)]).toHaveLength(1);
  });
});
