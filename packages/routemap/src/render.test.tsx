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
    expect(html).toMatch(/colspan="2"/i); // spans the two icon columns
  });

  it("wraps a linked icon in an anchor with alt/title", () => {
    expect(html).toContain('href="/f/1"');
    expect(html).toContain('alt="a station"');
    expect(html).toContain('title="a station"');
  });

  it("sizes a full icon to the cell and a half (d) icon to half width", () => {
    const full = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["STR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(full).toContain("width:40px");

    const half = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["dSTR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    expect(half).toContain("width:20px"); // dSTR native 250 -> 250/500 * 40
  });
});
