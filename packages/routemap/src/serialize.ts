/**
 * Serialize a RouteDiagram to {{Routemap}} MAP source — the row lines only, ready
 * to paste into a {{Routemap}}/{{BS-map}} `map=` parameter (no template wrapper,
 * since the wrapper varies by page). One-way, best-effort v1: covers rows, cells,
 * overlays (`!~`), spacers, left/right labels with links ([[…]]), stations
 * ({{rws}}), transit logos ({{rint}}), multi-line ({{BSsplit}}), italic/bold, and
 * colspans.
 *
 * Deferred: cell-level notes, icon links (`!@`), and the reverse parser.
 */
import type { Cell, LabelIcon, RouteDiagram, SideLabel, TextRun } from "./types";
import { isColspanRow } from "./types";
import { iconCode, normalizeCell, normalizeSide, type NormalizedSide } from "./normalize";
import type { IconContext } from "./icon";
import { iconFile, rintCode } from "./rint";

const iconSize = (icon: LabelIcon): number | undefined =>
  typeof icon === "object" && "size" in icon ? icon.size : undefined;

/** A label logo -> wiki: `{{rint|code}}` for rint codes, `[[File:…]]` for files. */
function iconToWiki(icon: LabelIcon): string {
  const file = iconFile(icon);
  const size = iconSize(icon);
  if (file) return `[[File:${file}${size ? `|${size}px` : ""}]]`;
  const code = rintCode(icon);
  if (!code) return "";
  return `{{rint|${code}${size ? `|size=${size}` : ""}}}`;
}

/** One inline run -> wiki. */
function runToWiki(run: TextRun): string {
  if (typeof run === "string") return run;
  let s: string;
  if (run.rws) s = `{{rws|${run.rws}}}`;
  else if (run.link != null) {
    const ref = run.link === true ? (run.text ?? "") : run.link;
    s = run.text && run.text !== ref ? `[[${ref}|${run.text}]]` : `[[${ref}]]`;
  } else s = run.text ?? "";
  if (run.bold && s) s = `'''${s}'''`;
  if (run.italic && s) s = `''${s}''`;
  const icons = (run.icons ?? []).map(iconToWiki).filter(Boolean);
  if (icons.length) s = `${s}${s ? " " : ""}${icons.join(" ")}`;
  return s;
}

/** Split a text value into lines of runs at unescaped `|` (BSsplit boundaries). */
function splitRunLines(text: string | TextRun[]): TextRun[][] {
  const runs: TextRun[] = typeof text === "string" ? [text] : text;
  const lines: TextRun[][] = [[]];
  for (const run of runs) {
    if (typeof run === "string") {
      run.split(/(?<!\\)\|/).forEach((part, i) => {
        if (i > 0) lines.push([]);
        const un = part.replace(/\\\|/g, "|");
        if (un !== "") (lines[lines.length - 1] as TextRun[]).push(un);
      });
    } else {
      (lines[lines.length - 1] as TextRun[]).push(run);
    }
  }
  return lines;
}

/** Text value -> wiki; multiple lines wrap in {{BSsplit}}. */
function textToWiki(text: string | TextRun[]): string {
  const parts = splitRunLines(text).map((line) => line.map(runToWiki).join(""));
  return parts.length > 1 ? `{{BSsplit|${parts.join("|")}}}` : (parts[0] ?? "");
}

/** A normalized label -> wiki: text + outer-edge logos + italic/bold. */
function sideToWiki(norm: NormalizedSide | null, dir: "left" | "right"): string {
  if (!norm) return "";
  let body: string;
  if (norm.link != null && typeof norm.text === "string") {
    const ref = norm.link === true ? norm.text : norm.link;
    body = norm.text && norm.text !== ref ? `[[${ref}|${norm.text}]]` : `[[${ref}]]`;
  } else {
    body = norm.text != null ? textToWiki(norm.text) : "";
  }
  const icons = (norm.icons ?? []).map(iconToWiki).filter(Boolean);
  if (icons.length) {
    const ic = icons.join(" ");
    body = dir === "left" ? `${ic}${body ? ` ${body}` : ""}` : `${body ? `${body} ` : ""}${ic}`;
  }
  if (norm.bold) body = `'''${body}'''`;
  if (norm.italic) body = `''${body}''`;
  return body;
}

const labelToWiki = (side: SideLabel | null | undefined, dir: "left" | "right"): string =>
  sideToWiki(normalizeSide(side ?? null), dir);

/** One cell -> wiki: overlays joined by `!~`; spacer/empty stay as their token. */
function cellToWiki(cell: Cell, ctx?: IconContext): string {
  const norm = normalizeCell(cell);
  if (!norm) return "";
  return norm.stack.map((i) => iconCode(i, ctx)).join("!~");
}

function rowToWiki(row: RouteDiagram["rows"][number], ctx?: IconContext): string {
  if (isColspanRow(row)) {
    const norm = normalizeSide({
      text: row.text,
      rws: row.rws,
      icons: row.icons,
      link: row.link,
      italic: row.italic,
      bold: row.bold,
    });
    return `-colspan-1\n${sideToWiki(norm, "left")}`;
  }
  const left = labelToWiki(row.left, "left");
  const right = labelToWiki(row.right, "right");
  const cells = (row.cells ?? []).map((c) => cellToWiki(c, ctx)).join("\\");
  return `${left ? `${left}! !` : ""}${cells}${right ? `~~${right}` : ""}`;
}

/** Serialize a diagram to the {{Routemap}} `map=` body (row lines, no wrapper). */
export function toWikitext(diagram: RouteDiagram): string {
  return diagram.rows.map((row) => rowToWiki(row, diagram.defaults)).join("\n");
}
