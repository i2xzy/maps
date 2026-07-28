/**
 * Re-parse a wikitext body while KEEPING the model of rows that didn't change.
 *
 * The counterpart to per-row provenance, on the way in rather than out. Provenance keeps
 * the wikitext of an untouched row byte-exact; this keeps its MODEL.
 *
 * Without it, editing one character in an editable wikitext pane re-parses every row, and
 * any row the parser reads less richly than it was authored degrades on the spot. A label
 * written as `{ text: [...], italic: true }` serializes to `''to {{rws|A}} & {{rws|B}}''`
 * and parses back to a single opaque `{ raw }` run — so one keystroke flattened the whole
 * document. That is a real hazard, not a cosmetic one: the label stops being editable in
 * the GUI and stops being structured data.
 *
 * The rule: a parsed line is discarded in favour of an existing row when that row
 * currently serializes to exactly that line. "Currently" matters — it covers a row still
 * holding its original text AND one already edited through the GUI, whose text is now its
 * re-serialization.
 */
import type { DiagramRow, RouteDiagram } from "./types";
import { toWikitext } from "./serialize";

/** What one row serializes to on its own. */
const lineOf = (row: DiagramRow): string => toWikitext({ rows: [row] });

/**
 * Merge a freshly parsed diagram with the one it replaces, keeping unchanged rows.
 *
 * Matching is by text, and each previous row is consumed once — two identical lines in a
 * diagram (`\STR\STR` twice over) must map to two rows, not the same row twice.
 */
export function reconcileRows(parsed: RouteDiagram, previous: RouteDiagram | null): RouteDiagram {
  if (!previous?.rows?.length) return parsed;

  const available = new Map<string, DiagramRow[]>();
  for (const row of previous.rows) {
    let line: string;
    try {
      line = lineOf(row);
    } catch {
      continue; // a malformed row can't be matched; let the parse win
    }
    const bucket = available.get(line);
    if (bucket) bucket.push(row);
    else available.set(line, [row]);
  }

  const rows = parsed.rows.map((row) => {
    // `src` is the line this row was parsed from — the text to match against.
    const line = (row as { src?: string }).src;
    if (line == null) return row;
    const bucket = available.get(line.trim()) ?? available.get(line);
    const reuse = bucket?.shift();
    return reuse ?? row;
  });
  return { ...parsed, rows };
}
