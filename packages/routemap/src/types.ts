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
 *     ├─ map?      MapMeta        (title/caption/collapse + verbatim params)
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
 * `{{Routemap}}` operator -> model mapping (the round-trip contract, honoured
 * when the deferred parser/serializer land):
 *   `\`     column separator      -> element boundary in cells[]
 *   `!~`    overlay               -> Cell array / CellObject.stack
 *   `~~`    right annotation      -> CellObject.note
 *   `!`/`! !` left/right markers  -> GridRow.left / GridRow.right
 *   `-colspan-` full-width row    -> ColspanRow
 *
 * Geometry (from the T1 spike — deterministic, see .context/rdt-spike/FINDINGS.md):
 *   full icon = 500x500 SVG units, centre line at x=250
 *   v (double) = 500x500, lanes at x=125 / x=375
 *   d (half)   = 250x500, line at x=125 (== v left lane)
 * So one full cell = FULL_CELL units and a `d`-prefixed icon is a HALF_CELL-wide
 * cell. Lines connect across cells because every glyph meets the cell edge at
 * y=0 / y=FULL_CELL; half-cells align with double-track lanes by construction.
 */

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

/** One icon in a cell: a bare code string, or an IconRef for metadata. */
export type CellIcon = IconCode | IconRef;

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

/** Left/right row label: bare string is shorthand for `{ text }`. */
export type SideLabel = string | { text?: string; icons?: IconCode[] };

/** A normal grid row: side labels + one cell per column. */
export interface GridRow {
  type?: "grid";
  left?: SideLabel | null;
  right?: SideLabel | null;
  cells: Cell[];
}

/** A full-width text/legend row (Routemap `-colspan-`). */
export interface ColspanRow {
  type: "colspan";
  text: string;
}

export type DiagramRow = GridRow | ColspanRow;

/** Map-level metadata; `params` is a verbatim bag for round-trip fidelity. */
export interface MapMeta {
  title?: string;
  caption?: string;
  collapse?: boolean;
  /** Any `{{Routemap}}`/`{{BS-map}}` params not otherwise modelled, kept verbatim. */
  params?: Record<string, string>;
}

/** A complete route diagram. */
export interface RouteDiagram {
  map?: MapMeta;
  /** Max column count. Derived from the widest row when omitted. */
  columns?: number;
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
