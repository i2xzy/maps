/**
 * BSicon codes -> semantic icon objects — the reverse of `iconToCode`.
 *
 * `codeToIcon` is a *two-path* parser wrapped in a round-trip safety net:
 *
 *   1. Tier-3 passthrough. If the code carries a marker we don't model
 *      (`\`, `!~`, `~`, `:`, `.`, `(`/`)`, or a hyphen sitting *between* two
 *      full tokens like `vBHF-eBHF`) we bail immediately to the raw escape
 *      hatch `{ code }`. `@` is NOT such a marker — it's the offset field.
 *   2. Generative decode. Strip the known prefixes (system -> state -> legend
 *      -> formation -> width -> parallel `v` -> lane leading-`-` -> interruption
 *      `L`/`LL`) in catalogue order, match the ROOT (longest-match, incl. the
 *      `K` stub modifier and the ACC accessible / TUNNEL enclosed / CONT
 *      continuation forms), then parse the suffixes.
 *   3. Round-trip verify. Feed the candidate back through `iconToCode`; if it
 *      does not re-emit the *exact* original code, discard it and passthrough.
 *
 * Step 3 is what makes step 2 safe: serialization is many-to-one (e.g. `u` is
 * both metro and navigable canal, `cd` is a width but also `c`+`d`), so we
 * decode by CODE, not by intent. Any decode we get wrong simply fails the
 * round-trip and falls back to `{ code }` — the parser can never emit a wrong
 * object.
 */
import {
  iconToCode,
  widthFromCode,
  type Corner,
  type IconEnd,
  type IconFormation,
  type IconObject,
  type IconSystem,
  type IconWidth,
} from "./icon";

// ── prefix reverse-maps ────────────────────────────────────────────────────
const SYSTEM_BY_CODE: Record<string, IconSystem> = {
  u: "metro",
  s: "sbahn",
  f: "footpath",
  g: "canal",
};
const FORMATION_BY_CODE: Record<string, IconFormation> = {
  t: "tunnel",
  h: "elevated",
  C: "cutting",
  D: "embankment",
};
// Longest-first so `oc`/`cd`/`bs` win over their single-letter members.
const WIDTHS: [string, IconWidth][] = [
  ["oc", "three-eighth"],
  ["cd", "three-quarter"],
  ["bs", "sextuple"],
  ["o", "eighth"],
  ["c", "quarter"],
  ["d", "half"],
  ["b", "double"],
  ["s", "quad"],
  ["w", "octuple"],
];

// The prefix alphabet — used to tell a *leading lane* hyphen (`v-STR`, `d-STR`)
// from a composite separator (`vBHF-eBHF`): only prefix chars may precede a
// leading hyphen. Uppercase C/D are the cutting/embankment formations.
const PREFIX_CHARS = new Set("usfgexlthocdbwvk2CD".split(""));

// ── root table ──────────────────────────────────────────────────────────────
/** A known ROOT token and the fields it decodes to (before the `K` stub). */
interface RootEntry {
  token: string;
  fields: () => Partial<IconObject>;
}
// Sorted longest-first so e.g. HSTACC beats HST+ACC and BOOT2 beats BOOT.
const BASE_ROOTS: RootEntry[] = [
  { token: "TOLLBOOTH", fields: () => ({ kind: "symbol", subtype: "tollbooth" }) },
  { token: "HSTACC", fields: () => ({ kind: "station", subtype: "halt", accessible: true }) },
  { token: "DSTACC", fields: () => ({ kind: "station", subtype: "service", accessible: true }) },
  { token: "INTACC", fields: () => ({ kind: "station", subtype: "interchange", accessible: true }) },
  // Enclosed tunnel: both portals in the cell -> the self-contained TUNNEL root.
  { token: "TUNNEL", fields: () => ({ kind: "track", formation: "tunnel", entry: "both" }) },
  { token: "BOOT2", fields: () => ({ kind: "symbol", subtype: "poleBoat" }) },
  { token: "CONT", fields: () => ({ kind: "track", continuation: true }) },
  { token: "ENDE", fields: () => ({ kind: "end" }) },
  { token: "WALK", fields: () => ({ kind: "symbol", subtype: "walkway" }) },
  { token: "BOOT", fields: () => ({ kind: "symbol", subtype: "ferry" }) },
  { token: "BHF", fields: () => ({ kind: "station" }) },
  { token: "HST", fields: () => ({ kind: "station", subtype: "halt" }) },
  { token: "DST", fields: () => ({ kind: "station", subtype: "service" }) },
  { token: "INT", fields: () => ({ kind: "station", subtype: "interchange" }) },
  { token: "ACC", fields: () => ({ kind: "station", accessible: true }) },
  { token: "ABZ", fields: () => ({ kind: "junction" }) },
  { token: "WSL", fields: () => ({ kind: "junction", subtype: "loop" }) },
  { token: "TEE", fields: () => ({ kind: "junction", subtype: "tee" }) },
  { token: "SPL", fields: () => ({ kind: "junction", subtype: "split" }) },
  { token: "KRZ", fields: () => ({ kind: "crossing" }) },
  { token: "ÜWB", fields: () => ({ kind: "crossover", subtype: "flyover" }) },
  { token: "ÜST", fields: () => ({ kind: "crossover" }) },
  { token: "HUB", fields: () => ({ kind: "hub" }) },
  { token: "SHI", fields: () => ({ kind: "shift" }) },
  { token: "STR", fields: () => ({ kind: "track" }) },
  { token: "BL", fields: () => ({ kind: "track", subtype: "walkway" }) },
];

interface RootMatch {
  token: string;
  fields: Partial<IconObject>;
  rest: string;
  stub: boolean;
}

/** Longest-match a base root at the start of `s`. */
function matchBaseRoot(s: string): RootMatch | null {
  for (const { token, fields } of BASE_ROOTS) {
    if (s.startsWith(token)) {
      return { token, fields: fields(), rest: s.slice(token.length), stub: false };
    }
  }
  return null;
}

/**
 * Match a root, honouring the leading `K` stub modifier. `K` only counts as a
 * stub when a real root follows it (so `KRZ` stays the crossing root, since
 * `RZ` matches nothing).
 */
function matchRoot(s: string): RootMatch | null {
  if (s.startsWith("K")) {
    const inner = matchBaseRoot(s.slice(1));
    if (inner) return { ...inner, stub: true };
  }
  return matchBaseRoot(s);
}

// ── passthrough markers ───────────────────────────────────────────────────
const isPrefixOnly = (s: string): boolean => [...s].every((c) => PREFIX_CHARS.has(c));

/** A hyphen between two full tokens (`vBHF-eBHF`), not a lane/connector `-`. */
function hasCompositeHyphen(code: string): boolean {
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== "-") continue;
    if (i === code.length - 1) continue; // trailing lane hyphen (STR-)
    const rest = code.slice(i + 1);
    if (rest === "L" || rest === "R" || rest === "M") continue; // connector -L/-R/-M
    if (isPrefixOnly(code.slice(0, i))) continue; // leading lane hyphen (v-STR)
    return true;
  }
  return false;
}

function hasPassthroughMarker(code: string): boolean {
  return (
    code.includes("\\") ||
    code.includes("!~") ||
    code.includes("~") ||
    code.includes(":") ||
    code.includes(".") ||
    code.includes("(") ||
    code.includes(")") ||
    hasCompositeHyphen(code)
  );
}

// ── suffix helpers ──────────────────────────────────────────────────────────
const isCornerDigit = (c: string | undefined): boolean => c != null && c >= "1" && c <= "4";

/** A maximal run of end tokens (l / r / 1–4) from the front of `s`. */
function parseEnds(s: string): { ends: IconEnd[]; rest: string } {
  const ends: IconEnd[] = [];
  let i = 0;
  for (; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "l") ends.push("left");
    else if (ch === "r") ends.push("right");
    else if (ch >= "1" && ch <= "4") ends.push(Number(ch) as Corner);
    else break;
  }
  return { ends, rest: s.slice(i) };
}

const oneOrMany = (ends: IconEnd[]): IconEnd | IconEnd[] => (ends.length === 1 ? ends[0]! : ends);

// ── the decoder ──────────────────────────────────────────────────────────────
/**
 * Attempt a structural decode. Returns the candidate object, or null if the
 * code has leftover tokens we couldn't place (which becomes a passthrough).
 */
function tryDecode(code: string, forceFormation: boolean): IconObject | null {
  const obj: Partial<IconObject> = {};
  let s = code;

  // prefixes, in catalogue order: system -> state -> legend -> formation ->
  // width -> parallel -> lane(leading -) -> interruption
  const sys = s[0];
  if (sys != null && sys in SYSTEM_BY_CODE) {
    obj.system = SYSTEM_BY_CODE[sys];
    s = s.slice(1);
  }
  if (s.startsWith("ex")) {
    obj.state = "disused";
    s = s.slice(2);
  } else if (s.startsWith("x")) {
    obj.state = "disused-primary";
    s = s.slice(1);
  } else if (s.startsWith("e")) {
    obj.state = "disused-secondary";
    s = s.slice(1);
  }
  if (s.startsWith("l")) {
    obj.legend = true;
    s = s.slice(1);
  }
  // Formation: strip a t/h/C/D. Normally only when it isn't itself the start of
  // a root (so `CONT` keeps its C, `CSTR` sheds it). `forceFormation` overrides
  // that for the ambiguous case where a root shadows the prefix (`DSTR` = D+STR,
  // shadowed by the `DST` root) — the round-trip net picks the right pass.
  const fmt = s[0];
  if (fmt != null && fmt in FORMATION_BY_CODE && (forceFormation || matchRoot(s) == null)) {
    obj.formation = FORMATION_BY_CODE[fmt];
    s = s.slice(1);
  }
  for (const [token, width] of WIDTHS) {
    if (s.startsWith(token)) {
      obj.width = width;
      s = s.slice(token.length);
      break;
    }
  }
  // curve radius (lowercase k / kk) — roots use uppercase K, so no clash.
  if (s.startsWith("kk")) {
    obj.curve = "sBend";
    s = s.slice(2);
  } else if (s.startsWith("k")) {
    obj.curve = "wide";
    s = s.slice(1);
  }
  if (s.startsWith("v")) {
    obj.parallel = true;
    s = s.slice(1);
  }
  if (s.startsWith("-")) {
    obj.lane = "left"; // leading hyphen = left/bottom lane
    s = s.slice(1);
  }
  if (s.startsWith("LL")) {
    obj.interruptedCorners = true;
    s = s.slice(2);
  } else if (s.startsWith("L")) {
    obj.interrupted = true;
    s = s.slice(1);
  }
  if (s.startsWith("2")) {
    obj.doubleRow = true; // 2-row shift prefix (2SHI…)
    s = s.slice(1);
  }

  // root
  const root = matchRoot(s);
  if (!root) return null;
  Object.assign(obj, root.fields);
  if (root.stub) obj.stub = true;
  s = root.rest;

  const enclosed = root.token === "TUNNEL";
  const throughRoot = root.token === "ABZ";
  const crossing = obj.kind === "crossing";
  // A plain line can also pass over or under something — `STRo` is an overbridge,
  // `STRu` an underbridge. The model already had `level`; it was just fenced off to
  // crossings, so the commonest suffix on the commonest root didn't decode.
  const levelled = crossing || obj.kind === "track";
  const crossover = obj.kind === "crossover";
  const shift = obj.kind === "shift";
  const continuation = obj.continuation === true;

  // ── suffixes ──
  // Enclosed TUNNEL is self-contained: length 1/2 (+ optional W), nothing else.
  if (enclosed) {
    if (s[0] === "1") s = s.slice(1); // long is the default
    else if (s[0] === "2") {
      obj.length = "short";
      s = s.slice(1);
    } else return null;
    if (s[0] === "W") {
      obj.crosses = "water";
      s = s.slice(1);
    }
    return s.length === 0 ? (obj as IconObject) : null;
  }

  // ABZ through-line: a leading `g` right after the root; its absence means the
  // branch-only form, so we pin through:false to stop iconToCode re-adding it.
  if (throughRoot) {
    if (s[0] === "g") s = s.slice(1);
    else obj.through = false;
  }
  // Grade separation: level o/u, then water W (crossings only).
  if (levelled) {
    if (s[0] === "o") {
      obj.level = "over";
      s = s.slice(1);
    } else if (s[0] === "u") {
      obj.level = "under";
      s = s.slice(1);
    }
    if (s[0] === "W") {
      obj.crosses = "water";
      s = s.slice(1);
    }
  }
  // Crossover grade separation: level o/u right after the root, before the ends.
  if (crossover) {
    if (s[0] === "o") {
      obj.level = "over";
      s = s.slice(1);
    } else if (s[0] === "u") {
      obj.level = "under";
      s = s.slice(1);
    }
  }
  // Shift always carries its amount (default 2 is still emitted).
  if (shift) {
    const d = s[0];
    if (d != null && d >= "1" && d <= "8") {
      obj.by = Number(d) as IconObject["by"];
      s = s.slice(1);
    } else return null;
  }
  // CONT and shifts put their f/g direction *before* the ends.
  const dirFirst = continuation || shift;
  if (dirFirst) {
    if (s[0] === "f") {
      obj.direction = "forward";
      s = s.slice(1);
    } else if (s[0] === "g") {
      obj.direction = "back";
      s = s.slice(1);
    }
  }

  // to end(s)
  {
    const { ends, rest } = parseEnds(s);
    if (ends.length) {
      obj.to = oneOrMany(ends);
      s = rest;
    }
  }
  // bare corner c<n>, or a pair c<n><m> (SHI2c14)
  if (s[0] === "c" && isCornerDigit(s[1])) {
    if (isCornerDigit(s[2])) {
      obj.corner = [Number(s[1]) as Corner, Number(s[2]) as Corner];
      s = s.slice(3);
    } else {
      obj.corner = Number(s[1]) as Corner;
      s = s.slice(2);
    }
    obj.cornerAdd = false;
  }
  // from end(s): +<ends>, but not the additive +c<n>
  if (s[0] === "+" && s[1] != null && s[1] !== "c") {
    const { ends, rest } = parseEnds(s.slice(1));
    if (!ends.length) return null; // stray +
    obj.from = oneOrMany(ends);
    s = rest;
  }
  // additive corner +c<n> (or a pair +c<n><m>)
  if (s[0] === "+" && s[1] === "c" && isCornerDigit(s[2])) {
    if (isCornerDigit(s[3])) {
      obj.corner = [Number(s[2]) as Corner, Number(s[3]) as Corner];
      s = s.slice(4);
    } else {
      obj.corner = Number(s[2]) as Corner;
      s = s.slice(3);
    }
    obj.cornerAdd = true;
  }
  // direction f/g on straights/curves (CONT/shift already consumed theirs above)
  if (!dirFirst) {
    if (s[0] === "f") {
      obj.direction = "forward";
      s = s.slice(1);
    } else if (s[0] === "g") {
      obj.direction = "back";
      s = s.slice(1);
    }
  }
  // entry a / e / ae
  if (s.startsWith("ae")) {
    obj.entry = "both";
    s = s.slice(2);
  } else if (s[0] === "a") {
    obj.entry = "start";
    s = s.slice(1);
  } else if (s[0] === "e") {
    obj.entry = "end";
    s = s.slice(1);
  }
  // neighbour connector -L / -R / -M
  if (s[0] === "-" && (s[1] === "L" || s[1] === "R" || s[1] === "M")) {
    obj.connect = s[1] === "M" ? "both" : s[1] === "L" ? "left" : "right";
    s = s.slice(2);
  }
  // transverse q
  if (s[0] === "q") {
    obj.transverse = true;
    s = s.slice(1);
  }
  // @ offset: uppercase F/G = secondary (default), lowercase f/g = auxiliary
  if (s[0] === "@" && s[1] != null) {
    const d = s[1];
    if (d === "F" || d === "f") obj.offset = "forward";
    else if (d === "G" || d === "g") obj.offset = "back";
    else return null;
    obj.offsetTarget = d === d.toUpperCase() ? "secondary" : "auxiliary";
    s = s.slice(2);
  }
  // trailing lane hyphen (right/top lane) — only a lone `-` at the very end
  if (s === "-") {
    obj.lane = "right";
    s = "";
  }

  return s.length === 0 ? (obj as IconObject) : null;
}

/**
 * Parse a BSicon code back into a semantic `IconObject`. Guarantees a faithful
 * result: anything we can't structurally decode (or that wouldn't re-serialize
 * to the exact same code) comes back as the raw escape hatch `{ code }`.
 */
export function codeToIcon(code: string): IconObject {
  // The raw escape hatch: `code` short-circuits everything in iconToCode, so
  // `kind` is irrelevant here (cast past the required field).
  const passthrough = { code } as IconObject;
  if (hasPassthroughMarker(code)) return passthrough;

  // A spacer is written as its width prefix and NOTHING else: `b`, `d`, `cd`. Those are
  // ~11% of cells in real diagrams, and `iconToCode` has always emitted them — only the
  // decode was missing, so the round-trip ran one way and the form could never edit one.
  if (code === "") return { kind: "spacer" };
  const width = widthFromCode(code);
  if (width) return { kind: "spacer", width };

  // A coloured variant: `tSTR yellow`, `STRq green`. Split the colour off and decode the
  // base, so every combination works without the root table knowing about colours. 18% of
  // cells in real diagrams carry one. Nothing else in a code contains a space, so a
  // trailing word after one is always this.
  const coloured = / ([A-Za-z]+)$/.exec(code);
  if (coloured) {
    const base = codeToIcon(code.slice(0, coloured.index));
    if ("kind" in base) {
      const withColour = { ...base, colour: coloured[1] } as IconObject;
      if (iconToCode(withColour) === code) return withColour;
    }
    return passthrough;
  }
  // Greedy decode first, then a pass that force-strips a leading formation letter
  // (finds `DSTR` = D+STR despite the shadowing `DST` root). The round-trip net
  // keeps only an exact re-emit, so trying both passes is always safe.
  for (const forceFormation of [false, true]) {
    const candidate = tryDecode(code, forceFormation);
    if (!candidate) continue;
    try {
      if (iconToCode(candidate) === code) return candidate;
    } catch {
      // not serializable — try the next pass / passthrough
    }
  }
  return passthrough;
}
