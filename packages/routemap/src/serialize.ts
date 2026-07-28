/**
 * Serialize a RouteDiagram to {{Routemap}} MAP source — the row lines only, ready
 * to paste into a {{Routemap}}/{{BS-map}} `map=` parameter (no template wrapper,
 * since the wrapper varies by page). One-way, best-effort v1: covers rows, cells,
 * overlays (`!~`), spacers, all four label slots per side with links ([[…]]),
 * stations ({{rws}}), transit logos ({{rint}}), multi-line ({{BSsplit}}),
 * italic/bold, and colspans.
 *
 * Deferred: cell-level notes, icon links (`!@`), row properties (`bg=`), and the
 * reverse parser.
 */
import type { Cell, LabelIcon, RouteDiagram, TextRun } from "./types";
import { isColspanRow } from "./types";
import {
  SLOT_NAMES,
  iconCode,
  normalizeCell,
  normalizeSide,
  normalizeSlots,
  type NormalizedSide,
  type NormalizedSlots,
  type SlotName,
} from "./normalize";
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
  if ("br" in run) return "<br>";
  if ("icon" in run) return iconToWiki(run.icon);
  // An explicit split emits the template directly, so whatever sits beside it in the
  // run list stays beside it — which is the difference from the `|` sugar below.
  if ("split" in run) {
    const lines = run.split.map((line) =>
      typeof line === "string" ? line : line.map(runToWiki).join(""),
    );
    return `{{BSsplit|${lines.join("|")}}}`;
  }
  let s: string;
  if (run.rws) s = `{{rws|${run.rws}}}`;
  else if (run.link != null) {
    const ref = run.link === true ? (run.text ?? "") : run.link;
    s = run.text && run.text !== ref ? `[[${ref}|${run.text}]]` : `[[${ref}]]`;
  } else s = run.text ?? "";
  if (run.bold && s) s = `'''${s}'''`;
  if (run.italic && s) s = `''${s}''`;
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
      // Objects (including a `{ split }`) are atomic here: the sugar only breaks
      // PLAIN strings, so an explicit split stays a single run on its own line.
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

/**
 * A normalized label -> wiki: its text, then whole-label italic/bold.
 *
 * No logo placement here any more. Logos are `{ icon }` runs sitting where the author
 * put them, so the old outer-edge rule — before the text on the left, after it on the
 * right — has nothing left to apply to, and the read-back ambiguity it created is gone
 * with it.
 */
function sideToWiki(norm: NormalizedSide | null): string {
  if (!norm) return "";
  let body: string;
  if (norm.link != null && typeof norm.text === "string") {
    const ref = norm.link === true ? norm.text : norm.link;
    body = norm.text && norm.text !== ref ? `[[${ref}|${norm.text}]]` : `[[${ref}]]`;
  } else {
    body = norm.text != null ? textToWiki(norm.text) : "";
  }
  if (norm.bold) body = `'''${body}'''`;
  if (norm.italic) body = `''${body}''`;
  return body;
}

/** One cell -> wiki: overlays joined by `!~`; spacer/empty stay as their token. */
function cellToWiki(cell: Cell, ctx?: IconContext): string {
  const norm = normalizeCell(cell);
  if (!norm) return "";
  return norm.stack.map((i) => iconCode(i, ctx)).join("!~");
}

/**
 * How many `~~` fields a side needs, by its outermost occupied slot.
 *
 * Not cosmetic — the count IS the addressing. `Module:Routemap` reads the left part
 * backwards from `! !` and the right part forwards from the icons, so a field's
 * meaning depends on how many there are. Emit one field and it's read as `main`
 * whatever you meant; emit `dist` alone in one field and it comes back as `main`.
 */
const SLOT_FIELDS: Record<SlotName, number> = { main: 1, dist: 2, remark: 3, outer: 4 };

/**
 * One side's `~~`-separated fields, in the order they're written.
 *
 * Innermost-first on the right (`~~dist~~main~~remark~~outer`) and reversed on the
 * left (`outer~~remark~~main~~dist! !`), so the source reads in the same order as the
 * rendered page. The single-field case is `main` alone, matching the wiki's own
 * positional default rather than falling out of the general rule.
 */
function slotFields(slots: NormalizedSlots, dir: "left" | "right"): string[] {
  let count = 0;
  for (const name of SLOT_NAMES) if (slots[name]) count = Math.max(count, SLOT_FIELDS[name]);
  if (count === 0) return [];
  const inner = [slots.dist, slots.main, slots.remark, slots.outer];
  const ordered = count === 1 ? [slots.main] : inner.slice(0, count);
  // A placeholder is a SPACE, never empty: four consecutive tildes are a MediaWiki
  // signature, and the module trims every field so a space still reads as absent.
  const fields = ordered.map((slot) => sideToWiki(slot ?? null) || " ");
  return dir === "left" ? fields.reverse() : fields;
}

function rowToWiki(row: RouteDiagram["rows"][number], ctx?: IconContext): string {
  if (isColspanRow(row)) {
    const norm = normalizeSide({
      text: row.text,
      rws: row.rws,
      link: row.link,
      italic: row.italic,
      bold: row.bold,
    });
    return `-colspan-1\n${sideToWiki(norm)}`;
  }
  const left = slotFields(normalizeSlots(row.left), "left");
  const right = slotFields(normalizeSlots(row.right), "right");
  const cells = (row.cells ?? []).map((c) => cellToWiki(c, ctx)).join("\\");
  return (
    (left.length ? `${left.join("~~")}! !` : "") +
    cells +
    (right.length ? `~~${right.join("~~")}` : "")
  );
}

/** Serialize a diagram to the {{Routemap}} `map=` body (row lines, no wrapper). */
export function toWikitext(diagram: RouteDiagram): string {
  return diagram.rows.map((row) => rowToWiki(row, diagram.defaults)).join("\n");
}
