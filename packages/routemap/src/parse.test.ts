import { describe, expect, it } from "vitest";
import { codeToIcon } from "./parse";
import { iconToCode } from "./icon";

// Codes we expect to decode *structurally* (not just passthrough) and to
// survive an exact round-trip back to the original code.
const HANDLED = [
  // track family
  "STR", "exSTR", "tSTR", "extSTRa", "dSTR", "cSTR", "cdSTR", "bSTR", "uSTR",
  "STRq", "STRf", "STRg", "STR2", "STR+1", "STR2+4", "STRl", "STRr", "STRc4",
  "STR+c2", "STR+1+c4",
  // stations
  "BHF", "exBHF", "tBHF", "dBHF", "BHF3", "BHF+1", "KBHFa", "KBHFe", "HST",
  "DST", "INT", "dINT", "exvINT", "extINT", "KINTe", "INT-L", "exKINTe-R",
  "lvINT-", "exlv-INT", "lvINT@F-",
  // junctions
  "ABZg+r", "ABZgr+r", "ABZl+l", "ABZg3", "ABZg+1", "WSLa", "TEEa", "SPL+r",
  // crossings
  "KRZ", "KRZo", "KRZu", "tKRZu", "hKRZWae", "KRZlr+lr",
  // hubs + shifts
  "HUBaq", "HUBeq", "bSHI2+lr", "v-LSHI2r", "SHI6l",
  // parallel / lane
  "vSTR", "vSTRq", "v-STR", "vSTR-", "vSTRr-", "vSTR+rf-", "v-STRr", "STRq-",
  "-STRq", "KSTRaq-",
  // continuation
  "CONTf", "CONTg", "tCONTg", "lCONTf3",
  // interruption
  "LSTR", "LLSTR", "tLSTR",
  // offset / ends / accessible / symbols / widths
  "extSTRa@f", "ENDEa", "hENDEa", "ACC", "HSTACC", "INTACCq", "KACCa", "ocSTR",
  "bsSTR", "wSTR", "sBHF", "exBLaq", "exBLeq", "WALK", "dSTRl+4-", "d-STRr+4",
];

// Codes we expect to passthrough verbatim as { code }: either they carry an
// unmodelled marker, or they simply won't round-trip.
const SPECIAL = [
  "STR2\\STRc3",
  "ABZg2\\CONT3!~ÜWu3",
  "vBHF-eBHF",
  "KRZ2+4o",
  "tKRZt",
  "SHI3:l:r",
  "bSHI5l.RR",
  "STR~L",
  "hKRZWa(Ll)",
  "numN000",
  "POINTER",
  "WASSER",
];

describe("codeToIcon (round-trip corpus)", () => {
  it.each(HANDLED)("decodes %s structurally and round-trips", (code) => {
    const icon = codeToIcon(code);
    // structural decode, not a bare passthrough
    expect(Object.keys(icon)).not.toEqual(["code"]);
    expect(icon.code).toBeUndefined();
    // exact round-trip
    expect(iconToCode(icon)).toBe(code);
  });
});

describe("codeToIcon (passthrough)", () => {
  it.each(SPECIAL)("passes %s through verbatim", (code) => {
    expect(codeToIcon(code)).toEqual({ code });
  });
});

describe("codeToIcon (formation/root backtracking)", () => {
  // DSTR (embankment straight) is shadowed by the DST service-station root;
  // the second decode pass recovers it while DST/DSTr stay the service station.
  it.each([
    ["DSTR", { kind: "track", formation: "embankment" }],
    ["DSTRq", { kind: "track", formation: "embankment", transverse: true }],
    ["CSTR", { kind: "track", formation: "cutting" }],
    ["DST", { kind: "station", subtype: "service" }],
    ["DSTr", { kind: "station", subtype: "service", to: "right" }],
    ["CONTf", { kind: "track", continuation: true, direction: "forward" }],
  ])("decodes %s without the DST/D shadow tripping it", (code, expected) => {
    expect(codeToIcon(code)).toEqual(expected);
    expect(iconToCode(codeToIcon(code))).toBe(code);
  });
});

describe("codeToIcon (shift refinements round-trip)", () => {
  it.each(["SHI2gl", "SHI2c14", "2SHI1l", "v2SHI2c23", "SHI6l"])(
    "decodes %s and round-trips",
    (code) => {
      const icon = codeToIcon(code);
      expect(icon.code).toBeUndefined();
      expect(iconToCode(icon)).toBe(code);
    },
  );
});

describe("codeToIcon (curve radius round-trip)", () => {
  it.each(["kSTR3", "kkSTR2", "kv-STR3"])("decodes %s and round-trips", (code) => {
    const icon = codeToIcon(code);
    expect(icon.code).toBeUndefined();
    expect(iconToCode(icon)).toBe(code);
  });
});

describe("codeToIcon (crossover round-trip)", () => {
  it.each(["vÜST", "vÜSTl", "vÜSTol", "vÜSTur", "vÜSTo+l", "vÜWBl"])(
    "decodes %s and round-trips",
    (code) => {
      const icon = codeToIcon(code);
      expect(icon.code).toBeUndefined();
      expect(iconToCode(icon)).toBe(code);
    },
  );
});
