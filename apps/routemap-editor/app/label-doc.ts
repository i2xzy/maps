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
const docRuns = (runs: TextRun[]): (string | RunObj | BreakRun | IconRun | RawRun)[] =>
  runs.filter(
    (r): r is string | RunObj | BreakRun | IconRun | RawRun =>
      typeof r === "string" || !("split" in r),
  );

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
  // A `{ split }` run has no node type in the document. The `|` sugar does (a
  // paragraph break), but an explicit split stacks lines WITHOUT splitting the label
  // around it, and that distinction is precisely what the document can't hold — so
  // editing one here would flatten it into sugar and move its neighbours.
  if (runs.some((r) => typeof r === "object" && "split" in r)) return false;
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

const markOf = (node: JSONContent, type: string) => node.marks?.find((m) => m.type === type);

/** Convert a TipTap doc back to a `SideLabel` (collapsed to a plain string when
 *  there are no marks/links and a single line). */
export function docToLabel(doc: JSONContent): SideLabel | undefined {
  // Never a `{ split }`: the document has no node for one, which is why
  // `labelIsRteEditable` keeps split-bearing labels out of the editor entirely. A
  // `{ raw }` DOES round-trip, as the atom chip in `raw-node.tsx`.
  const runs: (string | RunObj | BreakRun | IconRun | RawRun)[] = [];
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
