import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import { diagramColumns, iconCode, normalizeCell, normalizeSide } from "./normalize";

describe("iconCode", () => {
  it("reads a bare string code", () => {
    expect(iconCode("STR")).toBe("STR");
  });
  it("reads a code from an IconRef", () => {
    expect(iconCode({ code: "BHF", href: "/f/1" })).toBe("BHF");
  });
});

describe("normalizeCell", () => {
  it("treats null and empty array as empty", () => {
    expect(normalizeCell(null)).toBeNull();
    expect(normalizeCell([])).toBeNull();
  });
  it("wraps a bare string into a single-icon stack", () => {
    expect(normalizeCell("STR")).toEqual({ stack: ["STR"] });
  });
  it("keeps an overlay array as a stack", () => {
    expect(normalizeCell(["STR", "exSTR"])).toEqual({ stack: ["STR", "exSTR"] });
  });
  it("wraps an IconRef object into a stack", () => {
    expect(normalizeCell({ code: "STR", title: "main line" })).toEqual({
      stack: [{ code: "STR", title: "main line" }],
    });
  });
  it("passes a CellObject through and drops empty stacks", () => {
    expect(normalizeCell({ stack: ["STR"], note: "x" })).toEqual({ stack: ["STR"], note: "x" });
    expect(normalizeCell({ stack: [] })).toBeNull();
  });
});

describe("normalizeSide", () => {
  it("returns null for empty input", () => {
    expect(normalizeSide(null)).toBeNull();
    expect(normalizeSide("")).toBeNull();
    expect(normalizeSide({})).toBeNull();
    expect(normalizeSide({ text: "", icons: [] })).toBeNull();
  });
  it("wraps a bare string as text", () => {
    expect(normalizeSide("Euston")).toEqual({ text: "Euston" });
  });
  it("keeps an object with text or icons", () => {
    expect(normalizeSide({ text: "Curzon", icons: ["tram"] })).toEqual({
      text: "Curzon",
      icons: ["tram"],
    });
  });
});

describe("diagramColumns", () => {
  it("honours an explicit column count", () => {
    const d: RouteDiagram = { columns: 4, rows: [{ cells: ["STR"] }] };
    expect(diagramColumns(d)).toBe(4);
  });
  it("derives from the widest grid row and ignores colspan rows", () => {
    const d: RouteDiagram = {
      rows: [
        { cells: ["STR"] },
        { cells: ["ABZrg", "STRc3"] },
        { type: "colspan", text: "note" },
      ],
    };
    expect(diagramColumns(d)).toBe(2);
  });
});
