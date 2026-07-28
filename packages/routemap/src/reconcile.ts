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

/** What one row serializes to on its own, provenance honoured. */
const lineOf = (row: DiagramRow): string => toWikitext({ rows: [row] });

/** What one row serializes to from its MODEL alone, ignoring any provenance it carries. */
const modelLineOf = (row: DiagramRow): string =>
  toWikitext({ rows: [{ ...row, src: undefined } as DiagramRow] });

/**
 * Drop `src` from rows that don't need it.
 *
 * Provenance only earns its place where a row's own wikitext CAN'T be reproduced by
 * serializing it. For the ~82% of rows that round-trip byte-exactly, emitting the
 * serialization and emitting the original are the same bytes, so the field is pure noise —
 * and it roughly doubles the size of a document.
 *
 * Safe because `reconcileRows` falls back to a row's serialization when there's no `src`,
 * which for a pruned row is by definition the line it came from.
 */
export function pruneProvenance(diagram: RouteDiagram): RouteDiagram {
  return {
    ...diagram,
    rows: diagram.rows.map((row) => {
      const src = (row as { src?: string }).src;
      if (src == null) return row;
      let reproduced: string;
      try {
        reproduced = modelLineOf(row);
      } catch {
        return row; // can't tell — keep it
      }
      return reproduced === src.trim() ? ({ ...row, src: undefined } as DiagramRow) : row;
    }),
  };
}

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
    // The line this row came from: its `src` when it has one, and otherwise its own
    // serialization — which for a pruned row IS the line it was parsed from.
    const line = (row as { src?: string }).src ?? modelLineOf(row);
    const bucket = available.get(line.trim()) ?? available.get(line);
    const reuse = bucket?.shift();
    return reuse ?? row;
  });
  return { ...parsed, rows };
}
