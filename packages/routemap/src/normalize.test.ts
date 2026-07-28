import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import {
  diagramColumns,
  iconCode,
  isWidthPrefix,
  normalizeCell,
  normalizeSide,
  slotOf,
  withSlot,
  prefixWidthFraction,
} from "./normalize";

describe("iconCode", () => {
  it("reads a bare string code", () => {
    expect(iconCode("STR")).toBe("STR");
  });
  it("reads a code from an IconRef", () => {
    expect(iconCode({ code: "BHF", href: "/f/1" })).toBe("BHF");
  });
  it("resolves a semantic IconObject via iconToCode", () => {
    expect(iconCode({ kind: "track", formation: "tunnel", entry: "start" })).toBe("tSTRa");
  });
  it("degrades to '' for an unknown/incomplete kind instead of throwing (mid-typing)", () => {
    expect(iconCode({ kind: "s" as never })).toBe("");
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
    expect(normalizeSide({ text: [] })).toBeNull();
  });
  it("wraps a bare string as text", () => {
    expect(normalizeSide("Euston")).toEqual({ text: "Euston" });
  });
  it("keeps an object with text", () => {
    expect(normalizeSide({ text: "Curzon" })).toEqual({ text: "Curzon" });
  });
  it("keeps a logo run inside the text, where the author put it", () => {
    // Whole-label `icons` are gone: they placed logos on an outer edge, and serialized
    // to the same wikitext as a run-level logo, so nothing could tell the two apart.
    const side = { text: [{ icon: "london|underground" }, " ", "Euston"] };
    expect(normalizeSide(side as never)).toEqual({ text: side.text });
  });
  it("treats a label of only a logo run as present, not empty", () => {
    const side = { text: [{ icon: "gb|rail" }] };
    expect(normalizeSide(side as never)).toEqual({ text: side.text });
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

describe("width prefixes", () => {
  it("recognises pure width-prefix tokens as spacers", () => {
    expect(isWidthPrefix("o")).toBe(true);
    expect(isWidthPrefix("c")).toBe(true);
    expect(isWidthPrefix("d")).toBe(true);
    expect(isWidthPrefix("cd")).toBe(true);
    expect(isWidthPrefix("_")).toBe(true);
    expect(isWidthPrefix("_d")).toBe(true);
  });

  it("is safe on a missing/non-string token (malformed cell can't crash)", () => {
    expect(isWidthPrefix(undefined as never)).toBe(false);
    expect(isWidthPrefix(null as never)).toBe(false);
  });

  it("rejects icon codes — a ROOT means it is an icon, not a spacer", () => {
    expect(isWidthPrefix("")).toBe(false);
    expect(isWidthPrefix("STR")).toBe(false);
    expect(isWidthPrefix("cSTR")).toBe(false); // quarter-width icon, still an icon
    expect(isWidthPrefix("STRc3")).toBe(false); // corner suffix, full-width icon
    expect(isWidthPrefix("etdKRZ")).toBe(false); // stacked prefixes + ROOT
    expect(isWidthPrefix("dc")).toBe(false); // wrong prefix order
  });

  it("sums prefix letters into a fraction of a full cell (additive)", () => {
    expect(prefixWidthFraction("o")).toBe(1 / 8);
    expect(prefixWidthFraction("c")).toBe(0.25);
    expect(prefixWidthFraction("d")).toBe(0.5);
    expect(prefixWidthFraction("cd")).toBe(0.75);
    expect(prefixWidthFraction("_")).toBe(1);
    expect(prefixWidthFraction("_d")).toBe(1.5);
    expect(prefixWidthFraction("b")).toBe(2);
  });
});

describe("slotOf / withSlot", () => {
  it("reads a plain label as `main`, and every other slot as empty", () => {
    expect(slotOf("Euston", "main")).toBe("Euston");
    expect(slotOf("Euston", "dist")).toBeUndefined();
    expect(slotOf("Euston", "remark")).toBeUndefined();
  });

  it("reads each slot of a slots object", () => {
    const side = { dist: "0 km", main: "Euston" };
    expect(slotOf(side, "dist")).toBe("0 km");
    expect(slotOf(side, "main")).toBe("Euston");
    expect(slotOf(side, "outer")).toBeUndefined();
  });

  it("keeps a plain label plain when only `main` is edited", () => {
    // Promoting on every keystroke would rewrite the document wholesale and bury a
    // one-word change in a diff.
    expect(withSlot("Euston", "main", "Euston Square")).toBe("Euston Square");
  });

  it("promotes to the slots form when a second slot appears", () => {
    expect(withSlot("Euston", "remark", "terminus")).toEqual({
      main: "Euston",
      remark: "terminus",
    });
  });

  it("demotes back to a plain label when `main` is the last one left", () => {
    // Add a remark, remove it, and the JSON is byte-identical to where it started.
    const promoted = withSlot("Euston", "remark", "terminus");
    expect(withSlot(promoted, "remark", undefined)).toBe("Euston");
  });

  it("does NOT demote a side holding only `dist`", () => {
    // A lone plain label means `main`, so demoting this would silently move the label
    // to a different slot and a different table cell.
    const distOnly = withSlot(null, "dist", "1 km");
    expect(distOnly).toEqual({ dist: "1 km" });
    expect(typeof distOnly).toBe("object");
  });

  it("drops the side entirely once nothing is left", () => {
    // `undefined`, not null: the key leaves the author's JSON rather than lingering.
    expect(withSlot("Euston", "main", undefined)).toBeUndefined();
    expect(withSlot({ main: "Euston", dist: "0" }, "main", "")).toEqual({ dist: "0" });
  });

  it("treats an empty run array or blank object as empty, not as a filled slot", () => {
    expect(withSlot({ main: "Euston", remark: [] }, "main", undefined)).toBeUndefined();
    expect(withSlot("Euston", "remark", { text: "" })).toBe("Euston");
  });
});
