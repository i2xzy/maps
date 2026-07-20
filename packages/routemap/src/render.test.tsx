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

describe("RouteMap", () => {
  it("emits an <image> per icon with the resolved href", () => {
    expect(html).toContain('href="/icons/STR.svg"');
    expect(html).toContain('href="/icons/ABZrg.svg"');
    expect(html).toContain('href="/icons/STRc3.svg"');
  });

  it("renders row labels and colspan text", () => {
    expect(html).toContain("Delta Junction");
    expect(html).toContain("interchange with National Rail");
  });

  it("wraps a linked icon in an anchor and adds a title", () => {
    expect(html).toContain('href="/f/1"'); // the feature link
    expect(html).toContain("<title>a station</title>");
  });

  it("scales the half-width d-icon narrower than a full icon", () => {
    const half = renderToStaticMarkup(
      <RouteMap diagram={{ rows: [{ cells: ["dSTR"] }] }} resolveIcon={(c) => c} cellSize={40} />,
    );
    // dSTR native width 250 -> 250 * (40/500) = 20px, vs a full icon's 40px.
    expect(half).toContain('width="20"');
  });
});
