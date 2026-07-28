import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import { computeLayout } from "./layout";

// The branch fragment proven in the T1 geometry spike (.context/rdt-spike):
//   col0: STR / ABZrg / STR   (main line, continuous)
//   col1:  -   / STRc3 / STR   (branch peels right)
// plus an overlay stack, a half-width dSTR, and a colspan legend row.
const diagram: RouteDiagram = {
  map: { template: "Routemap", params: [{ name: "title", value: "spike branch" }] },
  rows: [
    { cells: ["STR"] },
    { left: "Handsacre Jn", cells: ["ABZrg", "STRc3"] },
    { cells: ["STR", ["STR", "exSTR"]] },
    { cells: [{ code: "dSTR", title: "half lane" }] },
    { type: "colspan", text: "interchange with National Rail" },
  ],
};

describe("computeLayout", () => {
  const layout = computeLayout(diagram);

  it("counts columns and preserves row order", () => {
    expect(layout.columns).toBe(2);
    expect(layout.rows).toHaveLength(5);
    expect(layout.rows[1]?.index).toBe(1);
  });

  it("flows icon cells in order; width is left to the SVG (spacer:null)", () => {
    const branch = layout.rows[1]?.cells; // ABZrg | STRc3
    expect(branch?.[0]).toMatchObject({ column: 0, spacer: null });
    expect(branch?.[0]?.icons.map((i) => i.code)).toEqual(["ABZrg"]);
    expect(branch?.[1]).toMatchObject({ column: 1, spacer: null });
    expect(branch?.[1]?.icons.map((i) => i.code)).toEqual(["STRc3"]);
  });

  it("carries icon metadata (title/href) through", () => {
    const half = layout.rows[3]?.cells[0]?.icons[0];
    expect(half).toMatchObject({ code: "dSTR", title: "half lane" });
  });

  it("preserves overlay stacks in order", () => {
    const overlay = layout.rows[2]?.cells[1]?.icons.map((i) => i.code);
    expect(overlay).toEqual(["STR", "exSTR"]);
  });

  it("normalizes a lone side label into the `main` slot", () => {
    // `main`, not `dist`: a single label is the wiki's positional default, and the
    // whole four-slot scheme hangs off getting that one right.
    expect(layout.rows[1]?.left.main).toEqual({ text: "Handsacre Jn" });
    expect(layout.rows[1]?.left.dist).toBeNull();
    expect(layout.rows[0]?.left.main).toBeNull();
  });

  it("carries all four slots for a side that uses them", () => {
    const d: RouteDiagram = {
      rows: [{ left: { dist: "0 km", main: "Euston", remark: "terminus" }, cells: ["KBHFa"] }],
    };
    const side = computeLayout(d).rows[0]!.left;
    expect(side.dist).toEqual({ text: "0 km" });
    expect(side.main).toEqual({ text: "Euston" });
    expect(side.remark).toEqual({ text: "terminus" });
    expect(side.outer).toBeNull();
  });

  it("renders colspan rows with no cells", () => {
    const legend = layout.rows[4];
    expect(legend?.colspan?.text).toBe("interchange with National Rail");
    expect(legend?.cells).toHaveLength(0);
  });

  it("keeps every empty column (incl. trailing) as full-width spacers for centering", () => {
    const d: RouteDiagram = { rows: [{ cells: [null, "STR", null] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells).toHaveLength(3); // trailing null kept so the row stays centred
    expect(row?.cells[0]).toMatchObject({ column: 0, spacer: 1, icons: [] });
    expect(row?.cells[1]).toMatchObject({ column: 1, spacer: null });
    expect(row?.cells[1]?.icons.map((i) => i.code)).toEqual(["STR"]);
    expect(row?.cells[2]).toMatchObject({ column: 2, spacer: 1, icons: [] });
  });

  it("treats a lone width-prefix token as a sized spacer, not an icon", () => {
    const d: RouteDiagram = { rows: [{ cells: ["d", "STR"] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells[0]).toMatchObject({ column: 0, spacer: 0.5, icons: [] });
    expect(row?.cells[1]?.icons.map((i) => i.code)).toEqual(["STR"]);
  });

  it("packs two half-width icons where one full icon sits (aspect ratio does the sizing)", () => {
    // ["STR"] over ["dSTR","dSTR"]: the model just lists icons as-is; the renderer
    // sizes each dSTR at half via its SVG, so two of them equal one STR above.
    const d: RouteDiagram = { rows: [{ cells: ["STR"] }, { cells: ["dSTR", "dSTR"] }] };
    const l = computeLayout(d);
    expect(l.rows[0]?.cells).toHaveLength(1);
    expect(l.rows[1]?.cells).toHaveLength(2);
    expect(l.rows[1]?.cells.every((c) => c.spacer === null)).toBe(true);
  });

  it("resolves a semantic icon object cell to its BSicon code", () => {
    const d: RouteDiagram = {
      rows: [{ cells: [{ kind: "track", formation: "tunnel", entry: "start" }] }],
    };
    const [row] = computeLayout(d).rows;
    expect(row?.cells[0]?.icons[0]?.code).toBe("tSTRa");
    expect(row?.cells[0]?.spacer).toBeNull();
  });

  it("resolves a semantic spacer object to a width-prefix spacer cell", () => {
    const d: RouteDiagram = { rows: [{ cells: [{ kind: "spacer", width: "half" }, "STR"] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells[0]).toMatchObject({ spacer: 0.5, icons: [] }); // "d" -> half spacer
    expect(row?.cells[1]?.icons[0]?.code).toBe("STR");
  });

  it("does not misclassify stacked-prefix or corner-suffix icons as spacers", () => {
    const d: RouteDiagram = { rows: [{ cells: ["etdKRZ", "STRc3", "cSTR"] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells.map((c) => c.spacer)).toEqual([null, null, null]);
    expect(row?.cells.map((c) => c.icons[0]?.code)).toEqual(["etdKRZ", "STRc3", "cSTR"]);
  });

  it("applies diagram-level defaults (state) to objects AND raw string codes", () => {
    const d: RouteDiagram = {
      defaults: { state: "disused" },
      rows: [
        {
          cells: [
            { kind: "track" }, // object without state -> inherits
            { kind: "station", state: "disused-primary" }, // per-icon state wins
            "STR", // raw string -> decoded, ex applied
            "exKBHFe", // raw string that already has a state -> unchanged
          ],
        },
      ],
    };
    const [row] = computeLayout(d).rows;
    expect(row?.cells[0]?.icons[0]?.code).toBe("exSTR");
    expect(row?.cells[1]?.icons[0]?.code).toBe("xBHF");
    expect(row?.cells[2]?.icons[0]?.code).toBe("exSTR"); // "STR" + default disused
    expect(row?.cells[3]?.icons[0]?.code).toBe("exKBHFe"); // keeps its own ex
  });

  it("leaves un-decodable (Tier-3) string codes verbatim under defaults", () => {
    const d: RouteDiagram = { defaults: { state: "disused" }, rows: [{ cells: ["STR2\\STRc3"] }] };
    const [row] = computeLayout(d).rows;
    expect(row?.cells[0]?.icons[0]?.code).toBe("STR2\\STRc3");
  });

  it("tolerates a row with no cells (mid-edit / label-only) without throwing", () => {
    // Valid JSON that omits the type-required `cells` array must render as an
    // empty row, not throw "Cannot read properties of undefined (reading 'length')".
    const d = { rows: [{ left: "Handsacre Jn" }, { cells: ["STR"] }] } as unknown as RouteDiagram;
    const layout = computeLayout(d);
    expect(layout.rows[0]?.cells).toEqual([]);
    expect(layout.rows[1]?.cells[0]?.icons[0]?.code).toBe("STR");
  });
});
