/**
 * Bridge between a routemap `SideLabel` and a TipTap document, so the rich-text
 * editor can edit a label's text body.
 *
 * Covers plain text + per-run **bold / italic / link**, `rws` station links,
 * inline `icons` ({{rint}} logos), and line breaks. A line break is the wiki `|`
 * (BSsplit) separator: each TipTap paragraph / hard break becomes one line, joined
 * in the model by a lone `"|"` run; a literal pipe in the text is escaped as `\|`.
 * Label-level `bold`/`italic`/`link` are folded onto the runs on the way in (they
 * render identically).
 *
 * WHOLE-LABEL `icons` are deliberately NOT in the document. They render on the
 * label's outer edge — before the text for a left label, after it for a right one,
 * and once for the whole block when the text wraps to several lines — which no
 * position inside a single inline flow reproduces. The inspector edits them as a
 * separate strip and re-attaches them around `docToLabel`.
 *
 * `title` has no representation here, so `labelIsRteEditable` rejects labels that
 * carry one rather than dropping it on the first keystroke.
 */
import type { JSONContent } from "@tiptap/react";
import type { LabelIcon, SideLabel, TextRun } from "@repo/routemap";

type RunObj = Exclude<TextRun, string>;

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
  if (runs.some((r) => typeof r !== "string" && r.title != null)) return false;
  return Array.isArray(label) || label.title == null;
}

/** Whole-label `icons`, which live outside the document (see the module note). */
export function labelIcons(label: SideLabel | null | undefined): LabelIcon[] {
  if (label == null || typeof label === "string" || Array.isArray(label)) return [];
  return Array.isArray(label.icons) ? label.icons : label.icons ? [label.icons] : [];
}

/**
 * Whether the label wraps onto more than one line — a `|` anywhere in its text,
 * which is the wiki {{BSsplit}} separator.
 *
 * This is what decides whether whole-label `icons` are worth a separate control. On
 * ONE line they're indistinguishable from a logo placed at the edge of the text: both
 * serialize to `{{rint|x}} Euston`. On several they are not — whole-label icons sit
 * outside the {{BSsplit}}, centred against the whole stack, where an inline logo sits
 * inside one line. Both placements are used on Wikipedia (Des Plaines and Lyon Metro
 * Line C put the logo outside; East Coast Main Line does both), so the distinction
 * has to stay reachable.
 */
export function labelIsMultiLine(label: SideLabel | null | undefined): boolean {
  const runs = label == null || typeof label === "string" || Array.isArray(label)
    ? asRuns(label ?? undefined)
    : asRuns(label.text as SideLabel | undefined);
  return runs.some((r) => {
    const text = typeof r === "string" ? r : (r.text ?? "");
    return /(?<!\\)\|/.test(text);
  });
}

/**
 * Set a label's whole-label `icons`, keeping everything else about it.
 *
 * Serves both edits: re-attaching icons to a fresh `docToLabel` result (a string
 * or runs), and changing the icons on a label whose text nobody touched — hence
 * the spread, which preserves `link`/`italic`/`bold` that the object form may
 * carry. Dropping the last icon collapses the label back to its bare text.
 */
export function setLabelIcons(
  label: SideLabel | null | undefined,
  icons: LabelIcon[],
): SideLabel | undefined {
  if (icons.length > 0) {
    if (label == null) return { icons }; // icons alone are a valid label
    if (typeof label === "string" || Array.isArray(label)) return { text: label, icons };
    return { ...label, icons };
  }
  if (label == null || typeof label === "string" || Array.isArray(label)) return label ?? undefined;
  const rest = { ...label };
  delete rest.icons;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

const escapePipe = (s: string) => s.replace(/\|/g, "\\|");
const splitPipes = (s: string) => s.split(/(?<!\\)\|/).map((p) => p.replace(/\\\|/g, "|"));

interface Marks {
  bold?: boolean;
  italic?: boolean;
  link?: string | true;
}

/** A run's text plus its effective marks (run marks OR the label-level default). */
function runMarks(r: TextRun, lvl: Marks): Marks {
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
  for (const r of runs) {
    // A station link is an atom node; its display is resolved at render time. Its
    // own icons still have to follow it — falling straight to the next run here
    // dropped them, and since icon-bearing labels are now RTE-editable that loss
    // would land on the model the moment anyone typed.
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
    // A run's icons trail its text, so they follow it in the document too.
    if (typeof r !== "string") {
      for (const icon of r.icons ?? []) pushNode({ type: "rint", attrs: { icon } });
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
  const runs: TextRun[] = [];
  const paras = doc.content ?? [];
  paras.forEach((para, pi) => {
    if (pi > 0) runs.push("|"); // paragraph boundary -> BSsplit line break
    for (const node of para.content ?? []) {
      if (node.type === "hardBreak") {
        runs.push("|");
        continue;
      }
      if (node.type === "rws") {
        runs.push({ rws: (node.attrs?.args as string) ?? "" });
        continue;
      }
      if (node.type === "rint") {
        const icon = (node.attrs?.icon ?? "") as LabelIcon;
        if (icon === "") continue; // an empty node carries nothing to render
        // Icons trail a run, so attach to the run just before — that reproduces
        // `{ text: "Euston", icons: [...] }` exactly instead of splitting it in
        // two. A plain string run has to be promoted to hold them.
        const last = runs[runs.length - 1];
        if (typeof last === "string" && last !== "|") {
          runs[runs.length - 1] = { text: last, icons: [icon] };
        } else if (last != null && typeof last === "object" && !last.rws) {
          // An rws run is atomic (its text comes from the wiki), so icons after
          // one become their own run rather than riding along.
          last.icons = [...(last.icons ?? []), icon];
        } else {
          runs.push({ icons: [icon] });
        }
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
