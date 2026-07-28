/**
 * Semantic icon objects -> BSicon codes.
 *
 * Instead of a raw code like "extSTRa" you describe the icon:
 *   { kind: "track", state: "disused", formation: "tunnel", entry: "start" }
 * and `iconToCode` builds the code. This is the *identity* layer — the prefixes
 * (colour, state, formation, width) + ROOT + the a/e/q suffixes — which map
 * deterministically. Geometry-heavy icons (junctions, corners, connections) and
 * anything not modelled yet use `code` as a verbatim escape hatch.
 *
 * Prefix order follows the BSicon catalogue:
 *   colour -> state -> line-type(formation) -> width -> ROOT -> suffixes
 *
 * Orientation note: BSicons run top-to-bottom, so `entry: "start"` is the TOP
 * edge (a) and `"end"` the BOTTOM (e). Left/right (to/from, lane) are
 * travel-relative — they read mirrored from the viewer.
 *
 * `kind: "track"`, `"station"`, `"spacer"`, `"symbol"`, `"junction"`,
 * `"crossing"`, `"hub"` and `"shift"` are serialized; other kinds require
 * `code` until implemented. Reverse parsing (code -> object) is a later step.
 */

export type IconKind =
  | "track"
  | "station"
  | "spacer" // an empty cell / width-prefix blank ("", "d", "c", …)
  | "symbol" // a standalone point symbol chosen by subtype (ferry, tollbooth, …)
  | "junction"
  | "crossing"
  | "crossover"
  | "end"
  | "bridge"
  | "hub"
  | "shift"
  | "water";

export type IconSystem = "rail" | "metro" | "sbahn" | "footpath" | "canal";
/** Colour set. `in-use` is the default (no prefix); the out-of-use sets are
 *  `disused-secondary` = e, `disused-primary` = x, `disused` = ex (whole icon).
 *  `in-use` is explicit so a cell can override a diagram-wide `disused` default
 *  back to operational (omitting `state` inherits the default instead). */
export type IconState = "in-use" | "disused" | "disused-primary" | "disused-secondary";
/** Formation — how the line is carried (mutually exclusive). Other "line type"
 *  prefixes that can *stack* with these (interruption, legend, narrow, masking,
 *  water, special) are separate fields, not members here. */
export type IconFormation = "tunnel" | "elevated" | "cutting" | "embankment";
/** Road class for a road crossing (SKRZ). The emitted letter resolves from the
 *  class plus `roadLanes` and `region` — see `roadCode`. */
export type RoadClass =
  | "generic" // G1/G2/G4 by roadLanes (default 1)
  | "dirt" // GD
  | "minor" // Y (UK B-road, yellow)
  | "major" // G (UK A-road, green); + roadLanes 4 → R (dual carriageway, red)
  | "motorway" // M (German); + region uk/gb → B (UK motorway, blue)
  | "autobahn" // A
  | "white"; // E — undefined white road (borderless / extending ends)

export type IconWidth =
  | "eighth" // o
  | "quarter" // c
  | "three-eighth" // oc
  | "half" // d
  | "three-quarter" // cd
  | "double" // b
  | "quad" // s
  | "sextuple" // bs
  | "octuple"; // w

/** Broad grouping for `symbol` glyphs — organises the picker; does not affect
 *  the code (the root comes from `subtype`). Derivable via `iconSymbolCategory`. */
export type SymbolCategory = "transport" | "building" | "scenic" | "infrastructure";

/** A corner: 1 NE · 2 SE · 3 SW · 4 NW (clockwise from top-right). */
export type Corner = 1 | 2 | 3 | 4;
/** An endpoint of a line/curve: a corner or a side. Left/right are travel-relative
 *  (line runs top-to-bottom, so they read mirrored from the viewer). */
export type IconEnd = Corner | "left" | "right";

export interface IconObject {
  /** The category of glyph. Most kinds serialize; the unmodelled ones
   *  (crossover, end, bridge, water) still need `code`. */
  kind: IconKind;
  /** Refinement within a kind — a context-dependent value the GUI shows once a
   *  kind is picked. For "station": "through" (default) | "terminus" | "halt" |
   *  "service". See `iconSubtypes(kind)`. */
  subtype?: string;
  /** Organising group for a `symbol` (transport / building / scenic /
   *  infrastructure) — for the picker only; the code comes from `subtype`, so
   *  this is optional and can be auto-filled via `iconSymbolCategory(subtype)`. */
  category?: SymbolCategory;
  /** Colour/system prefix (default rail = none). */
  system?: IconSystem;
  /** Colour set: `in-use` (default, no prefix), `disused` (ex), `disused-primary`
   *  (x), `disused-secondary` (e). Omit to inherit the diagram default; set
   *  `in-use` to force operational when the diagram default is `disused`. */
  state?: IconState;
  /** Formation — how the line is carried (mutually exclusive): tunnel (t),
   *  elevated (h), cutting (C), embankment (D). Emitted after `state`. */
  formation?: IconFormation;
  /** Legend line type (l) — the feature is shown without its line, for keys /
   *  legends. A stackable line-type prefix emitted with `formation`. */
  legend?: boolean;
  /** Non-full width (o / c / d / cd / b / s). */
  width?: IconWidth;
  /** Track start (a = top), end (e = bottom), or `both` (a+e) — a span whose
   *  start and end are both in the cell, e.g. a complete elevated bridge over
   *  water (hKRZWae, "long bridge"); the bare hKRZW is just the mid-section. */
  entry?: "start" | "end" | "both";
  /** Stub / dead-end: prepends the `K` root modifier (KSTR, KDST…), the same K
   *  baked into a terminus KBHF. A line that stubs/ends within the cell. */
  stub?: boolean;
  /** Continuation off the diagram edge — swaps the line root for CONT (CONTf,
   *  CONTg, CONTf3), with `direction` (f/g) emitted *before* any corner. A line
   *  form, so it applies to `track` (and water once modelled), not a kind. */
  continuation?: boolean;
  /** Interruption line type — the line is drawn with a break (L), a straight
   *  line at the corner that joins solid track via regular `STRc#` corners.
   *  Sits right before the root (after v / lane), so it stacks with formation
   *  and parallel — LSTR, tLSTR, v-LSHI2r. */
  interrupted?: boolean;
  /** The LL variant — a quarter-dot at the corner, designed to join at corners
   *  (with LLSTRc#a/e pieces, or another interruption). Takes precedence over
   *  `interrupted`. */
  interruptedCorners?: boolean;
  /** Rotated 90° / horizontal (q). */
  transverse?: boolean;

  // ── parallel double track (v) + which side of centre ─────────────────
  /** Two parallel tracks either side of centre — the `v` prefix. Alone (no
   *  `lane`) both lanes are drawn (vSTR, or vSTRq for the transverse pair
   *  running left→right); with `lane`, just one of them. */
  parallel?: boolean;
  /** Which side of centre this track sits on / connects to, via a `-`:
   *  `left` = leading hyphen (`-STR`, the left/bottom lane), `right` = trailing
   *  hyphen (`STR-`, the right/top lane). Independent of `parallel` — a single
   *  track can use it to join a parallel lane (STRr-); on narrow (d/c) diagonals
   *  it reads as lower/upper. */
  lane?: "left" | "right";
  /** Connects to a neighbour cell's symbol — the trailing `-L` / `-R` / `-M`
   *  suffix (left / right / both), for a wide station or interchange spanning
   *  columns (INT-L, BHF-M, exKINTe-R). Distinct from `lane`'s bare `-`. */
  connect?: "left" | "right" | "both";
  /** `@` positioning modifier — shifts one element of the glyph forward (f/F) or
   *  back (g/G) relative to the line, leaving the rest in place. Its presence
   *  emits the `@`; direction is the letter. → @f / @g / @F / @G. */
  offset?: "forward" | "back";
  /** What the `@` offset moves: `secondary` (uppercase @F/@G — a CONT arrow, an
   *  interchange legend; the default) or `auxiliary` (lowercase @f/@g — e.g. a
   *  tunnel portal, without moving the station). Ignored without `offset`. */
  offsetTarget?: "secondary" | "auxiliary";

  // ── geometry: a line/curve runs `from` one end `to` another ──────────
  /** The "to" end(s) — bare suffix (l / r / 1–4). An array lists several under
   *  no `+` (KRZlr = to both left and right). */
  to?: IconEnd | IconEnd[];
  /** The "from" end(s) — a `+` suffix (+l / +r / +1–4). An array groups them
   *  under one `+` (KRZ…+lr = from both left and right). */
  from?: IconEnd | IconEnd[];
  /** Vertical direction — f (forward = down/lower) or g (back = up/upper) —
   *  emitted after the to/from ends. On a straight it's a visible arrowhead
   *  (STRf); on a curve it's the upper/lower half of the diagonal endpoint, so
   *  with to/from's l/r it names a corner: rg = upper-right, rf = lower-right,
   *  lg = upper-left, lf = lower-left. */
  direction?: "forward" | "back";
  /** Corner-filler triangle at corner n (STRc<n>), or a pair for two corners at
   *  once (SHI2c14 → [1, 4]). */
  corner?: Corner | [Corner, Corner];
  /** true → the additive `+c<n>` overlay onto the base line (STR+c2, STR+1+c4);
   *  false/absent → the corner IS the glyph (STRc<n>). */
  cornerAdd?: boolean;
  /** Junctions (ABZ) carry a straight through-line (bottom↔top) by default,
   *  emitted as `g` right after the root; set `false` for a branch-only glyph
   *  with no straight through (ABZl+l). Ignored by roots that have no through
   *  token. */
  through?: boolean;

  // ── water / grade separation ─────────────────────────────────────────
  /** Crosses a water feature — appends `W` (KRZW), or the under-water tunnel
   *  TUNNEL1W on an enclosed track. (Road crossings use `roadClass`.) */
  crosses?: "water";
  /** Road crossing (SKRZ) — the crossed road's class. Its presence selects the
   *  SKRZ root; the emitted letter resolves from class + `roadLanes` + `region`. */
  roadClass?: RoadClass;
  /** Lane count for a road crossing: `generic` + 1/2/4 → G1/G2/G4; `major` + 4 →
   *  R (dual carriageway). Ignored by other classes. Defaults to 1 for generic. */
  roadLanes?: 1 | 2 | 4;
  /** Regional style context. `motorway` + region (`uk`/`gb`) → the blue UK `B`
   *  instead of the German `M`. Set per-cell, or diagram-wide via `iconToCode`'s
   *  `ctx` argument (a cell value wins). */
  region?: "uk" | "gb";
  /** Grade separation — the line passes `over` (o) or `under` (u). On a
   *  `crossing` (tKRZo/tKRZu; an elevated line is already over, so `h`-forms
   *  take no `level`) and on a `crossover` (the flying-junction vÜSTol/vÜSTur). */
  level?: "over" | "under";
  /**
   * A coloured VARIANT of the icon, appended after a space: `tSTR yellow`, `STRq green`.
   *
   * Not to be confused with the leading system prefix, which the header calls a colour
   * because `u`/`m` select a colour SET. This is a different file — `BSicon STRq green.svg`
   * exists on Commons alongside `BSicon STRq.svg`.
   *
   * An open string rather than an enum: the corpus shows red, blue, maroon, yellow,
   * saffron, green, grey, brown, cerulean and white, and there are certainly more. A
   * closed list would push every unlisted colour back to a passthrough string for no gain.
   */
  colour?: string;
  /** Length of an enclosed tunnel (`entry: "both"` track): `long` (TUNNEL1…) or
   *  `short` (TUNNEL2…). Defaults to `long`. */
  length?: "long" | "short";

  /** Shift amount for a `shift` (SHI): the number in SHI1/SHI2/… Defaults to 2. */
  by?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  /** Numbered variant of a canal-lock track (`subtype: "lock"`) — the digit in
   *  LOCK1/LOCK2/LOCK3, appended right after the root. */
  variant?: number;
  /** The `2` double-row prefix on a shift (2SHI…) — the shift spans two rows. */
  doubleRow?: boolean;
  /** Curve radius/shape variant: `wide` (k = wider-radius curve) or `sBend`
   *  (kk = S-bend). Emitted right after `width`, before parallel `v`. */
  curve?: "wide" | "sBend";
  /** Accessible (step-free) station — the ACC set. BHF→ACC, HST→HSTACC,
   *  INT→INTACC, KBHF→KACC. Station kind only. */
  accessible?: boolean;

  /** Escape hatch: use this raw BSicon code verbatim, ignoring the fields above. */
  code?: string;
}

// Use-case → colour-set prefix. Several use-cases share a letter by design
// (metro and navigable canal are both the blue `u` set); the letter is a
// rendering detail a future theming layer can remap.
const SYSTEM: Record<IconSystem, string> = {
  rail: "",
  metro: "u",
  sbahn: "s",
  footpath: "f",
  canal: "g", // unwatered canal (green terrain set)
};
const STATE: Record<IconState, string> = {
  "in-use": "", // operational (no prefix) — overrides a diagram default
  disused: "ex", // out of use (exBHF)
  "disused-primary": "x", // primary out of use (xBHF)
  "disused-secondary": "e", // secondary out of use (eBHF)
};
const FORMATION: Record<IconFormation, string> = {
  tunnel: "t",
  elevated: "h",
  cutting: "C",
  embankment: "D",
};
/** Prefix token -> width name, the reverse of `WIDTH`. */
const WIDTH_BY_CODE: Record<string, IconWidth> = {};

/**
 * The width a bare prefix token names, or undefined if it isn't one.
 *
 * `"b"` is `double`, `"cd"` is `three-quarter`. Used to decode a spacer cell, which is
 * written as its width prefix and nothing else.
 */
export function widthFromCode(token: string): IconWidth | undefined {
  return WIDTH_BY_CODE[token];
}

const WIDTH: Record<IconWidth, string> = {
  eighth: "o", // ⅛
  quarter: "c", // ¼
  "three-eighth": "oc", // ⅜
  half: "d", // ½
  "three-quarter": "cd", // ¾
  double: "b", // 2×
  quad: "s", // 4×
  sextuple: "bs", // 6×
  octuple: "w", // 8×
};

for (const [name, code] of Object.entries(WIDTH)) WIDTH_BY_CODE[code] = name as IconWidth;

// Runtime value lists sourced from the maps above — for the field descriptor and
// the GUI, so enum options can never drift from what the serializer accepts.
export const ICON_SYSTEMS = Object.keys(SYSTEM) as IconSystem[];
export const ICON_STATES = Object.keys(STATE) as IconState[];
export const ICON_FORMATIONS = Object.keys(FORMATION) as IconFormation[];
export const ICON_WIDTHS = Object.keys(WIDTH) as IconWidth[];

const oneEnd = (end: IconEnd): string =>
  typeof end === "number" ? String(end) : end === "left" ? "l" : "r";
/** One end or several concatenated (l / r / 1–4 / "lr"). */
const endToken = (end: IconEnd | IconEnd[]): string =>
  Array.isArray(end) ? end.map(oneEnd).join("") : oneEnd(end);

/** A corner digit, or a pair concatenated (c14, c23). */
const cornerTok = (c: Corner | [Corner, Corner]): string =>
  Array.isArray(c) ? c.map(String).join("") : String(c);

/** The SKRZ road-class letter from the semantic class + lanes + region. */
function roadCode(cls: RoadClass, lanes: 1 | 2 | 4 | undefined, region: "uk" | "gb" | undefined): string {
  switch (cls) {
    case "dirt":
      return "GD";
    case "minor":
      return "Y";
    case "autobahn":
      return "A";
    case "white":
      return "E";
    case "generic":
      return `G${lanes ?? 1}`; // G1 / G2 / G4
    case "major":
      return lanes === 4 ? "R" : "G"; // dual carriageway (red) vs A-road (green)
    case "motorway":
      return region != null ? "B" : "M"; // UK blue vs German motorway
  }
}

/**
 * A `track` whose formation is enclosed with BOTH portals in the one cell
 * (`entry: "both"`) is drawn as a self-contained root — TUNNEL1/2 — rather than
 * STR + a `t` prefix. Maps the formation to that root; formations not listed
 * keep the ordinary STR + prefix form.
 */
const ENCLOSED_ROOT: Partial<Record<IconFormation, string>> = { tunnel: "TUNNEL" };

/** A resolved root plus grammar metadata (e.g. a required-with-default entry). */
interface RootSpec {
  root: string;
  /** Default `entry` when the icon omits one — e.g. a terminus (KBHF) can't
   *  exist without a/e, so it defaults to `start` (KBHFa). */
  entry?: "start" | "end";
  /** Token emitted right after the root when a straight through-line is present
   *  (`g` for junctions). Present ⇒ this root supports `through` (default on);
   *  absent ⇒ `through` is ignored. */
  through?: string;
  /** Picker group for a `symbol` subtype (authoritative source for `category`). */
  category?: SymbolCategory;
}

/**
 * The ROOT for each kind: a default plus context-dependent subtypes. (The `K` of
 * KBHF etc. are root modifiers folded into the root token.) The `subtypes` maps
 * also drive the GUI's context-dependent subtype control via `iconSubtypes`.
 */
const ROOTS: Partial<
  Record<IconKind, { default?: RootSpec; subtypes?: Record<string, RootSpec> }>
> = {
  track: {
    default: { root: "STR" },
    subtypes: {
      // A black line (BL): adjacent-station connection / walkway, drawn as a thick
      // bar rather than a running track.
      walkway: { root: "BL" },
      // Canal locks — inline elements drawn ON the waterway line (the line runs
      // through them), not standalone point symbols. LOCK1/2/3 via `variant`.
      lock: { root: "LOCK" },
      stopLock: { root: "STOPLOCK" },
    },
  },
  // Branch-off: a straight through-line (`g`) plus branch(es) named by to/from,
  // exactly like STR's suffixes. `through: false` drops the straight leg.
  // Subtypes swap the root for other junction shapes (no `g` through-line).
  junction: {
    default: { root: "ABZ", through: "g" },
    subtypes: {
      loop: { root: "WSL" }, // passing loop
      tee: { root: "TEE" }, // T-junction
      split: { root: "SPL" }, // split / merge
    },
  },
  // Crossing: a line crosses another line or a water feature (KRZ). Independent
  // modifiers — crosses (water -> W), level (over/under -> o/u), formation (the
  // t/h prefix) — plus shared to/from ends. See the crossing block in iconToCode.
  crossing: { default: { root: "KRZ" } },
  // Crossover between parallel tracks (ÜST) / flyover (ÜWB). `level` (o/u) sits
  // right after the root, then to/from (l/r) — vÜST, vÜSTl, vÜSTol, vÜSTo+l.
  crossover: {
    default: { root: "ÜST" },
    subtypes: { flyover: { root: "ÜWB" } }, // Überwerfungsbauwerk (grade-separated)
  },
  // Interchange hub connector: root + entry (a/e) + transverse (q) — HUBaq/HUBeq.
  hub: { default: { root: "HUB" } },
  // Parallel shift (SHI): width prefix + SHI + amount (`by`) + connected ends.
  shift: { default: { root: "SHI" } },
  // Line end / buffer stop (ENDE): + entry (a/e) + state + connectors.
  end: { default: { root: "ENDE" } },
  station: {
    default: { root: "BHF" }, // through
    subtypes: {
      through: { root: "BHF" },
      terminus: { root: "KBHF", entry: "start" }, // needs a/e; defaults to start
      halt: { root: "HST" },
      service: { root: "DST" },
      interchange: { root: "INT" }, // interchange marker (stub via `stub` -> KINT)
    },
  },
  // Standalone point symbols (the "others" catalogue): no default — pick a subtype.
  // Extend this map to cover more of them.
  symbol: {
    subtypes: {
      // transport
      ferry: { root: "BOOT", category: "transport" }, // integral ferry = track+symbol stack
      poleBoat: { root: "BOOT2", category: "transport" },
      trainFerry: { root: "TRAJEKT", category: "transport" },
      barge: { root: "BARGE", category: "transport" },
      bus: { root: "BUS", category: "transport" },
      trolleybus: { root: "OBUS", category: "transport" },
      tram: { root: "TRAM", category: "transport" },
      subway: { root: "SUBWAY", category: "transport" },
      monorail: { root: "MONO", category: "transport" },
      funicular: { root: "FUNI", category: "transport" },
      airport: { root: "FLUG", category: "transport" },
      helipad: { root: "HELI", category: "transport" },
      bicycle: { root: "BICYCLE", category: "transport" },
      parking: { root: "PARKING", category: "transport" },
      rentalCar: { root: "RENTALCAR", category: "transport" },
      carShuttle: { root: "CARSHUTTLE", category: "transport" },
      ambulance: { root: "AMBULANCE", category: "transport" },
      horse: { root: "PFERD", category: "transport" },
      shipWheel: { root: "HELM", category: "transport" },
      // building
      city: { root: "CITY", category: "building" },
      building: { root: "BUILDING", category: "building" },
      house: { root: "HOUSE", category: "building" },
      arch: { root: "ARCH", category: "building" },
      church: { root: "CHURCH", category: "building" },
      castle: { root: "CASTLE", category: "building" },
      palace: { root: "PALACE", category: "building" },
      factory: { root: "FACTORY", category: "building" },
      works: { root: "WORKS", category: "building" },
      mine: { root: "MINE", category: "building" },
      museum: { root: "MUSEUM", category: "building" },
      university: { root: "UNIVERSITY", category: "building" },
      stadium: { root: "STADIUM", category: "building" },
      shopping: { root: "SHOPPING", category: "building" },
      restaurant: { root: "REST", category: "building" },
      repairShop: { root: "REPAIR", category: "building" },
      racetrack: { root: "RACE", category: "building" },
      silo: { root: "SILO", category: "building" },
      pumpHouse: { root: "PUMPHOUSE", category: "building" },
      waterTower: { root: "WTURM", category: "building" },
      windPump: { root: "WindPump", category: "building" },
      waterPump: { root: "WPump", category: "building" },
      // scenic
      mountain: { root: "MOUNTAIN", category: "scenic" },
      forest: { root: "FOREST", category: "scenic" },
      tree: { root: "TREE", category: "scenic" },
      reptile: { root: "REPTILE", category: "scenic" },
      viewpoint: { root: "VIEW", category: "scenic" },
      clock: { root: "TIME", category: "scenic" },
      // infrastructure
      tollbooth: { root: "TOLLBOOTH", category: "infrastructure" },
      walkway: { root: "WALK", category: "infrastructure" }, // pedestrian walkway
      signal: { root: "SIGNAL", category: "infrastructure" },
      electrification: { root: "ELC", category: "infrastructure" },
      levelCrossing: { root: "BUE", category: "infrastructure" },
      trafficLight: { root: "AMPEL", category: "infrastructure" },
      turntable: { root: "DRH", category: "infrastructure" },
      customs: { root: "ZOLL", category: "infrastructure" },
      passportControl: { root: "PASSPORT", category: "infrastructure" },
    },
  },
};

/** The root spec for a kind+subtype, or null if unmodelled / subtype required. */
function specFor(kind: IconKind, subtype?: string): RootSpec | null {
  const entry = ROOTS[kind];
  if (!entry) return null;
  if (subtype && entry.subtypes && subtype in entry.subtypes) return entry.subtypes[subtype]!;
  return entry.default ?? null;
}

/** Valid `subtype` values for a kind — for a context-dependent GUI control. */
export function iconSubtypes(kind: IconKind): string[] {
  return Object.keys(ROOTS[kind]?.subtypes ?? {});
}

/** The picker group a `symbol` subtype belongs to (to auto-fill `category`). */
export function iconSymbolCategory(subtype: string): SymbolCategory | undefined {
  return ROOTS.symbol?.subtypes?.[subtype]?.category;
}

/** Diagram-wide defaults a per-icon value overrides (the "global config"). */
export interface IconContext {
  region?: "uk" | "gb";
  state?: IconState;
}

/** Serialize a semantic icon object to its BSicon code. `ctx` supplies diagram-
 *  wide defaults (`region`, `state`, …) that a per-icon value overrides. */
export function iconToCode(icon: IconObject, ctx?: IconContext): string {
  if (icon.code != null) return icon.code; // escape hatch wins
  // A spacer is just the width-prefix token by itself ("" = full empty, "d" =
  // half, "c" = quarter, …); no root, no other prefixes/suffixes.
  if (icon.kind === "spacer") return icon.width ? WIDTH[icon.width] : "";
  const spec = specFor(icon.kind, icon.subtype);
  if (spec == null) {
    throw new Error(`iconToCode: kind "${icon.kind}" not supported yet — pass { code } instead`);
  }
  const entry = icon.entry ?? spec.entry; // subtype default (e.g. terminus -> start)
  // A track with both portals enclosed (entry: "both") becomes a self-contained
  // root (TUNNEL) in place of STR + the t/h prefix; the both-ness is absorbed
  // into the root, so no trailing a/e.
  const enclosed =
    icon.kind === "track" && entry === "both" && icon.formation
      ? ENCLOSED_ROOT[icon.formation]
      : undefined;
  // A continuation runs off the diagram edge — the CONT root in place of STR
  // (a line form: track now, water later).
  const continuation = icon.kind === "track" && icon.continuation;
  // Road crossing (roadClass set) → the SKRZ root; accessible station → ACC set
  // (BHF→ACC / KBHF→KACC by replace, else append ACC).
  const base =
    icon.kind === "crossing" && icon.roadClass != null
      ? "SKRZ"
      : icon.accessible && icon.kind === "station"
        ? spec.root.includes("BHF")
          ? spec.root.replace("BHF", "ACC")
          : `${spec.root}ACC`
        : spec.root;
  const root = enclosed
    ? enclosed
    : continuation
      ? "CONT"
      : icon.stub
        ? `K${base}` // K = stub/dead-end
        : base;
  let s = "";
  // prefixes: colour -> state -> line-type -> width
  if (icon.system) s += SYSTEM[icon.system];
  const state = icon.state ?? ctx?.state; // per-icon state overrides the diagram default
  if (state) s += STATE[state];
  if (icon.legend) s += "l"; // legend line type
  if (icon.formation && !enclosed) s += FORMATION[icon.formation]; // enclosed root carries it
  if (icon.width) s += WIDTH[icon.width];
  if (icon.curve) s += icon.curve === "sBend" ? "kk" : "k"; // wider-radius / S-bend curve
  if (icon.parallel) s += "v"; // parallel double track, tied to the root
  if (icon.lane === "left") s += "-"; // left/bottom lane: leading hyphen
  if (icon.interruptedCorners) s += "LL"; // interruption, hugs root
  else if (icon.interrupted) s += "L";
  if (icon.doubleRow) s += "2"; // 2-row shift prefix (2SHI…)
  s += root;
  // suffixes: [enclosed len/W | through | crossing level/W | shift by]
  //   -> to -> bare-corner -> +from -> +corner -> direction(f/g) -> a/e/ae -> connect(-L/R/M) -> q -> @offset -> lane
  if (enclosed) {
    s += (icon.length ?? "long") === "long" ? "1" : "2"; // TUNNEL1 / TUNNEL2
    if (icon.crosses === "water") s += "W"; // TUNNEL1W (under water)
  }
  if (spec.through && icon.through !== false) s += spec.through; // ABZ -> g
  if (icon.kind === "crossing") {
    if (icon.roadClass) s += `-${roadCode(icon.roadClass, icon.roadLanes, icon.region ?? ctx?.region)}`;
    if (icon.level) s += icon.level === "over" ? "o" : "u"; // KRZo / KRZu / SKRZ-Bo
    if (icon.crosses === "water") s += "W"; // KRZW
  }
  // A plain line over or under something: STRo / STRu. Same position in the order.
  if (icon.kind === "track" && icon.level) s += icon.level === "over" ? "o" : "u";
  // Crossover level sits right after the root too (vÜSTol), then to/from below.
  if (icon.kind === "crossover" && icon.level) s += icon.level === "over" ? "o" : "u";
  if (icon.kind === "shift") s += String(icon.by ?? 2); // SHI -> SHI2
  if (icon.kind === "track" && icon.variant != null) s += String(icon.variant); // canal lock: LOCK -> LOCK2
  // CONT and shifts put the f/g direction BEFORE the ends (CONTf3, SHI2gl);
  // STR curves put it after.
  const dirFirst = continuation || icon.kind === "shift";
  if (dirFirst && icon.direction) s += icon.direction === "forward" ? "f" : "g";
  if (icon.to != null) s += endToken(icon.to);
  if (icon.corner != null && !icon.cornerAdd) s += `c${cornerTok(icon.corner)}`;
  if (icon.from != null) s += `+${endToken(icon.from)}`;
  if (icon.corner != null && icon.cornerAdd) s += `+c${cornerTok(icon.corner)}`;
  if (icon.direction && !dirFirst) s += icon.direction === "forward" ? "f" : "g"; // STR curves: f/g after the ends
  if (!enclosed) {
    if (entry === "start") s += "a";
    else if (entry === "end") s += "e";
    else if (entry === "both") s += "ae"; // span start+end both present (hKRZWae "long bridge")
  }
  if (icon.connect)
    s += icon.connect === "both" ? "-M" : icon.connect === "left" ? "-L" : "-R"; // neighbour connector
  if (icon.transverse) s += "q";
  if (icon.offset) {
    const d = icon.offset === "forward" ? "f" : "g";
    s += `@${icon.offsetTarget === "auxiliary" ? d : d.toUpperCase()}`; // @F/@G secondary (default), @f/@g auxiliary
  }
  if (icon.lane === "right") s += "-"; // right/top lane: trailing hyphen
  // A coloured variant is a different FILE, and the colour is the last thing in its name.
  if (icon.colour) s += ` ${icon.colour}`;
  return s;
}
