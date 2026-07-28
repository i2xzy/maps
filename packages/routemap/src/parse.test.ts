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

describe("bare width prefixes are spacers", () => {
  it("decodes every prefix token to its spacer, round-tripping the code", () => {
    // `iconToCode` has always emitted these; only the decode was missing, so the
    // round-trip ran one way and the form could never edit one. ~11% of real cells.
    const expected: Record<string, string | undefined> = {
      "": undefined,
      o: "eighth",
      c: "quarter",
      oc: "three-eighth",
      d: "half",
      cd: "three-quarter",
      b: "double",
      s: "quad",
      bs: "sextuple",
      w: "octuple",
    };
    for (const [code, width] of Object.entries(expected)) {
      const icon = codeToIcon(code);
      expect(icon, code).toEqual(width ? { kind: "spacer", width } : { kind: "spacer" });
      expect(iconToCode(icon), code).toBe(code);
    }
  });

  it("doesn't swallow a real icon that starts with a prefix letter", () => {
    // `b` is a spacer; `bSTR` is a double-width track.
    expect(codeToIcon("bSTR")).toMatchObject({ kind: "track", width: "double" });
    expect(codeToIcon("dSTR")).toMatchObject({ kind: "track", width: "half" });
    expect(codeToIcon("STR")).toEqual({ kind: "track" });
  });
});

describe("a plain line over or under something", () => {
  it("decodes STRo and STRu, which the model already had a field for", () => {
    // `level` existed but was fenced off to crossings, so the commonest suffix on the
    // commonest root didn't decode — `STRo` is an overbridge, `STRu` an underbridge.
    expect(codeToIcon("STRo")).toEqual({ kind: "track", level: "over" });
    expect(codeToIcon("STRu")).toEqual({ kind: "track", level: "under" });
  });

  it("combines with formation, state and transverse", () => {
    for (const code of ["hSTRo", "exSTRo", "tSTRu", "STRoq"]) {
      const icon = codeToIcon(code);
      expect(icon, code).toHaveProperty("level");
      expect(iconToCode(icon), code).toBe(code);
    }
  });

  it("leaves a crossing's level alone", () => {
    expect(codeToIcon("KRZo")).toEqual({ kind: "crossing", level: "over" });
  });
});

describe("coloured variants", () => {
  it("decodes a colour off any base, and re-encodes it identically", () => {
    // A coloured variant is a different FILE — `BSicon STRq green.svg` exists alongside
    // `BSicon STRq.svg`. 18% of cells in real diagrams carry one, which made this the
    // single biggest decoder gap: cells the form can edit went 58.0% -> 71.2%.
    const cases: Record<string, object> = {
      "tSTR yellow": { kind: "track", formation: "tunnel", colour: "yellow" },
      "STRq green": { kind: "track", transverse: true, colour: "green" },
      "STRl cerulean": { kind: "track", to: "left", colour: "cerulean" },
      "exSTR red": { kind: "track", state: "disused", colour: "red" },
      "BHF maroon": { kind: "station", colour: "maroon" },
    };
    for (const [code, expected] of Object.entries(cases)) {
      expect(codeToIcon(code), code).toMatchObject(expected);
      expect(iconToCode(codeToIcon(code)), code).toBe(code);
    }
  });

  it("takes any colour word, not a fixed list", () => {
    // Open string on purpose: the corpus shows ten, and there are certainly more. A closed
    // list would push every unlisted colour back to a passthrough for no gain.
    expect(codeToIcon("STR chartreuse")).toMatchObject({ kind: "track", colour: "chartreuse" });
    expect(iconToCode(codeToIcon("STR chartreuse"))).toBe("STR chartreuse");
  });

  it("leaves a trailing word it can't attach to a base", () => {
    // `+cerulean` isn't a bare word, and the base of a parenthesised code doesn't decode —
    // both stay strings rather than being half-understood.
    expect(codeToIcon("mKRZo +cerulean")).toEqual({ code: "mKRZo +cerulean" });
    expect(codeToIcon("tPSTR(L)_red")).toEqual({ code: "tPSTR(L)_red" });
  });

  it("doesn't invent a colour where there is no space", () => {
    expect(codeToIcon("STR")).toEqual({ kind: "track" });
    expect(codeToIcon("BHF")).toEqual({ kind: "station" });
  });
});
