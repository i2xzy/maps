/**
 * React HTML renderer: draws a RouteDiagram as an HTML table, the way Wikipedia
 * renders {{Routemap}} (table / rows / cells / stacked <img> / text labels).
 *
 * Why HTML, not SVG: labels are real text (reflow, selectable, linkable), <img>
 * loads BSicons reliably cross-origin, and the DOM mirrors wiki output — which
 * keeps the eventual wiki round-trip honest.
 *
 * Layout comes from the pure `computeLayout` core. Each icon cell is a fixed
 * cellSize box (position:relative); icons stack as absolutely-positioned <img>
 * (the {{Routemap}} `!~` overlay). A `d`-half icon renders at half width, left-
 * aligned, which is the left double-track lane position (see the T1 spike).
 * `resolveIcon` maps a code to an SVG url (Commons for demo; vendored in prod).
 */
import type { ReactElement } from "react";
import type { RouteDiagram } from "./types";
import { FULL_CELL } from "./types";
import { computeLayout, type PlacedCell } from "./layout";

export interface RouteMapProps {
  diagram: RouteDiagram;
  /** code -> SVG url. Default: Commons (demo only; prod passes a vendored resolver). */
  resolveIcon?: (code: string) => string;
  /** px per full (500-unit) cell. Default 40. */
  cellSize?: number;
  /** native icon width in SVG units (500 full, 250 half). Default: `d`-prefix heuristic. */
  iconWidth?: (code: string) => number;
}

const commonsUrl = (code: string): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/BSicon_${encodeURIComponent(code)}.svg`;

const defaultIconWidth = (code: string): number => (code.startsWith("d") ? 250 : FULL_CELL);

const labelCell: React.CSSProperties = {
  padding: "0 8px",
  color: "#333",
  verticalAlign: "middle",
  lineHeight: 1.3,
};

function IconCell({
  cell,
  cellSize,
  resolveIcon,
}: {
  cell: PlacedCell | undefined;
  cellSize: number;
  resolveIcon: (code: string) => string;
}): ReactElement {
  return (
    <td style={{ padding: 0, verticalAlign: "top" }}>
      <div style={{ position: "relative", width: cellSize, height: cellSize }}>
        {cell?.icons.map((icon, i) => {
          const img = (
            <img
              src={resolveIcon(icon.code)}
              alt={icon.title ?? icon.code}
              title={icon.title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: (icon.nativeWidth / FULL_CELL) * cellSize,
                height: cellSize,
                display: "block",
              }}
            />
          );
          return icon.href ? (
            <a key={i} href={icon.href}>
              {img}
            </a>
          ) : (
            <span key={i}>{img}</span>
          );
        })}
      </div>
    </td>
  );
}

export function RouteMap({
  diagram,
  resolveIcon = commonsUrl,
  cellSize = 40,
  iconWidth = defaultIconWidth,
}: RouteMapProps): ReactElement {
  const layout = computeLayout(diagram, iconWidth);
  const cols = layout.columns;

  return (
    <table style={{ borderCollapse: "collapse", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
      <tbody>
        {layout.rows.map((row) => {
          if (row.colspan != null) {
            return (
              <tr key={row.index}>
                <td />
                <td colSpan={cols} style={{ ...labelCell, textAlign: "center", padding: "4px 8px" }}>
                  {row.colspan}
                </td>
                <td />
              </tr>
            );
          }

          const byColumn = new Map<number, PlacedCell>(row.cells.map((c) => [c.column, c]));

          return (
            <tr key={row.index}>
              <td style={{ ...labelCell, textAlign: "right" }}>{row.left?.text ?? ""}</td>
              {Array.from({ length: cols }, (_, col) => (
                <IconCell key={col} cell={byColumn.get(col)} cellSize={cellSize} resolveIcon={resolveIcon} />
              ))}
              <td style={{ ...labelCell, textAlign: "left" }}>{row.right?.text ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
