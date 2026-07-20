/**
 * Framework-agnostic layout: turn a RouteDiagram into positioned cells/icons the
 * React wrapper (or any renderer) draws directly. Kept pure and React-free so it
 * unit-tests without a DOM and so the core can back other targets later.
 *
 * v1 uses a uniform grid: every column is FULL_CELL wide, every row FULL_CELL
 * tall, cell at (col * FULL_CELL, rowIndex * FULL_CELL). Icon native widths (500
 * full, 250 for `d`-half) come from an injected `iconWidth` lookup — in prod the
 * vendoring step provides real per-file widths; tests pass a fixture. Half-column
 * PACKING (two d-cells per full column) and the branch layout SOLVER are deferred.
 */
import type { CellIcon, RouteDiagram } from "./types";
import { FULL_CELL, isColspanRow } from "./types";
import { diagramColumns, iconCode, normalizeCell, normalizeSide } from "./normalize";

export interface PlacedIcon {
  code: string;
  /** Native SVG width (500 full, 250 half); the renderer scales into the cell. */
  nativeWidth: number;
  title?: string;
  href?: string;
}

export interface PlacedCell {
  column: number;
  x: number;
  width: number;
  icons: PlacedIcon[];
  note?: string;
}

export interface PlacedRow {
  index: number;
  y: number;
  height: number;
  /** Present on colspan (full-width text) rows. */
  colspan?: string;
  left?: { text?: string; icons?: string[] } | null;
  right?: { text?: string; icons?: string[] } | null;
  cells: PlacedCell[];
}

export interface DiagramLayout {
  columns: number;
  width: number;
  height: number;
  rows: PlacedRow[];
}

const placeIcon = (icon: CellIcon, iconWidth: (code: string) => number): PlacedIcon => {
  const code = iconCode(icon);
  return {
    code,
    nativeWidth: iconWidth(code),
    title: typeof icon === "string" ? undefined : icon.title,
    href: typeof icon === "string" ? undefined : icon.href,
  };
};

export function computeLayout(
  diagram: RouteDiagram,
  iconWidth: (code: string) => number = () => FULL_CELL,
): DiagramLayout {
  const columns = diagramColumns(diagram);
  const rows: PlacedRow[] = [];
  let y = 0;

  diagram.rows.forEach((row, index) => {
    const height = FULL_CELL;

    if (isColspanRow(row)) {
      rows.push({ index, y, height, colspan: row.text, cells: [] });
      y += height;
      return;
    }

    const cells: PlacedCell[] = [];
    row.cells.forEach((cell, column) => {
      const norm = normalizeCell(cell);
      if (!norm) return;
      cells.push({
        column,
        x: column * FULL_CELL,
        width: FULL_CELL,
        note: norm.note,
        icons: norm.stack.map((ic) => placeIcon(ic, iconWidth)),
      });
    });

    rows.push({
      index,
      y,
      height,
      left: normalizeSide(row.left),
      right: normalizeSide(row.right),
      cells,
    });
    y += height;
  });

  return { columns, width: columns * FULL_CELL, height: y, rows };
}
