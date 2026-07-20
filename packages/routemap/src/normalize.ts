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
  RouteDiagram,
  SideLabel,
} from "./types";
import { isGridRow } from "./types";

/** The BSicon code for an icon, whether it's a bare string or an IconRef. */
export function iconCode(icon: CellIcon): IconCode {
  return typeof icon === "string" ? icon : icon.code;
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
  if ("stack" in cell) return cell.stack.length ? cell : null;
  return { stack: [cell] }; // an IconRef object
}

/** Coerce a `SideLabel` into `{ text?, icons? }`, or `null` when empty. */
export function normalizeSide(
  side: SideLabel | null | undefined,
): { text?: string; icons?: IconCode[] } | null {
  if (side == null) return null;
  if (typeof side === "string") return side ? { text: side } : null;
  const hasText = !!side.text && side.text.length > 0;
  const hasIcons = !!side.icons && side.icons.length > 0;
  return hasText || hasIcons ? side : null;
}

/** Max column count across grid rows (explicit `diagram.columns` wins). */
export function diagramColumns(diagram: RouteDiagram): number {
  if (diagram.columns != null) return diagram.columns;
  let max = 0;
  for (const row of diagram.rows) {
    if (isGridRow(row)) max = Math.max(max, row.cells.length);
  }
  return max;
}
