/**
 * Bridge between a routemap `SideLabel` and a TipTap document, so the rich-text
 * editor can edit a label's text body.
 *
 * Covers plain text + per-run **bold / italic / link**, `rws` station links, `{ icon }`
 * logos, and line breaks. Paragraph = a `{{BSsplit}}` line, joined in the model by a
 * lone `"|"` run; hard break = a `{ br }`; a literal pipe is escaped as `\|`.
 * Label-level `bold`/`italic`/`link` are folded onto the runs on the way in (they
 * render identically).
 *
 * Every logo is a run, so it lives IN the document as a node like anything else. There
 * used to be a second, whole-label `icons` field placed on the label's outer edge, and
 * a separate strip to edit it — both gone, along with the re-attach dance that kept
 * the first keystroke from dropping them.
 *
 * `title` has no representation here, so `labelIsRteEditable` rejects labels that
 * carry one rather than dropping it on the first keystroke.
 */
import type { JSONContent } from "@tiptap/react";
import type {
  BreakRun,
  IconRun,
  LabelIcon,
  RawRun,
  SideLabel,
  SplitRun,
  TextRun,
} from "@repo/routemap";

type RunObj = Exclude<TextRun, string | SplitRun | BreakRun | IconRun | RawRun>;

/**
 * Runs the document can hold: everything but a split.
 *
 * `<br>` is a hardBreak, a logo and a station link are atoms, and so is `{ raw }` — the
 * filter always let raw runs through, but the return type didn't say so, which is why
 * putting one back required widening this rather than changing any logic.
 */
const docRuns = (runs: TextRun[]): TextRun[] => runs;

const asRuns = (text: SideLabel | undefined): TextRun[] => {
  if (text == null) return [];
  if (typeof text === "string") return [text];
  if (Array.isArray(text)) return text;
  return asRuns(text.text as SideLabel | undefined);
};

/** True when nothing in the label would be silently dropped by a round-trip. */
export function labelIsRteEditable(label: SideLabel | null | undefined): boolean {
  if (label == null || typeof label === "string") return true;
  const runs = Array.isArray(label) ? label : asRuns(label.text as SideLabel | undefined);
  // A `{ split }` IS editable now, as the atom chip in `split-node.tsx`. It must stay an
  // atom rather than becoming the `|` paragraph-break sugar: a split stacks lines WITHOUT
  // splitting the label around it, and flattening it to sugar would move its neighbours.
  // Raw wikitext IS editable now — as an atom node (`raw-node.tsx`), so the text around it
  // can be edited while the run itself stays an indivisible chip. Flattening it to text is
  // what we must not do: the serializer would read its argument pipes as line breaks.
  if (runs.some((r) => typeof r !== "string" && "title" in r && r.title != null)) return false;
  return Array.isArray(label) || label.title == null;
}



const escapePipe = (s: string) => s.replace(/\|/g, "\\|");
const splitPipes = (s: string) => s.split(/(?<!\\)\|/).map((p) => p.replace(/\\\|/g, "|"));

interface Marks {
  bold?: boolean;
  italic?: boolean;
  link?: string | true;
}

/** A run's text plus its effective marks (run marks OR the label-level default). */
function runMarks(r: string | RunObj, lvl: Marks): Marks {
  if (typeof r === "string") return lvl;
  return {
    bold: r.bold || lvl.bold,
    italic: r.italic || lvl.italic,
    link: r.link ?? lvl.link,
  };
}

function textNode(text: string, m: Marks): JSONContent {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (m.bold) marks.push({ type: "bold" });
  if (m.italic) marks.push({ type: "italic" });
  if (m.link != null) marks.push({ type: "link", attrs: { href: m.link === true ? text : m.link } });
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

/** Convert a label to a TipTap doc for the editor. */
export function labelToDoc(label: SideLabel | null | undefined): JSONContent {
  let runs: TextRun[];
  let lvl: Marks = {};
  if (label == null) runs = [];
  else if (typeof label === "string" || Array.isArray(label)) runs = asRuns(label);
  else {
    runs = asRuns(label.text as SideLabel | undefined);
    // Whole-label rws (sugar) with no text -> a single station run.
    if (runs.length === 0 && label.rws) runs = [{ rws: label.rws }];
    lvl = { bold: label.bold, italic: label.italic, link: label.link };
  }

  // Build lines of nodes; a `|` in ANY run's text starts a new line.
  const lines: JSONContent[][] = [[]];
  const pushNode = (n: JSONContent) => (lines[lines.length - 1] as JSONContent[]).push(n);
  for (const r of docRuns(runs)) {
    // A station link is an atom node; its display is resolved at render time. Its
    // own icons still have to follow it — falling straight to the next run here
    // dropped them, and since icon-bearing labels are now RTE-editable that loss
    // would land on the model the moment anyone typed.
    if (typeof r !== "string" && "icon" in r) {
      pushNode({ type: "rint", attrs: { icon: r.icon } });
      continue;
    }
    if (typeof r !== "string" && "br" in r) {
      pushNode({ type: "hardBreak" });
      continue;
    }
    // Opaque wikitext: an atom, so the caret can pass it and the user can delete it, but
    // nothing can be typed INTO it. Its text must never be flattened into the document —
    // the serializer reads pipes in a plain run as line breaks.
    if (typeof r !== "string" && "raw" in r) {
      pushNode({ type: "raw", attrs: { raw: r.raw } });
      continue;
    }
    // A split is an atom too. Its lines are edited in the panel below, not in here.
    if (typeof r !== "string" && "split" in r) {
      pushNode({ type: "split", attrs: { lines: JSON.stringify(r.split) } });
      continue;
    }
    if (typeof r !== "string" && r.rws) {
      pushNode({ type: "rws", attrs: { args: r.rws } });
    } else {
      const m = runMarks(r, lvl);
      // Object runs split on `|` too, not just bare strings: the renderer's
      // `buildLines` splits every run's text, so treating a marked run as one
      // unbreakable line showed a `\|` escape as a literal backslash and made a
      // real `|` disappear instead of breaking the line.
      const text = typeof r === "string" ? r : (r.text ?? "");
      splitPipes(text).forEach((piece, i) => {
        if (i > 0) lines.push([]);
        if (piece) pushNode(textNode(piece, m));
      });
    }
  }

  return {
    type: "doc",
    content: lines.map((nodes) => ({ type: "paragraph", content: nodes.length ? nodes : undefined })),
  };
}

/**
 * The lines of a label that is EXACTLY one `{{BSsplit}}`, or null.
 *
 * 30 of the 39 splits in the fixture are the whole label, so the useful editor for them is
 * one field per line rather than an inline node with a caret that has to cross line
 * boundaries. Returns null when the split sits alongside other content, or when a line holds
 * something the RTE can't take (a nested split), because then per-line editing would lose it.
 */
export function splitLinesOf(label: SideLabel | null | undefined): TextRun[][] | null {
  if (label == null || typeof label === "string") return null;
  const runs = Array.isArray(label) ? label : asRuns(label.text as SideLabel | undefined);
  if (runs.length !== 1) return null;
  const only = runs[0];
  if (only == null || typeof only !== "object" || !("split" in only)) return null;
  // A label-level title has nowhere to go in a per-line editor.
  if (!Array.isArray(label) && label.title != null) return null;
  const lines = only.split.map((line) => (typeof line === "string" ? [line] : line));
  return lines.every((line) => labelIsRteEditable(line)) ? lines : null;
}

/**
 * Every `{ split }` in a label, with a setter that puts an edited copy back.
 *
 * For a split that SHARES its label with other content: the chip in the RTE lets the caret
 * reach the words either side of it, and these let the lines themselves be edited. Indexed by
 * position so the setter can rebuild the label without disturbing anything else.
 */
export function splitsIn(label: SideLabel | null | undefined): {
  lines: TextRun[][];
  replace: (next: TextRun[][] | null) => SideLabel | undefined;
}[] {
  if (label == null || typeof label === "string") return [];
  const runs = Array.isArray(label) ? label : asRuns(label.text as SideLabel | undefined);
  const rebuild = (nextRuns: TextRun[]): SideLabel | undefined => {
    if (nextRuns.length === 0) return undefined;
    return Array.isArray(label) ? nextRuns : { ...label, text: nextRuns };
  };
  return runs.flatMap((run, i) => {
    if (run == null || typeof run !== "object" || !("split" in run)) return [];
    const lines = run.split.map((line) => (typeof line === "string" ? [line] : line));
    return [
      {
        lines,
        // `null` removes the split entirely; one line collapses it to that line's runs, since
        // a stack of one is a split nobody can see.
        replace: (next: TextRun[][] | null) =>
          rebuild(
            next == null
              ? runs.filter((_, j) => j !== i)
              : next.length > 1
                ? runs.map((r, j) => (j === i ? { split: next } : r))
                : runs.flatMap((r, j) => (j === i ? (next[0] ?? []) : [r])),
          ),
      },
    ];
  });
}

const markOf = (node: JSONContent, type: string) => node.marks?.find((m) => m.type === type);

/** Convert a TipTap doc back to a `SideLabel` (collapsed to a plain string when
 *  there are no marks/links and a single line). */
export function docToLabel(doc: JSONContent): SideLabel | undefined {
  // Splits and raws both round-trip, as the atom chips in `split-node.tsx` and
  // `raw-node.tsx`.
  const runs: TextRun[] = [];
  const paras = doc.content ?? [];
  paras.forEach((para, pi) => {
    if (pi > 0) runs.push("|"); // paragraph boundary -> BSsplit line break
    for (const node of para.content ?? []) {
      if (node.type === "hardBreak") {
        // Shift+Enter is a `<br>`, Enter a {{BSsplit}} line — the distinction those
        // two keys carry in every editor, and the wiki has both constructs. It used
        // to push "|" as well, so the two gestures produced the same thing and
        // nothing produced a <br> at all.
        runs.push({ br: true });
        continue;
      }
      if (node.type === "rws") {
        runs.push({ rws: (node.attrs?.args as string) ?? "" });
        continue;
      }
      if (node.type === "split") {
        try {
          const lines = JSON.parse((node.attrs?.lines as string) ?? "[]") as TextRun[][];
          if (lines.length) runs.push({ split: lines });
        } catch {
          // a malformed chip carries nothing rather than corrupting the label
        }
        continue;
      }
      if (node.type === "raw") {
        const raw = (node.attrs?.raw as string) ?? "";
        if (raw === "") continue; // an empty chip carries nothing
        runs.push({ raw });
        continue;
      }
      if (node.type === "rint") {
        const icon = (node.attrs?.icon ?? "") as LabelIcon;
        if (icon === "") continue; // an empty node carries nothing to render
        // Just a run. This used to attach the icon to whatever run came before,
        // promoting a plain string to hold it and special-casing rws and <br> runs
        // that can't — all of which existed because icons weren't runs.
        runs.push({ icon });
        continue;
      }
      if (node.type !== "text" || !node.text) continue;
      const bold = !!markOf(node, "bold");
      const italic = !!markOf(node, "italic");
      const href = markOf(node, "link")?.attrs?.href as string | undefined;
      if (!bold && !italic && href == null) {
        runs.push(escapePipe(node.text));
      } else {
        // Escape here too: a pipe typed inside bold/italic/linked text is literal,
        // and left raw the renderer would read it as a BSsplit line break.
        const run: RunObj = { text: escapePipe(node.text) };
        if (bold) run.bold = true;
        if (italic) run.italic = true;
        // `link: true` means "link to my own text", so compare against the display.
        if (href != null) run.link = href === node.text ? true : href;
        runs.push(run);
      }
    }
  });

  // Merge adjacent plain-string runs (except the "|" separators keep splitting).
  const merged: TextRun[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (typeof r === "string" && r !== "|" && typeof last === "string" && last !== "|") {
      merged[merged.length - 1] = last + r;
    } else {
      merged.push(r);
    }
  }

  if (merged.length === 0) return undefined;
  if (merged.length === 1 && typeof merged[0] === "string") return merged[0];
  return merged;
}

/**
 * Document content for inserting a logo, with the spaces a wiki author would type.
 *
 * BOTH sides now. The old version only spaced the trailing side, because a logo used
 * to become a field on the preceding run and the serializer wrote that boundary space
 * itself. A logo is a run now, and runs concatenate with nothing between them — so
 * nothing else will add either space, and inserting after "Euston" would otherwise
 * give `Euston{{rint|gb|rail}}`.
 *
 * A space is added only where the neighbouring character isn't already whitespace, so
 * repeated inserts don't accumulate gaps.
 */
export function logoInsertContent(
  icon: LabelIcon,
  before: string,
  after: string,
): JSONContent[] {
  const space = { type: "text", text: " " };
  const node: JSONContent = { type: "rint", attrs: { icon } };
  const needsBefore = before !== "" && !/\s/.test(before);
  const needsAfter = after !== "" && !/\s/.test(after);
  return [...(needsBefore ? [space] : []), node, ...(needsAfter ? [space] : [])];
}
