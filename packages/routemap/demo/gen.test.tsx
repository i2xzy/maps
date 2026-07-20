/* Demo generator, run explicitly via vitest (reliable automatic-JSX). Renders a
 * sample diagram to demo/demo.html using real BSicon SVGs inlined from the T1
 * spike, so it's self-contained. Not part of the normal test suite (lives outside
 * src/, which the vitest `include` scopes to). */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";
import { RouteMap } from "../src/render";
import type { RouteDiagram } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "../../../.context/rdt-spike/icons");

const dataUri = (code: string): string => {
  const path = resolve(iconsDir, `${code}.svg`);
  if (existsSync(path)) {
    const svg = readFileSync(path, "utf8");
    if (svg.startsWith("<?xml") || svg.startsWith("<svg")) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  }
  const fb = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect x="20" y="20" width="460" height="460" fill="none" stroke="#999" stroke-dasharray="30" stroke-width="8"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(fb)}`;
};

const diagram: RouteDiagram = {
  rows: [
    { left: "to WCML (north)", cells: ["STR"] },
    { left: "Delta Junction", cells: ["ABZrg", "STRc3"] },
    { cells: ["STR", "STR"] },
    { cells: ["vSTR", "exSTR"] },
    { left: "Bromford Tunnel", cells: [{ code: "hKRZW", title: "bridge over water" }] },
    { type: "colspan", text: "@repo/routemap demo — rendered from grid-JSON" },
  ],
};

it("generates demo/demo.html", () => {
  const svg = renderToStaticMarkup(<RouteMap diagram={diagram} resolveIcon={dataUri} cellSize={44} />);
  writeFileSync(
    resolve(here, "demo.html"),
    `<!doctype html><meta charset=utf-8><body style="margin:24px;background:#fff">${svg}</body>`,
  );
});
