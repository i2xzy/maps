import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import { FULL_CELL, HALF_CELL } from "./types";
import { computeLayout } from "./layout";

// The branch fragment proven in the T1 geometry spike (.context/rdt-spike):
//   col0: STR / ABZrg / STR   (main line, continuous)
//   col1:  -   / STRc3 / STR   (branch peels right)
// plus an overlay stack, a half-width dSTR, and a colspan legend row.
const diagram: RouteDiagram = {
  map: { title: "spike branch" },
  rows: [
    { cells: ["STR"] },
    { left: "Handsacre Jn", cells: ["ABZrg", "STRc3"] },
    { cells: ["STR", ["STR", "exSTR"]] },
    { cells: [{ code: "dSTR", title: "half lane" }] },
    { type: "colspan", text: "interchange with National Rail" },
  ],
};

// Native widths as the vendoring step would report them (d = half).
const widthOf = (code: string) => (code.startsWith("d") ? HALF_CELL : FULL_CELL);

describe("computeLayout", () => {
  const layout = computeLayout(diagram, widthOf);

  it("sizes the canvas from columns x rows on a uniform 500 grid", () => {
    expect(layout.columns).toBe(2);
    expect(layout.width).toBe(2 * FULL_CELL);
    expect(layout.height).toBe(5 * FULL_CELL);
  });

  it("places each cell at (col*500, row*500)", () => {
    const branch = layout.rows[1]?.cells; // ABZrg | STRc3
    expect(layout.rows[1]?.y).toBe(FULL_CELL);
    expect(branch?.[0]).toMatchObject({ column: 0, x: 0, width: FULL_CELL });
    expect(branch?.[1]).toMatchObject({ column: 1, x: FULL_CELL, width: FULL_CELL });
  });

  it("carries native icon widths for the renderer (d = half)", () => {
    expect(layout.rows[0]?.cells[0]?.icons[0]).toMatchObject({ code: "STR", nativeWidth: 500 });
    const half = layout.rows[3]?.cells[0]?.icons[0];
    expect(half).toMatchObject({ code: "dSTR", nativeWidth: 250, title: "half lane" });
  });

  it("preserves overlay stacks in order", () => {
    const overlay = layout.rows[2]?.cells[1]?.icons.map((i) => i.code);
    expect(overlay).toEqual(["STR", "exSTR"]);
  });

  it("normalizes side labels", () => {
    expect(layout.rows[1]?.left).toEqual({ text: "Handsacre Jn" });
    expect(layout.rows[0]?.left).toBeNull();
  });

  it("renders colspan rows full-width with no cells", () => {
    const legend = layout.rows[4];
    expect(legend?.colspan).toBe("interchange with National Rail");
    expect(legend?.cells).toHaveLength(0);
  });

  it("skips empty cells but keeps column indices", () => {
    const d: RouteDiagram = { rows: [{ cells: [null, "STR", null] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells).toHaveLength(1);
    expect(row?.cells[0]).toMatchObject({ column: 1, x: FULL_CELL });
  });
});
