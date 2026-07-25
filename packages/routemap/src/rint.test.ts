import { describe, expect, it } from "vitest";
import type { RouteDiagram } from "./types";
import {
  rintCode,
  iconFile,
  logoUrl,
  createLogoResolver,
  collectRintCodes,
  createRwsResolver,
  collectRwsArgs,
} from "./rint";

describe("rintCode", () => {
  it("reads a bare string as the rint code", () => {
    expect(rintCode("air")).toBe("air");
    expect(rintCode("london|underground")).toBe("london|underground");
  });
  it("reads { rint } and { region, name }", () => {
    expect(rintCode({ rint: "eurostar", size: 10 })).toBe("eurostar");
    expect(rintCode({ region: "london", name: "underground" })).toBe("london|underground");
    expect(rintCode({ region: "birmingham" })).toBe("birmingham");
  });
  it("forgives a lone name or region (single-arg rint)", () => {
    expect(rintCode({ name: "eurostar", size: 10 } as never)).toBe("eurostar");
    expect(rintCode({ region: "eurostar" })).toBe("eurostar");
  });
  it("returns null for a { file } icon", () => {
    expect(rintCode({ file: "X.svg" })).toBeNull();
  });
});

describe("iconFile", () => {
  it("returns the file for { file }, null otherwise", () => {
    expect(iconFile({ file: "X.svg" })).toBe("X.svg");
    expect(iconFile("air")).toBeNull();
    expect(iconFile({ region: "london", name: "underground" })).toBeNull();
  });
});

describe("logoUrl", () => {
  it("points at Special:FilePath (not the BSicon_ path)", () => {
    expect(logoUrl("National Rail logo.svg")).toBe(
      "https://en.wikipedia.org/wiki/Special:FilePath/National%20Rail%20logo.svg",
    );
  });
});

describe("createLogoResolver", () => {
  const resolve = createLogoResolver({
    "london|underground": { file: "Underground no-text.svg", size: 10 },
    air: { file: "BSicon FLUG.svg", size: 13 },
  });

  it("resolves a { file } icon directly (no rint size)", () => {
    expect(resolve({ file: "X.svg" })).toEqual({ url: logoUrl("X.svg") });
  });
  it("resolves a single-arg string code with rint's size", () => {
    expect(resolve("air")).toEqual({ url: logoUrl("BSicon FLUG.svg"), size: 13 });
  });
  it("resolves a piped string / { region, name } with rint's size", () => {
    expect(resolve("london|underground")).toEqual({ url: logoUrl("Underground no-text.svg"), size: 10 });
    expect(resolve({ region: "london", name: "underground" })).toEqual({
      url: logoUrl("Underground no-text.svg"),
      size: 10,
    });
  });
  it("returns { url: '' } for an unresolved code", () => {
    expect(resolve("paris|metro")).toEqual({ url: "" });
  });
});

describe("collectRintCodes", () => {
  it("gathers distinct rint codes from labels, ignoring { file }", () => {
    const d: RouteDiagram = {
      rows: [
        { left: { text: "Euston", icons: ["gb|rail", "london|underground"] }, cells: ["BHF"] },
        { right: { text: "OOC", icons: ["london|underground", { region: "air" }, { file: "Y.svg" }] }, cells: ["STR"] },
        { type: "colspan", text: "note" },
      ],
    };
    expect(collectRintCodes(d)).toEqual(["gb|rail", "london|underground", "air"]);
  });

  it("also gathers per-line codes from split (text array) lines", () => {
    const d: RouteDiagram = {
      rows: [
        {
          right: { text: ["walkway to", { text: "St Pancras", icons: ["london|underground", "London|thameslink"] }] },
          cells: ["BHF"],
        },
      ],
    };
    expect(collectRintCodes(d)).toEqual(["london|underground", "London|thameslink"]);
  });
});

describe("createRwsResolver", () => {
  const resolve = createRwsResolver({
    "Liverpool|Lime Street": { target: "Liverpool (Lime Street) railway station", display: "Liverpool" },
  });
  it("resolves known rws args to { target, display }", () => {
    expect(resolve("Liverpool|Lime Street")).toEqual({
      target: "Liverpool (Lime Street) railway station",
      display: "Liverpool",
    });
  });
  it("returns undefined for unresolved args", () => {
    expect(resolve("Nowhere")).toBeUndefined();
  });
});

describe("collectRwsArgs", () => {
  it("gathers distinct rws args from label text runs, incl. colspan", () => {
    const d: RouteDiagram = {
      rows: [
        {
          left: { text: ["to ", { rws: "Liverpool|Lime Street" }, " & ", { rws: "Edinburgh|Waverley" }] },
          cells: ["STR"],
        },
        { left: { text: [{ rws: "Liverpool|Lime Street" }] }, cells: ["STR"] }, // dup
        { type: "colspan", text: ["change at ", { rws: "Glasgow Central||Glasgow" }] },
      ],
    };
    expect(collectRwsArgs(d)).toEqual([
      "Liverpool|Lime Street",
      "Edinburgh|Waverley",
      "Glasgow Central||Glasgow",
    ]);
  });
});
