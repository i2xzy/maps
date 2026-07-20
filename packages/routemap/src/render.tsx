/**
 * React SVG renderer: draws a RouteDiagram from the pure `computeLayout` model.
 *
 * One outer <svg> in px; each icon is an <image> scaled from its native 500-unit
 * canvas into the cell, so overlays stack and lines connect by construction (see
 * the T1 geometry spike). `resolveIcon` maps a code to an SVG URL — the demo uses
 * Commons Special:FilePath; production passes a vendored/inlined resolver so we
 * don't hit Commons at runtime.
 */
import type { ReactElement } from "react";
import type { RouteDiagram } from "./types";
import { FULL_CELL } from "./types";
import { computeLayout } from "./layout";

export interface RouteMapProps {
  diagram: RouteDiagram;
  /** code -> SVG url. Default: Commons (demo only; prod passes a vendored resolver). */
  resolveIcon?: (code: string) => string;
  /** px per full (500-unit) cell. Default 40. */
  cellSize?: number;
  /** native icon width in SVG units (500 full, 250 half). Default: `d`-prefix heuristic. */
  iconWidth?: (code: string) => number;
  /** px reserved on each side for row labels. Default 170. */
  labelGutter?: number;
}

const commonsUrl = (code: string): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/BSicon_${encodeURIComponent(code)}.svg`;

const defaultIconWidth = (code: string): number => (code.startsWith("d") ? 250 : FULL_CELL);

export function RouteMap({
  diagram,
  resolveIcon = commonsUrl,
  cellSize = 40,
  iconWidth = defaultIconWidth,
  labelGutter = 170,
}: RouteMapProps): ReactElement {
  const layout = computeLayout(diagram, iconWidth);
  const scale = cellSize / FULL_CELL;
  const gridW = layout.width * scale;
  const gridH = layout.height * scale;
  const totalW = gridW + labelGutter * 2;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={totalW}
      height={gridH}
      viewBox={`0 0 ${totalW} ${gridH}`}
      fontFamily="system-ui, sans-serif"
      fontSize={12}
    >
      {layout.rows.map((row) => {
        const yMid = (row.y + row.height / 2) * scale;

        if (row.colspan != null) {
          return (
            <text key={row.index} x={totalW / 2} y={yMid} textAnchor="middle" dominantBaseline="middle" fill="#333">
              {row.colspan}
            </text>
          );
        }

        return (
          <g key={row.index}>
            {row.left?.text ? (
              <text x={labelGutter - 8} y={yMid} textAnchor="end" dominantBaseline="middle" fill="#333">
                {row.left.text}
              </text>
            ) : null}
            {row.right?.text ? (
              <text x={labelGutter + gridW + 8} y={yMid} dominantBaseline="middle" fill="#333">
                {row.right.text}
              </text>
            ) : null}
            {row.cells.flatMap((cell) =>
              cell.icons.map((icon, i) => {
                const x = labelGutter + cell.x * scale;
                const y = row.y * scale;
                const w = icon.nativeWidth * scale;
                const h = FULL_CELL * scale;
                const img = (
                  <image
                    href={resolveIcon(icon.code)}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    preserveAspectRatio="xMinYMin meet"
                  >
                    {icon.title ? <title>{icon.title}</title> : null}
                  </image>
                );
                const key = `${cell.column}-${i}-${icon.code}`;
                return icon.href ? (
                  <a key={key} href={icon.href}>
                    {img}
                  </a>
                ) : (
                  <g key={key}>{img}</g>
                );
              }),
            )}
          </g>
        );
      })}
    </svg>
  );
}
