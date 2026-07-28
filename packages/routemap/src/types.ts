/**
 * Grid-JSON: the source-of-truth model for a BSicon route diagram.
 *
 * It mirrors the Wikipedia `{{Routemap}}` grid (rows x columns x icon-stacks x
 * labels) plus a verbatim map-params bag, so it can represent any diagram and
 * (later) round-trip to wiki code. v1 is RENDER-ONLY; the wiki parser/serializer
 * are deferred (see design doc D2). Unknown tokens are preserved verbatim as raw
 * icon codes so nothing is ever silently dropped.
 *
 *   RouteDiagram
 *     ├─ map?      MapMeta        (the {{Routemap}} call, params verbatim)
 *     ├─ columns?  number         (max column count; derived if omitted)
 *     └─ rows[]    DiagramRow
 *          ├─ GridRow    { left?, right?, cells: Cell[] }
 *          │      cells[i] = one column slot:
 *          │        null            empty column
 *          │        "STR"           single icon
 *          │        ["STR","exSTR"] overlay stack (Routemap `!~`)
 *          │        { stack, note } stack + right annotation (Routemap `~~`)
 *          └─ ColspanRow { type:'colspan', text }   full-width text/legend row
 *
 * `{{Routemap}}` operator -> model mapping (the round-trip contract). Taken from
 * `Module:Routemap`, which is the real parser; its own grammar comment reads:
 *
 *   rowProps~~linfo4~~linfo3~~linfo2~~linfo1! !(icons)~~rinfo1~~rinfo2~~rinfo3~~rinfo4~~rowProps
 *
 *   `\`     column separator      -> element boundary in cells[]
 *   `!~`    overlay               -> Cell array / CellObject.stack
 *   `! !`   left labels | icons   -> GridRow.left (the LEFT boundary only)
 *   `~~`    label slot separator  -> SideSlots, four per side
 *   `-colspan-` full-width row    -> ColspanRow
 *
 * The slots are numbered OUTWARD FROM THE ICONS on both sides (info1 nearest), so
 * the left side is written outermost-first and the right side innermost-first — the
 * source then reads in the same order as the rendered page. A lone label is info2
 * ("main text"), NOT info1: the module says so outright ("assume only linfo2 was
 * provided"), and reading it as info1 would misplace every simple label.
 *
 * Geometry (from the T1 spike — deterministic, see .context/rdt-spike/FINDINGS.md):
 *   full icon  = 500x500 SVG units, centre line at x=250
 *   v (double) = 500x500, lanes at x=125 / x=375
 *   d (half)   = 250x500, line at x=125 (== v left lane); c (quarter) = 125x500
 * An icon's width is intrinsic to its SVG file, so the renderer sizes every icon
 * purely by aspect ratio at a fixed height — exactly how {{Routemap}} does it
 * (`[[File:…|x20px]]`, width auto). No width prefix is parsed from icon codes, so
 * stacked prefixes like `etdKRZ` (ex+tunnel+half) just work. The o/c/d/b/s/w
 * prefixes only get an explicit width when a cell is a bare spacer (empty column
 * or a lone prefix token); see `prefixWidthFraction` in normalize.ts. FULL_CELL /
 * HALF_CELL remain the unit reference for the (deferred) wiki serializer.
 */

import type { IconContext, IconObject } from "./icon";

/** SVG canvas width/height of a full-size BSicon; one full grid cell. */
export const FULL_CELL = 500;
/** Width of a half-size (`d`-prefixed) BSicon; a half-width grid cell. */
export const HALF_CELL = 250;

/**
 * A BSicon code as it appears in wiki source: no `BSicon_` prefix, no `.svg`.
 * Examples: `STR`, `ABZlg`, `exSTRc3`, `dSTR`, `WBRÜCKE2`, `SKRZ-Bo`.
 * The renderer resolves this to `Special:FilePath/BSicon_<code>.svg` (vendored).
 */
export type IconCode = string;

/** An icon plus optional per-instance metadata (tooltip, link). */
export interface IconRef {
  code: IconCode;
  /** Accessible title / hover tooltip for this icon. */
  title?: string;
  /** Optional link target for the icon (e.g. a feature page). */
  href?: string;
}

/**
 * One icon in a cell:
 *   "STR"                    a bare BSicon code
 *   { code, title?, href? }  an IconRef (metadata)
 *   { kind: "track", … }     a semantic IconObject (see icon.ts), resolved to a code
 */
export type CellIcon = IconCode | IconRef | IconObject;

/** A cell's overlay stack + optional right-side annotation (Routemap `~~`). */
export interface CellObject {
  /** Icons composited in order, bottom-to-top (Routemap `!~`). */
  stack: CellIcon[];
  /** Right-side annotation text for this cell. */
  note?: string;
}

/**
 * One column slot in a row:
 *   null            empty column
 *   CellIcon        single icon (string shorthand or IconRef)
 *   CellIcon[]      overlay stack
 *   CellObject      stack + note
 */
export type Cell = null | CellIcon | CellIcon[] | CellObject;

/**
 * A small logo shown inline in a label — the wiki {{rint}} / {{rail-interchange}}
 * transit icons (National Rail arrow, Underground roundel, etc.).
 *
 * Forms, cheapest first (all mirror {{rint}}'s own args, so config stays in sync;
 * the file is resolved from the live template via the MediaWiki API, see rint.ts):
 *   - `"air"` / `"london|underground"` — a bare string IS the rint code: the
 *     positional args exactly as `{{rint|...}}` takes them (single arg needs no
 *     key; join multiple with `|`).
 *   - `{ rint: "eurostar", size: 10 }` — same, when you also need `size`/`alt`.
 *   - `{ region, name }` — the structured equivalent (region = first arg).
 *   - `{ file }` — an explicit Commons/Wikipedia file name, an escape hatch.
 *
 * `size` is a WIDTH in px (matching MediaWiki `|Npx|`); height auto-scales. It
 * defaults to rint's own size, so you rarely set it.
 *
 * Heads up: unlike BSicons (all PD-shape), these are trademarked transit logos
 * and some are non-free — using them off-Wikipedia is a licensing decision.
 */
export type LabelIcon =
  | string
  | { rint: string; size?: number; alt?: string }
  | { region: string; name?: string; size?: number; alt?: string }
  | { file: string; size?: number; alt?: string };

/**
 * Wikitext we don't model, carried verbatim.
 *
 * The escape hatch that makes a wikitext round-trip safe. Without it, anything
 * unrecognised has to be kept as plain text — and plain text's pipes are LINE BREAKS to
 * the serializer, so `{{BSto|a|b}}` came back as `{{BSsplit|{{BSto|a|b}}}}`. Real
 * diagrams are full of templates we've never heard of, and silently rewriting them is
 * worse than not understanding them.
 *
 * Emitted exactly as given and never split. The renderer can't expand it, so it shows
 * as literal text — visibly not understood, which is the honest failure.
 */
export interface RawRun {
  raw: string;
}

/**
 * One transit logo, inline where the author put it.
 *
 * Singular, and a RUN rather than a field on the label. Icons used to live in two
 * places — `icons` on the label (placed on its outer edge) and `icons` on a run — and
 * the two serialize to byte-identical wikitext, so nothing could tell them apart when
 * reading it back. One representation is what makes a wikitext reader possible.
 *
 * Spacing is the author's, as it is between any two runs: `[{ icon }, " ", "Euston"]`
 * is `{{rint|…}} Euston`, and dropping the `" "` is the wikitext without the space.
 * `size` and `alt` ride on the `LabelIcon` itself.
 */
export interface IconRun {
  icon: LabelIcon;
}

/**
 * A plain `<br>` line break, as plenty of real diagrams use instead of `{{BSsplit}}`.
 *
 * NOT interchangeable with a split, which is why it needs its own run. A `{{BSsplit}}`
 * carries the `.RMsplit` class, and `table.routemap .RMl > .RMsplit` sets `font-size:
 * 90%` — so a split's lines are SMALLER than the same text broken with `<br>`, which
 * stays at 100% with the cell's own line-height. Normalising one to the other on
 * import would visibly resize the label.
 *
 * A sample of 20 diagrams that use `<br>` at all had 10 of these against 74 splits, so
 * splits are the common case and keep the `|` sugar; this is explicit.
 */
export interface BreakRun {
  br: true;
}

/** One line of a `{{BSsplit}}`: its runs, or a bare string for a single-run line. */
export type SplitLine = string | TextRun[];

/**
 * An explicit `{{BSsplit}}` as a RUN, so it stacks lines without splitting the label
 * around it.
 *
 * The `|`-in-text sugar splits the whole label, which can't express either of the two
 * things this can:
 *
 *   - content BESIDE a split rather than inside it. `[{ icon }, { split: [a, b] }]` is
 *     `{{rint|…}} {{BSsplit|a|b}}` — the logo outside the stack — where a leading run
 *     plus sugar would put the logo on the first line, inside it.
 *   - more than one split in a label, which real diagrams do use (Parit Buntar, and
 *     the Marunouchi Line).
 *
 * Nesting a split inside a split isn't a supported shape. It renders (the inner one is
 * just a run on one of the outer lines) but nothing in the wild needs it.
 */
export interface SplitRun {
  split: SplitLine[];
}

/**
 * An inline run of label text. A bare string is plain text; the object form adds:
 *   - `link` — a generic wikilink target ({{[[ ]]}}), resolved by `resolveHref`;
 *     our `text` is the display.
 *   - `rws` — a station link, given as {{rws}}'s own args (e.g. "Liverpool|Lime
 *     Street"). Both the display AND the target are resolved from the wiki
 *     (`resolveRws`), since rws builds them non-trivially; `text` is ignored.
 *   - `title` — hover text. A logo is its own `{ icon }` run, not a field here.
 * Runs concatenate inline.
 *
 * A `|` anywhere in a run's text is a LINE BREAK (the wiki {{BSsplit}} separator);
 * keep linked/iconed runs atomic and put breaks in plain runs (usually a lone
 * `"|"` element). `\|` is a literal pipe. That sugar splits the WHOLE label, which
 * is what nearly every diagram wants; `{ split }` below is for what it can't reach.
 */
export type TextRun =
  | string
  | SplitRun
  | BreakRun
  | IconRun
  | RawRun
  | {
      text?: string;
      link?: string | true;
      rws?: string;
      title?: string;
      /** Bold/italic just this run (the wiki `'''`/`''` marks). Label-level
       *  `bold`/`italic` on SideLabel still style the whole label. */
      bold?: boolean;
      italic?: boolean;
    };

/**
 * Left/right row label. A bare string is shorthand for `{ text }`; a bare array
 * is shorthand for `{ text: [...] }` (inline runs). The object form adds:
 *   - `link` / `title` — link/hover the whole label (a run's own link wins).
 *   - `italic` / `bold` — the wiki `i` / `b` cell params.
 * Multiple links/partial links come from run objects in `text`; multi-line comes
 * from `|` in the text.
 */
export type SideLabel =
  | string
  | TextRun[]
  | {
      text?: string | TextRun[];
      /** Whole-label station link (sugar for a single `{ rws }` run). */
      rws?: string;
      link?: string | true;
      title?: string;
      italic?: boolean;
      bold?: boolean;
    };

/** A normal grid row: side labels + one cell per column. */
/**
 * The four label slots one side of a row can hold, named as `Module:Routemap` names
 * them (`linfo1`..`linfo4` / `rinfo1`..`rinfo4`), numbered outward from the icons.
 *
 * Not four uniform columns: the module renders `main` and `remark` in a SINGLE table
 * cell (it calls the pair `linfo3+2`), while `outer` gets its own cell at 90% via
 * `.RMsi`. Laying them out as four equal columns would not match the wiki.
 */
export interface SideSlots {
  /** info1 — nearest the icons. Distance or time, in the wiki's own examples. */
  dist?: SideLabel | null;
  /** info2 — the main label. This is where a lone label goes. */
  main?: SideLabel | null;
  /** info3 — a remark, sharing a table cell with `main`. */
  remark?: SideLabel | null;
  /** info4 — outermost, in its own cell at 90%. */
  outer?: SideLabel | null;
}

export interface GridRow {
  type?: "grid";
  /**
   * The left labels: a `SideLabel` for the common one-label case (it becomes `main`,
   * matching the wiki's positional default), or a `SideSlots` to use more than one.
   *
   * The two object shapes are told apart by their keys, which are disjoint —
   * `SideSlots` has dist/main/remark/outer, `SideLabel` has text/rws/icons/link/… —
   * so no discriminator field is needed and existing diagrams keep working untouched.
   */
  left?: SideLabel | SideSlots | null;
  right?: SideLabel | SideSlots | null;
  cells: Cell[];
}

/** A full-width text/legend row (Routemap `-colspan-`). Its text supports the
 *  same inline runs as a label (links, `|` breaks, inline logos) plus whole-row
 *  italic/bold and `{ icon }` runs — e.g. `["interchange with ", { text: "National Rail",
 *  link: true }, " at all stations"]`. */
export interface ColspanRow {
  type: "colspan";
  text?: string | TextRun[];
  rws?: string;
  link?: string | true;
  title?: string;
  italic?: boolean;
  bold?: boolean;
}

export type DiagramRow = GridRow | ColspanRow;

/** Map-level metadata; `params` is a verbatim bag for round-trip fidelity. */
/** One `{{Routemap}}` parameter exactly as written. */
export interface MapParam {
  /** The parameter name, or "" for a positional one. */
  name: string;
  /** The value verbatim, including any surrounding whitespace the author left. */
  value: string;
}

/**
 * The `{{Routemap}}` call around a diagram, kept so a pasted template rebuilds unchanged.
 *
 * Params are an ordered LIST, not a record, and none of them is interpreted — not even
 * `title`. Once a user can edit wikitext, a param this doesn't understand is destroyed
 * on their next GUI edit, and there are many: `legend`, `top`, `bottom`, `navbar`,
 * per-page styling. Order matters too, because a reordered wrapper is a diff nobody
 * asked for.
 *
 * The param named `map` marks where the row body belongs; its value is ignored and the
 * serialized rows are substituted there.
 */
export interface MapMeta {
  /** The template name as written — "Routemap", "BS-map", "BS-daten"… */
  template?: string;
  params?: MapParam[];
}

/** A complete route diagram. */
export interface RouteDiagram {
  map?: MapMeta;
  /** Max column count. Derived from the widest row when omitted. */
  columns?: number;
  /** Diagram-wide icon defaults (the "global config") — e.g. mark the whole
   *  diagram `disused`, or set a `region`. A per-icon value overrides these. */
  defaults?: IconContext;
  rows: DiagramRow[];
}

/* ------------------------------------------------------------------ */
/* Type guards                                                         */
/* ------------------------------------------------------------------ */

export function isColspanRow(row: DiagramRow): row is ColspanRow {
  return (row as ColspanRow).type === "colspan";
}

export function isGridRow(row: DiagramRow): row is GridRow {
  return !isColspanRow(row);
}
