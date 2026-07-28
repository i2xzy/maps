/**
 * Framework-agnostic layout: turn a RouteDiagram into an ordered list of cells
 * the renderer draws inline, the way {{Routemap}} does. Kept pure and React-free
 * so it unit-tests without a DOM and so the core can back other targets later.
 *
 * Model (matching Wikipedia's Module:Routemap): a row is NOT a uniform grid of
 * fixed columns — it is a single horizontal flow of cells. Each icon cell sizes
 * itself from the SVG's aspect ratio at render time (no width is computed here),
 * so a full icon, a `d`-half, a `c`-quarter and a stacked-prefix `etdKRZ` all
 * fall out for free. Only a *spacer* cell (an empty column, or a lone width-
 * prefix token like "d") carries an explicit width, as a fraction of a full cell.
 *
 * Cross-row alignment: interior empty columns become full-width spacers so a
 * column of icons in one row lines up with the same column in the next; trailing
 * empties are trimmed. Two `dSTR` therefore occupy exactly the width of one
 * `STR` above them, because each is sized by its own SVG.
 */
import type { CellIcon, RouteDiagram } from "./types";
import { isColspanRow } from "./types";
import type { IconContext } from "./icon";
import {
  diagramColumns,
  iconCode,
  isWidthPrefix,
  emptySlots,
  normalizeCell,
  normalizeSide,
  normalizeSlots,
  prefixWidthFraction,
  type NormalizedSide,
  type NormalizedSlots,
} from "./normalize";

export interface PlacedIcon {
  code: string;
  title?: string;
  href?: string;
}

export interface PlacedCell {
  /** Ordinal position of this cell within the row. */
  column: number;
  /** Icons composited bottom-to-top (the `!~` overlay). Empty for a spacer. */
  icons: PlacedIcon[];
  /**
   * Spacer width as a fraction of a full cell (empty column -> 1, "d" -> 0.5,
   * "cd" -> 0.75). `null` for an icon cell, whose width comes from the SVG's own
   * aspect ratio at render time — exactly how {{Routemap}} sizes icons.
   */
  spacer: number | null;
  /** Right-side annotation (Routemap `~~`). */
  note?: string;
}

export interface PlacedRow {
  index: number;
  /** Present on colspan (full-width text) rows: its text + optional inline logos. */
  colspan?: NormalizedSide;
  /**
   * All four label slots per side, innermost-first (see `SideSlots`). Carried whole
   * even though the renderer currently draws only `main`, so the serializer and any
   * future reader share one normalized shape rather than two.
   */
  left: NormalizedSlots;
  right: NormalizedSlots;
  cells: PlacedCell[];
}

export interface DiagramLayout {
  /** Max icon columns across rows (metadata; the renderer flows cells inline). */
  columns: number;
  rows: PlacedRow[];
}

const placeIcon = (icon: CellIcon, ctx?: IconContext): PlacedIcon => {
  // title/href live on an IconRef only (not a bare string or a semantic IconObject).
  const ref = typeof icon !== "string" && !("kind" in icon) ? icon : undefined;
  return { code: iconCode(icon, ctx), title: ref?.title, href: ref?.href };
};

export function computeLayout(diagram: RouteDiagram): DiagramLayout {
  const columns = diagramColumns(diagram);
  const ctx = diagram.defaults; // diagram-wide icon defaults (region / state / …)
  const rows: PlacedRow[] = [];

  diagram.rows.forEach((row, index) => {
    if (isColspanRow(row)) {
      // A colspan is a centered label: reuse normalizeSide to fold whole-row rws and
      // carry link/title.
      const colspan = normalizeSide({
        text: row.text,
        rws: row.rws,
        link: row.link,
        title: row.title,
        italic: row.italic,
        bold: row.bold,
      }) ?? { text: row.text };
      rows.push({ index, colspan, left: emptySlots(), right: emptySlots(), cells: [] });
      return;
    }

    // Keep every column, including trailing blanks: the renderer centers each
    // row's icon strip (like the wiki RMir cell), so a dropped trailing blank
    // would shift the row off-centre and break column alignment. Empty columns
    // become full-width spacers.
    const cells: PlacedCell[] = [];
    const rowCells = row.cells ?? []; // tolerate a row missing its cells array
    for (let column = 0; column < rowCells.length; column++) {
      const norm = normalizeCell(rowCells[column] ?? null);

      // Empty interior column -> full-width blank spacer.
      if (!norm) {
        cells.push({ column, icons: [], spacer: 1 });
        continue;
      }

      // A lone pure width-prefix token ("d", "cd", …) is a sized blank, not an icon.
      const only = norm.stack.length === 1 ? norm.stack[0] : undefined;
      if (only !== undefined && !norm.note && isWidthPrefix(iconCode(only, ctx))) {
        cells.push({ column, icons: [], spacer: prefixWidthFraction(iconCode(only, ctx)) });
        continue;
      }

      cells.push({
        column,
        icons: norm.stack.map((i) => placeIcon(i, ctx)),
        spacer: null,
        note: norm.note,
      });
    }

    rows.push({
      index,
      left: normalizeSlots(row.left),
      right: normalizeSlots(row.right),
      cells,
    });
  });

  return { columns, rows };
}
