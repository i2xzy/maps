import { describe, expect, it } from "vitest";
import { iconToCode, iconSubtypes, iconSymbolCategory, type IconObject } from "./icon";

describe("iconToCode (track family)", () => {
  it("plain track", () => {
    expect(iconToCode({ kind: "track" })).toBe("STR");
  });

  it("start / end / transverse suffixes (a / e / q)", () => {
    expect(iconToCode({ kind: "track", entry: "start" })).toBe("STRa");
    expect(iconToCode({ kind: "track", entry: "end" })).toBe("STRe");
    expect(iconToCode({ kind: "track", transverse: true })).toBe("STRq");
  });

  it("formation prefixes (t / h / C / D)", () => {
    expect(iconToCode({ kind: "track", formation: "tunnel" })).toBe("tSTR");
    expect(iconToCode({ kind: "track", formation: "elevated" })).toBe("hSTR");
    expect(iconToCode({ kind: "track", formation: "cutting" })).toBe("CSTR");
    expect(iconToCode({ kind: "track", formation: "embankment" })).toBe("DSTR");
  });

  it("interruption (L / LL) hugs the root and stacks with formation / parallel", () => {
    expect(iconToCode({ kind: "track", interrupted: true })).toBe("LSTR");
    expect(iconToCode({ kind: "track", interruptedCorners: true })).toBe("LLSTR");
    expect(iconToCode({ kind: "track", formation: "tunnel", interrupted: true })).toBe("tLSTR");
    // v-LSHI2r: L sits after v and the lane hyphen, right before the root
    expect(
      iconToCode({ kind: "shift", parallel: true, lane: "left", interrupted: true, by: 2, to: "right" }),
    ).toBe("v-LSHI2r");
  });

  it("state prefixes (ex / x / e)", () => {
    expect(iconToCode({ kind: "track", state: "disused" })).toBe("exSTR");
    expect(iconToCode({ kind: "track", state: "disused-primary" })).toBe("xSTR");
    expect(iconToCode({ kind: "track", state: "disused-secondary" })).toBe("eSTR");
  });

  it("width prefixes (o / c / d / cd / b / s)", () => {
    expect(iconToCode({ kind: "track", width: "half" })).toBe("dSTR");
    expect(iconToCode({ kind: "track", width: "quarter" })).toBe("cSTR");
    expect(iconToCode({ kind: "track", width: "double" })).toBe("bSTR");
  });

  it("system/colour prefixes (u / f)", () => {
    expect(iconToCode({ kind: "track", system: "metro" })).toBe("uSTR");
    expect(iconToCode({ kind: "track", system: "footpath" })).toBe("fSTR");
    expect(iconToCode({ kind: "track", system: "rail" })).toBe("STR"); // default, no prefix
  });

  it("combines in catalogue order: state -> formation -> width -> ROOT -> suffix", () => {
    // matches the HS2 diagram's extSTRa
    expect(iconToCode({ kind: "track", state: "disused", formation: "tunnel", entry: "start" })).toBe(
      "extSTRa",
    );
    expect(iconToCode({ kind: "track", formation: "tunnel", entry: "start" })).toBe("tSTRa");
    expect(iconToCode({ kind: "track", formation: "tunnel", entry: "end" })).toBe("tSTRe");
  });

  it("to / from ends (bare suffix vs + suffix)", () => {
    expect(iconToCode({ kind: "track", to: "left" })).toBe("STRl");
    expect(iconToCode({ kind: "track", from: "right" })).toBe("STR+r"); // demo's STR+r
    expect(iconToCode({ kind: "track", to: 2, from: 4 })).toBe("STR2+4"); // to 2 from 4
    expect(iconToCode({ kind: "track", from: 1 })).toBe("STR+1");
  });

  it("direction (f / g): arrowhead on straights, vertical half on curves", () => {
    expect(iconToCode({ kind: "track", direction: "forward" })).toBe("STRf");
    expect(iconToCode({ kind: "track", direction: "back" })).toBe("STRg");
    expect(iconToCode({ kind: "track", to: 2, direction: "forward" })).toBe("STR2f");
  });

  it("corner-filler: bare c<n> vs additive +c<n>", () => {
    expect(iconToCode({ kind: "track", corner: 4 })).toBe("STRc4"); // triangle by itself
    expect(iconToCode({ kind: "track", corner: 2, cornerAdd: true })).toBe("STR+c2"); // demo's STR+c2
    expect(iconToCode({ kind: "track", from: 1, corner: 4, cornerAdd: true })).toBe("STR+1+c4");
  });

  it("station subtypes: through (default) / terminus / halt / service", () => {
    expect(iconToCode({ kind: "station" })).toBe("BHF"); // no subtype = through
    expect(iconToCode({ kind: "station", subtype: "through" })).toBe("BHF");
    expect(iconToCode({ kind: "station", subtype: "halt" })).toBe("HST");
    expect(iconToCode({ kind: "station", subtype: "service" })).toBe("DST");
  });

  it("terminus requires a/e — defaults to start, so never a bare KBHF", () => {
    expect(iconToCode({ kind: "station", subtype: "terminus" })).toBe("KBHFa"); // default entry
    expect(iconToCode({ kind: "station", subtype: "terminus", entry: "start" })).toBe("KBHFa");
    expect(iconToCode({ kind: "station", subtype: "terminus", entry: "end" })).toBe("KBHFe");
  });

  it("stations reuse prefixes + entry + geometry (matches demo codes)", () => {
    expect(iconToCode({ kind: "station", subtype: "terminus", entry: "start" })).toBe("KBHFa");
    expect(iconToCode({ kind: "station", subtype: "terminus", entry: "end" })).toBe("KBHFe");
    expect(iconToCode({ kind: "station", formation: "tunnel" })).toBe("tBHF");
    expect(iconToCode({ kind: "station", subtype: "terminus", entry: "end", formation: "tunnel" })).toBe(
      "tKBHFe",
    );
    expect(iconToCode({ kind: "station", to: 3 })).toBe("BHF3"); // station on the corner-3 diagonal
    expect(iconToCode({ kind: "station", from: 1 })).toBe("BHF+1"); // + connection from corner 1
  });

  it("junction (ABZ): straight through-line + branches via to/from", () => {
    expect(iconToCode({ kind: "junction", from: "right" })).toBe("ABZg+r");
    expect(iconToCode({ kind: "junction", from: 1 })).toBe("ABZg+1");
    expect(iconToCode({ kind: "junction", to: 3 })).toBe("ABZg3");
    expect(iconToCode({ kind: "junction", to: "right", from: "right" })).toBe("ABZgr+r");
    expect(iconToCode({ kind: "junction", to: "left", from: "left" })).toBe("ABZgl+l");
    // through: false drops the straight leg (g) -> branch-only junction
    expect(iconToCode({ kind: "junction", to: "left", from: "left", through: false })).toBe(
      "ABZl+l",
    );
  });

  it("crossing (KRZ): water, level, formation — three independent axes", () => {
    // grade crossing whose transverse line reaches all four sides
    expect(iconToCode({ kind: "crossing", to: ["left", "right"], from: ["left", "right"] })).toBe(
      "KRZlr+lr",
    );
    // elevated bridge over water, full span start+end in the cell (ae) — "long bridge"
    expect(
      iconToCode({ kind: "crossing", formation: "elevated", crosses: "water", entry: "both" }),
    ).toBe("hKRZWae");
    // level (over/under) is o/u
    expect(iconToCode({ kind: "crossing", level: "over" })).toBe("KRZo");
    expect(iconToCode({ kind: "crossing", level: "under" })).toBe("KRZu");
    // a tunnelled line composes with either level — tKRZo ("through over in a
    // tunnel") / tKRZu — so formation and level are separate fields
    expect(iconToCode({ kind: "crossing", formation: "tunnel", level: "over" })).toBe("tKRZo");
    expect(iconToCode({ kind: "crossing", formation: "tunnel", level: "under" })).toBe("tKRZu");
  });

  it("road crossing (SKRZ): semantic roadClass + roadLanes + region → the code letter", () => {
    const road = (o: Omit<IconObject, "kind">, ctx?: { region?: "uk" | "gb" }) =>
      iconToCode({ ...o, kind: "crossing" }, ctx);
    // German classes
    expect(road({ roadClass: "autobahn", level: "over" })).toBe("SKRZ-Ao");
    expect(road({ roadClass: "motorway", level: "over" })).toBe("SKRZ-Mo");
    expect(road({ roadClass: "dirt", level: "under" })).toBe("SKRZ-GDu");
    expect(road({ roadClass: "generic", level: "over" })).toBe("SKRZ-G1o"); // default 1 lane
    expect(road({ roadClass: "generic", roadLanes: 2, level: "over" })).toBe("SKRZ-G2o");
    expect(road({ roadClass: "generic", roadLanes: 4, level: "over" })).toBe("SKRZ-G4o");
    // UK classes
    expect(road({ roadClass: "minor", level: "under" })).toBe("SKRZ-Yu"); // B-road (yellow)
    expect(road({ roadClass: "major", level: "over" })).toBe("SKRZ-Go"); // A-road (green)
    expect(road({ roadClass: "major", roadLanes: 4, level: "over" })).toBe("SKRZ-Ro"); // dual (red)
    expect(road({ roadClass: "white" })).toBe("SKRZ-E"); // undefined white road
    // region: motorway + uk → blue B (per-cell, and via ctx)
    expect(road({ roadClass: "motorway", region: "uk", level: "over" })).toBe("SKRZ-Bo");
    expect(road({ roadClass: "motorway", level: "over" }, { region: "gb" })).toBe("SKRZ-Bo");
    // formation + entry compose — hSKRZ-G2a
    expect(road({ roadClass: "generic", roadLanes: 2, formation: "elevated", entry: "start" })).toBe(
      "hSKRZ-G2a",
    );
  });

  it("enclosed tunnel is a track: both portals collapse STR+t to the TUNNEL root", () => {
    expect(iconToCode({ kind: "track", formation: "tunnel", entry: "both" })).toBe("TUNNEL1");
    expect(iconToCode({ kind: "track", formation: "tunnel", entry: "both", length: "short" })).toBe(
      "TUNNEL2",
    );
    // under water -> W
    expect(
      iconToCode({ kind: "track", formation: "tunnel", entry: "both", crosses: "water" }),
    ).toBe("TUNNEL1W");
    // single portals are unchanged (t prefix, not the enclosed root)
    expect(iconToCode({ kind: "track", formation: "tunnel", entry: "start" })).toBe("tSTRa");
  });

  it("parallel tracks (v) + lane hyphen (leading = left/bottom, trailing = right/top)", () => {
    // v alone: both lanes; + transverse: both lanes running left→right
    expect(iconToCode({ kind: "track", parallel: true })).toBe("vSTR");
    expect(iconToCode({ kind: "track", parallel: true, transverse: true })).toBe("vSTRq");
    // v + lane: one of them
    expect(iconToCode({ kind: "track", parallel: true, lane: "left" })).toBe("v-STR");
    expect(iconToCode({ kind: "track", parallel: true, lane: "right" })).toBe("vSTR-");
    // right parallel track turning right into a single track (inner curve)
    expect(iconToCode({ kind: "track", parallel: true, lane: "right", to: "right" })).toBe(
      "vSTRr-",
    );
    // right parallel track coming from the right
    expect(iconToCode({ kind: "track", parallel: true, lane: "right", from: "right" })).toBe(
      "vSTR+r-",
    );
    // left parallel track turning right into a single track (outer curve)
    expect(iconToCode({ kind: "track", parallel: true, lane: "left", to: "right" })).toBe("v-STRr");
    // single tracks joining a parallel lane (no v prefix)
    expect(iconToCode({ kind: "track", lane: "right", to: "right" })).toBe("STRr-");
    expect(iconToCode({ kind: "track", lane: "left", from: "left" })).toBe("-STR+l");
  });

  it("parallel single-track curves: v + lane + to/from + f/g (f/g after the ends)", () => {
    const c = (o: Omit<IconObject, "kind">) => iconToCode({ ...o, kind: "track", parallel: true });
    // inner curve
    expect(c({ lane: "right", to: "right", direction: "back" })).toBe("vSTRrg-");
    expect(c({ lane: "right", from: "right", direction: "forward" })).toBe("vSTR+rf-");
    expect(c({ lane: "left", to: "left", direction: "back" })).toBe("v-STRlg");
    expect(c({ lane: "left", from: "left", direction: "forward" })).toBe("v-STR+lf");
    // outer curve
    expect(c({ lane: "left", to: "right", direction: "forward" })).toBe("v-STRrf");
    expect(c({ lane: "left", from: "right", direction: "back" })).toBe("v-STR+rg");
    expect(c({ lane: "right", to: "left", direction: "forward" })).toBe("vSTRlf-");
    expect(c({ lane: "right", from: "left", direction: "back" })).toBe("vSTR+lg-");
    // inner to outer curve
    expect(c({ lane: "right", to: "right", direction: "forward" })).toBe("vSTRrf-");
    expect(c({ lane: "right", from: "right", direction: "back" })).toBe("vSTR+rg-");
    expect(c({ lane: "left", to: "left", direction: "forward" })).toBe("v-STRlf");
    expect(c({ lane: "left", from: "left", direction: "back" })).toBe("v-STR+lg");
    // outer to inner curve
    expect(c({ lane: "left", to: "right", direction: "back" })).toBe("v-STRrg");
    expect(c({ lane: "left", from: "right", direction: "forward" })).toBe("v-STR+rf");
    expect(c({ lane: "right", to: "left", direction: "back" })).toBe("vSTRlg-");
    expect(c({ lane: "right", from: "left", direction: "forward" })).toBe("vSTR+lf-");
  });

  it("curve radius: k (wide) and kk (S-bend), before parallel v", () => {
    expect(iconToCode({ kind: "track", curve: "wide", to: 3 })).toBe("kSTR3");
    expect(iconToCode({ kind: "track", curve: "sBend", to: 2 })).toBe("kkSTR2");
    expect(iconToCode({ kind: "track", curve: "wide", parallel: true, lane: "left", to: 3 })).toBe(
      "kv-STR3",
    );
  });

  it("transverse lanes (across, upper/lower) and the K stub modifier", () => {
    expect(iconToCode({ kind: "track", transverse: true, lane: "right" })).toBe("STRq-"); // upper
    expect(iconToCode({ kind: "track", transverse: true, lane: "left" })).toBe("-STRq"); // lower
    // KSTRaq- — "stub start across, upper only": K + a + q + trailing hyphen
    expect(
      iconToCode({ kind: "track", stub: true, entry: "start", transverse: true, lane: "right" }),
    ).toBe("KSTRaq-");
  });

  it("lane hyphen on narrow (d) diagonals reads as upper/lower", () => {
    // to upper left from corner 4 / to lower right from corner 4
    expect(iconToCode({ kind: "track", width: "half", to: "left", from: 4, lane: "right" })).toBe(
      "dSTRl+4-",
    );
    expect(iconToCode({ kind: "track", width: "half", to: "right", from: 4, lane: "left" })).toBe(
      "d-STRr+4",
    );
  });

  it("continuation (CONT): a track form; direction f/g before the corner, + legend", () => {
    const cont = (o: Omit<IconObject, "kind">) => iconToCode({ ...o, kind: "track", continuation: true });
    expect(cont({ direction: "forward" })).toBe("CONTf");
    expect(cont({ direction: "back" })).toBe("CONTg");
    expect(cont({ formation: "tunnel", direction: "back" })).toBe("tCONTg");
    // lCONTf3 — legend continuation, forward, toward corner 3 (f BEFORE the 3)
    expect(cont({ legend: true, direction: "forward", to: 3 })).toBe("lCONTf3");
  });

  it("end (ENDE): line-end / buffer via entry + state", () => {
    expect(iconToCode({ kind: "end", entry: "start" })).toBe("ENDEa");
    expect(iconToCode({ kind: "end", entry: "end" })).toBe("ENDEe");
    expect(iconToCode({ kind: "end", formation: "elevated", entry: "start" })).toBe("hENDEa");
  });

  it("accessible (ACC set): BHF→ACC, HST→HSTACC, INT→INTACC, terminus→KACC", () => {
    expect(iconToCode({ kind: "station", accessible: true })).toBe("ACC");
    expect(iconToCode({ kind: "station", subtype: "halt", accessible: true })).toBe("HSTACC");
    expect(
      iconToCode({ kind: "station", subtype: "interchange", accessible: true, transverse: true }),
    ).toBe("INTACCq");
    expect(iconToCode({ kind: "station", subtype: "terminus", accessible: true })).toBe("KACCa");
    expect(iconToCode({ kind: "station", stub: true, accessible: true, entry: "start" })).toBe(
      "KACCa",
    );
  });

  it("extra width letters (oc ⅜, bs 6×, w 8×) and S-Bahn system", () => {
    expect(iconToCode({ kind: "track", width: "three-eighth" })).toBe("ocSTR");
    expect(iconToCode({ kind: "track", width: "sextuple" })).toBe("bsSTR");
    expect(iconToCode({ kind: "track", width: "octuple" })).toBe("wSTR");
    expect(iconToCode({ kind: "station", system: "sbahn" })).toBe("sBHF");
    expect(iconToCode({ kind: "shift", by: 6, to: "left" })).toBe("SHI6l");
  });

  it("hub (HUB): entry + transverse connector", () => {
    expect(iconToCode({ kind: "hub", entry: "start", transverse: true })).toBe("HUBaq");
    expect(iconToCode({ kind: "hub", entry: "end", transverse: true })).toBe("HUBeq");
  });

  it("shift (SHI): width prefix + amount + connected ends", () => {
    expect(iconToCode({ kind: "shift", width: "double", from: ["left", "right"] })).toBe(
      "bSHI2+lr",
    );
    expect(iconToCode({ kind: "shift", by: 1, to: "left" })).toBe("SHI1l");
  });

  it("shift refinements: g before the ends, corner pairs, 2-row prefix", () => {
    expect(iconToCode({ kind: "shift", by: 2, direction: "back", to: "left" })).toBe("SHI2gl");
    expect(iconToCode({ kind: "shift", by: 2, corner: [1, 4] })).toBe("SHI2c14");
    expect(iconToCode({ kind: "shift", doubleRow: true, by: 1, to: "left" })).toBe("2SHI1l");
    expect(
      iconToCode({ kind: "shift", parallel: true, doubleRow: true, by: 2, corner: [2, 3] }),
    ).toBe("v2SHI2c23");
  });

  it("station subtype interchange (INT) reuses the station modifiers", () => {
    const int = (o: Omit<IconObject, "kind">) =>
      iconToCode({ ...o, kind: "station", subtype: "interchange" });
    expect(int({ width: "half" })).toBe("dINT");
    expect(int({ state: "disused", parallel: true })).toBe("exvINT");
    expect(int({ state: "disused", formation: "tunnel" })).toBe("extINT");
    expect(int({ legend: true, parallel: true, lane: "right" })).toBe("lvINT-");
    expect(int({ state: "disused", legend: true, parallel: true, lane: "left" })).toBe("exlv-INT");
    expect(int({ stub: true, entry: "end" })).toBe("KINTe");
    // neighbour connectors -L / -R
    expect(int({ state: "disused", legend: true, connect: "left" })).toBe("exlINT-L");
    expect(int({ state: "disused", stub: true, entry: "end", connect: "right" })).toBe("exKINTe-R");
    // @F shifts the secondary (the interchange legend, the default) forward, before the lane hyphen
    expect(int({ legend: true, parallel: true, offset: "forward", lane: "right" })).toBe("lvINT@F-");
  });

  it("track subtype walkway (BL) — station-connection bar with a/e/q", () => {
    expect(iconToCode({ kind: "track", subtype: "walkway", state: "disused", entry: "start", transverse: true })).toBe(
      "exBLaq",
    );
    expect(iconToCode({ kind: "track", subtype: "walkway", state: "disused", entry: "end", transverse: true })).toBe(
      "exBLeq",
    );
  });

  it("track subtype lock (canal lock) — inline waterway element with LOCK1/2/3 via variant", () => {
    expect(iconToCode({ kind: "track", subtype: "lock" })).toBe("LOCK");
    expect(iconToCode({ kind: "track", subtype: "lock", variant: 2 })).toBe("LOCK2");
    expect(iconToCode({ kind: "track", subtype: "stopLock" })).toBe("STOPLOCK");
    // variant only emits for a track (not other kinds)
    expect(iconToCode({ kind: "station", variant: 2 } as never)).toBe("BHF");
  });

  it("@ offset: uppercase secondary (default) vs lowercase auxiliary", () => {
    // extSTRa@f — @f shifts the auxiliary tunnel portal forward (explicit)
    expect(
      iconToCode({
        kind: "track",
        state: "disused",
        formation: "tunnel",
        entry: "start",
        offset: "forward",
        offsetTarget: "auxiliary",
      }),
    ).toBe("extSTRa@f");
    // secondary is the default (uppercase); offsetTarget: auxiliary lowercases it
    expect(iconToCode({ kind: "track", offset: "back" })).toBe("STR@G");
    expect(iconToCode({ kind: "track", offset: "back", offsetTarget: "auxiliary" })).toBe("STR@g");
  });

  it("crossover (ÜST/ÜWB): parallel + level (o/u after root) + to/from", () => {
    const x = (o: Omit<IconObject, "kind">) => iconToCode({ ...o, kind: "crossover" });
    expect(x({ parallel: true })).toBe("vÜST"); // double crossover
    expect(x({ parallel: true, to: "left" })).toBe("vÜSTl"); // one-way
    expect(x({ parallel: true, level: "over", to: "left" })).toBe("vÜSTol"); // flying jn, over, to left
    expect(x({ parallel: true, level: "under", to: "right" })).toBe("vÜSTur");
    expect(x({ parallel: true, level: "over", from: "left" })).toBe("vÜSTo+l"); // over, from left
    // ÜWB flyover subtype
    expect(iconToCode({ kind: "crossover", subtype: "flyover", parallel: true, to: "left" })).toBe(
      "vÜWBl",
    );
  });

  it("junction subtypes: loop (WSL), tee (TEE), split (SPL) — no through-line", () => {
    expect(iconToCode({ kind: "junction", subtype: "loop", entry: "start" })).toBe("WSLa");
    expect(iconToCode({ kind: "junction", subtype: "loop", to: "left" })).toBe("WSLl");
    expect(iconToCode({ kind: "junction", subtype: "tee", entry: "start" })).toBe("TEEa");
    expect(iconToCode({ kind: "junction", subtype: "tee", entry: "end", transverse: true })).toBe(
      "TEEeq",
    );
    expect(iconToCode({ kind: "junction", subtype: "split", from: "right" })).toBe("SPL+r");
  });

  it("iconSubtypes lists a kind's context options (for the GUI)", () => {
    expect(iconSubtypes("station")).toEqual([
      "through",
      "terminus",
      "halt",
      "service",
      "interchange",
    ]);
    const symbols = iconSubtypes("symbol");
    expect(symbols).toEqual(expect.arrayContaining(["ferry", "bus", "church", "mountain"]));
    expect(symbols).not.toContain("lock"); // canal locks are a track subtype, not a symbol
    expect(symbols.length).toBeGreaterThan(40);
    expect(iconSubtypes("crossing")).toEqual([]); // single default root (KRZ)
    expect(iconSubtypes("track")).toEqual(["walkway", "lock", "stopLock"]);
    expect(iconSubtypes("junction")).toEqual(["loop", "tee", "split"]);
  });

  it("symbol kind: standalone point symbols chosen by subtype", () => {
    expect(iconToCode({ kind: "symbol", subtype: "ferry" })).toBe("BOOT");
    expect(iconToCode({ kind: "symbol", subtype: "poleBoat" })).toBe("BOOT2");
    expect(iconToCode({ kind: "symbol", subtype: "tollbooth" })).toBe("TOLLBOOTH");
    expect(iconToCode({ kind: "symbol", subtype: "walkway" })).toBe("WALK");
    expect(iconToCode({ kind: "symbol", subtype: "church" })).toBe("CHURCH");
    expect(iconToCode({ kind: "symbol", subtype: "ferry", transverse: true })).toBe("BOOTq");
    // `category` is organisational only — it does not change the code
    expect(iconToCode({ kind: "symbol", subtype: "church", category: "building" })).toBe("CHURCH");
    expect(iconSymbolCategory("church")).toBe("building");
    expect(iconSymbolCategory("bus")).toBe("transport");
    // integral ferry (TRAJEKT = STR!~BOOT) = a track + symbol overlay stack:
    expect(iconToCode({ kind: "track" })).toBe("STR");
    expect(iconToCode({ kind: "symbol", subtype: "ferry" })).toBe("BOOT");
  });

  it("spacers: full empty vs width-prefix blanks", () => {
    expect(iconToCode({ kind: "spacer" })).toBe(""); // full empty cell
    expect(iconToCode({ kind: "spacer", width: "half" })).toBe("d");
    expect(iconToCode({ kind: "spacer", width: "quarter" })).toBe("c");
    expect(iconToCode({ kind: "spacer", width: "three-quarter" })).toBe("cd");
    expect(iconToCode({ kind: "spacer", width: "double" })).toBe("b");
  });

  it("ctx supplies a diagram-wide default state/region; a per-icon value wins", () => {
    // diagram default applies when the icon omits its own
    expect(iconToCode({ kind: "track" }, { state: "disused" })).toBe("exSTR");
    expect(iconToCode({ kind: "station" }, { state: "disused" })).toBe("exBHF");
    // per-icon state overrides the default
    expect(iconToCode({ kind: "track", state: "disused-primary" }, { state: "disused" })).toBe(
      "xSTR",
    );
    // `in-use` forces operational (no prefix) over a `disused` diagram default
    expect(iconToCode({ kind: "track", state: "in-use" }, { state: "disused" })).toBe("STR");
    expect(iconToCode({ kind: "station", state: "in-use" }, { state: "disused" })).toBe("BHF");
    // region default too (motorway → blue B)
    expect(iconToCode({ kind: "crossing", roadClass: "motorway", level: "over" }, { region: "uk" })).toBe(
      "SKRZ-Bo",
    );
  });

  it("code escape hatch wins over the semantic fields (and any kind)", () => {
    expect(iconToCode({ kind: "track", state: "disused", code: "STRq" })).toBe("STRq");
    expect(iconToCode({ kind: "crossing", code: "KRZlr+lr" })).toBe("KRZlr+lr");
  });

  it("throws for an unmodelled kind without a code", () => {
    expect(() => iconToCode({ kind: "water" })).toThrow(/not supported yet/);
  });
});
