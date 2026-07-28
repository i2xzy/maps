/**
 * Pure coercion helpers over the grid-JSON union types. The renderer and any
 * future serializer both consume these, so the "what shape is this cell?" logic
 * lives here once (DRY) rather than being re-derived at each call site.
 */
import type {
  Cell,
  CellIcon,
  CellObject,
  IconCode,
  LabelIcon,
  RouteDiagram,
  SideLabel,
  BreakRun,
  SideSlots,
  SplitRun,
  TextRun,
} from "./types";
import { isGridRow } from "./types";
import { iconToCode, type IconContext, type IconObject } from "./icon";
import { codeToIcon } from "./parse";

/**
 * Apply diagram defaults (state / region) to a RAW code string: decode it, fill
 * any field the code doesn't already set, and re-emit. Codes that don't
 * structurally decode (Tier-3: `\`, `~`, `!~`, …) are returned verbatim.
 */
function applyDefaults(code: string, ctx: IconContext): IconCode {
  if (ctx.state == null && ctx.region == null) return code;
  const obj = codeToIcon(code);
  if (obj.code != null) return code; // couldn't decode -> leave the raw code alone
  const filled: IconObject = { ...obj };
  if (ctx.state != null && filled.state == null) filled.state = ctx.state;
  try {
    return iconToCode(filled, ctx); // ctx also carries region (for road crossings)
  } catch {
    return code;
  }
}

/** Normalized side label shape shared by normalize + layout + render. */
export interface NormalizedSide {
  text?: string | TextRun[];
  icons?: LabelIcon[];
  link?: string | true;
  title?: string;
  italic?: boolean;
  bold?: boolean;
}

/** The BSicon code for an icon: a bare string, a semantic object, or an IconRef.
 *  A semantic object with an unknown/incomplete kind (e.g. mid-typing "s" for
 *  "station") degrades to "" rather than throwing, so the editor preview survives. */
export function iconCode(icon: CellIcon, ctx?: IconContext): IconCode {
  if (typeof icon === "string") return ctx ? applyDefaults(icon, ctx) : icon;
  if ("kind" in icon) {
    try {
      return iconToCode(icon, ctx); // semantic IconObject -> code (with diagram defaults)
    } catch {
      return icon.code ?? "";
    }
  }
  return ctx ? applyDefaults(icon.code, ctx) : icon.code; // IconRef: a raw code + metadata
}

/**
 * Coerce any `Cell` shape into a canonical `CellObject`, or `null` when empty.
 *   null / []               -> null
 *   "STR"                   -> { stack: ["STR"] }
 *   ["STR","exSTR"]         -> { stack: ["STR","exSTR"] }
 *   { code: "STR", href }   -> { stack: [{ code, href }] }
 *   { stack: [...], note }  -> unchanged (empty stack -> null)
 */
export function normalizeCell(cell: Cell): CellObject | null {
  if (cell == null) return null;
  if (typeof cell === "string") return { stack: [cell] };
  if (Array.isArray(cell)) return cell.length ? { stack: cell } : null;
  if ("stack" in cell) return Array.isArray(cell.stack) && cell.stack.length ? cell : null;
  return { stack: [cell] }; // an IconRef object
}

/** Coerce a `SideLabel` into a `NormalizedSide`, or `null` when empty. */
export function normalizeSide(side: SideLabel | null | undefined): NormalizedSide | null {
  if (side == null) return null;
  if (typeof side === "string") return side ? { text: side } : null;
  if (Array.isArray(side)) return side.length ? { text: side } : null;
  // Accept a single icon written without the array wrapper (icons: {region}).
  const icons =
    side.icons == null ? undefined : Array.isArray(side.icons) ? side.icons : [side.icons];
  // Whole-label `rws` is sugar for a single station run (when there's no text).
  const empty = side.text == null || side.text === "" || (Array.isArray(side.text) && !side.text.length);
  const text = empty && side.rws ? [{ rws: side.rws }] : side.text;
  const hasText = Array.isArray(text) ? text.length > 0 : !!text && text.length > 0;
  const hasIcons = !!icons && icons.length > 0;
  if (!hasText && !hasIcons) return null;
  return {
    text,
    icons,
    link: side.link,
    title: side.title,
    italic: side.italic,
    bold: side.bold,
  };
}

/** A run that carries content, as opposed to a `{ split }` or a bare string. */
type ContentRun = Exclude<TextRun, string | SplitRun | BreakRun>;

/**
 * Every content-bearing run in a label's text, with `{ split }` runs flattened.
 *
 * Anything walking runs has to see INSIDE a split, or a logo or station link nested in
 * one silently never resolves — the collectors feed the API lookups, so a missed run
 * renders as a blank rather than as an error.
 */
export function labelRuns(text: string | TextRun[] | null | undefined): ContentRun[] {
  if (text == null || typeof text === "string") return [];
  const out: ContentRun[] = [];
  for (const run of text) {
    if (typeof run === "string" || "br" in run) continue;
    if ("split" in run) {
      for (const line of run.split) out.push(...labelRuns(typeof line === "string" ? [] : line));
      continue;
    }
    out.push(run);
  }
  return out;
}

/** The slot names, innermost first — the order the RIGHT side is written in. */
export const SLOT_NAMES = ["dist", "main", "remark", "outer"] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Every slot of one side, normalized; absent slots are null. */
export type NormalizedSlots = Record<SlotName, NormalizedSide | null>;

/** All four slots empty — a side with no labels at all. */
export function emptySlots(): NormalizedSlots {
  return { dist: null, main: null, remark: null, outer: null };
}

/**
 * Whether a side object is the multi-slot form rather than a single label.
 *
 * Decided on keys, because the two shapes have none in common: `SideSlots` is
 * dist/main/remark/outer, `SideLabel` is text/rws/icons/link/title/italic/bold. An
 * object carrying no key from either is empty, and reading it as a lone label puts
 * `null` in `main`, which is the same answer.
 */
function isSideSlots(side: object): side is SideSlots {
  return SLOT_NAMES.some((name) => name in side);
}

/**
 * Coerce either side shape into all four slots.
 *
 * A lone label becomes `main`, not `dist` — the wiki's positional default, which
 * `Module:Routemap` states as "assume only linfo2 was provided". Getting this
 * backwards would misplace every single-label row in every diagram.
 */
export function normalizeSlots(
  side: SideLabel | SideSlots | null | undefined,
): NormalizedSlots {
  const empty = emptySlots();
  if (side == null) return empty;
  if (typeof side === "object" && !Array.isArray(side) && isSideSlots(side)) {
    return {
      dist: normalizeSide(side.dist),
      main: normalizeSide(side.main),
      remark: normalizeSide(side.remark),
      outer: normalizeSide(side.outer),
    };
  }
  return { ...empty, main: normalizeSide(side as SideLabel) };
}

/**
 * The RAW value of one slot, whichever shape the side is written in.
 *
 * Raw, not normalized: an editor needs the author's own value back to put in a form,
 * not the coerced `{ text }` that `normalizeSlots` produces.
 */
export function slotOf(
  side: SideLabel | SideSlots | null | undefined,
  name: SlotName,
): SideLabel | null | undefined {
  if (side == null) return side;
  if (typeof side === "object" && !Array.isArray(side) && isSideSlots(side)) return side[name];
  // A plain label IS `main` — every other slot of such a side is empty.
  return name === "main" ? (side as SideLabel) : undefined;
}

/**
 * Set one slot, keeping the side written as simply as it can be.
 *
 * Promotes a plain label to the slots form only once a second slot appears, and
 * demotes back when `main` is the only one left — so adding a remark and removing it
 * again leaves the JSON exactly as it started, rather than `{ main: … }` for good.
 * Without the demote the document drifts to the verbose form and never returns.
 *
 * Demotion checks that the survivor is `main` specifically. A side holding only
 * `dist` has to stay an object: written as a plain label it would be read as `main`.
 */
export function withSlot(
  side: SideLabel | SideSlots | null | undefined,
  name: SlotName,
  value: SideLabel | null | undefined,
): SideLabel | SideSlots | null | undefined {
  const next: SideSlots = {
    dist: slotOf(side, "dist") ?? undefined,
    main: slotOf(side, "main") ?? undefined,
    remark: slotOf(side, "remark") ?? undefined,
    outer: slotOf(side, "outer") ?? undefined,
  };
  next[name] = value ?? undefined;

  // `normalizeSide` already decides emptiness for every SideLabel shape — string,
  // run array, or object — so reuse it rather than re-deriving the rule here.
  const filled = SLOT_NAMES.filter((n) => normalizeSide(next[n] ?? null) != null);
  if (filled.length === 0) return undefined;
  if (filled.length === 1 && filled[0] === "main") return next.main;
  // Rebuilt from the filled slots only, so an emptied one leaves no `""` behind and
  // no `undefined` keys reach the author's JSON.
  const out: SideSlots = {};
  for (const n of filled) out[n] = next[n];
  return out;
}

/** Whether any slot of a side holds anything. */
export function hasAnySlot(slots: NormalizedSlots): boolean {
  return SLOT_NAMES.some((name) => slots[name] != null);
}

/** Max column count across grid rows (explicit `diagram.columns` wins). */
export function diagramColumns(diagram: RouteDiagram): number {
  if (diagram.columns != null) return diagram.columns;
  let max = 0;
  for (const row of diagram.rows) {
    if (isGridRow(row)) max = Math.max(max, row.cells?.length ?? 0);
  }
  return max;
}

/* ------------------------------------------------------------------ */
/* Width prefixes (spacer/text cells only)                             */
/* ------------------------------------------------------------------ */
/*
 * How {{Routemap}} handles widths (verified against Module:Routemap +
 * Template:Routemap/styles.css):
 *   - A real ICON is never width-parsed. It renders as `[[File:…|x20px]]` —
 *     fixed height, width auto — so its width comes straight from the SVG's own
 *     aspect ratio. That is why stacked prefixes like `etdKRZ` (ex+tunnel+half)
 *     "just work": the half-width is baked into the file's 250x500 viewBox.
 *   - Only a *bare* cell that is a pure width-prefix (an empty spacer, or a
 *     prefixed text cell) gets an explicit width, via the additive units below.
 */

/** Width-prefix units, as a fraction of a full (500-unit / 20px) cell. Additive. */
const WIDTH_UNITS: Record<string, number> = {
  o: 1 / 8, // 2.5px @ 20px full — eighth
  c: 1 / 4, // 5px  — quarter
  d: 1 / 2, // 10px — half
  _: 1, //     20px — a full-cell unit
  "+": 1, //   Routemap normalises `+` to `_` (also a full-cell unit)
  b: 2, //     40px — broad (double)
  s: 4, //     80px
  w: 8, //     160px
};

// {{Routemap}}'s own test for an *empty* (spacer) cell: an optional leading +/_
// then o?c?d?b?s?w? in canonical order and nothing else. A token that matches
// has no ROOT, so it is a sized blank, never an icon. "cSTR"/"STRc3"/"etdKRZ"
// all contain a ROOT and so fail this test — they are icons.
const WIDTH_PREFIX_RE = /^[+_]?o?c?d?b?s?w?$/;

/** True if `token` is a pure BSicon width prefix (a spacer cell), not an icon.
 *  Defensive against a missing/non-string code so a malformed cell can't crash. */
export function isWidthPrefix(token: string): boolean {
  return typeof token === "string" && token.length > 0 && WIDTH_PREFIX_RE.test(token);
}

/** Width of a pure width-prefix token as a fraction of a full cell (additive). */
export function prefixWidthFraction(token: string): number {
  let sum = 0;
  for (const ch of token) sum += WIDTH_UNITS[ch] ?? 0;
  return sum;
}
