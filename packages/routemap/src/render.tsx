/**
 * React HTML renderer: draws a RouteDiagram as an HTML table, the way Wikipedia
 * renders {{Routemap}} (table / rows / one inline icon cell / stacked <img>).
 *
 * Faithful to Module:Routemap + Template:Routemap/styles.css:
 *   - Every row's icons live in ONE middle cell as a flat flow of inline-block
 *     boxes (wiki concatenates them into a single `RMr`/`RMir` cell). There is no
 *     per-icon table column, so nothing to keep in sync across rows.
 *   - Each icon is an <img> at a fixed HEIGHT with width auto (wiki's `x20px`),
 *     so full / `d`-half / `c`-quarter / stacked-prefix `etdKRZ` all size purely
 *     by the SVG's own aspect ratio. No width is parsed from the icon code.
 *   - Overlays (`!~`) stack: the first icon sits in flow and sets the cell width;
 *     the rest are absolutely positioned on top.
 *   - A bare spacer cell (empty column or a lone width prefix like "d") gets an
 *     explicit width — the only place the width prefix means anything.
 *
 * `resolveIcon` maps a BSicon code to an SVG url (Commons by default). Labels can
 * also carry {{rint}}-style transit logos, resolved by `resolveLogo` (raw file
 * names, not BSicons).
 */
import {
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type { LabelIcon, RouteDiagram, TextRun } from "./types";
import { computeLayout, type PlacedCell } from "./layout";
import { isWidthPrefix, prefixWidthFraction, type NormalizedSide } from "./normalize";
import {
  createLogoResolver,
  iconTemplateCall,
  textTemplateCall,
  type ResolvedLogo,
  type RwsEntry,
} from "./rint";
import { parseRintExpansion } from "./rint-expansion";
import { parseLabelText, template } from "./from-wikitext";

/**
 * A selected element in a diagram, for the editor's click-to-inspect flow:
 *   - `cell`  one column slot (row + its cells[] index) — the icon under the pointer
 *   - `row`   the whole row — chosen when the pointer is over a side label, a
 *             colspan row, or the gaps between/around cells (anything but a cell)
 * Coordinates are SOURCE indices (row = `DiagramRow` index, col = `cells[]`
 * index), which the layout preserves 1:1 as `PlacedRow.index`/`PlacedCell.column`.
 */
export type Selection =
  | { kind: "cell"; row: number; col: number }
  | { kind: "row"; row: number };

/**
 * `tram|Derker` -> the wikitext `{{tram|Derker}}` expands to.
 *
 * Keyed by the CALL rather than the raw run so the same station link written two ways
 * (`{{ tram | Derker }}`) resolves once — `textTemplateCall` normalises it.
 */
export type TextResolver = (call: string) => string | undefined;

export interface RouteMapProps {
  diagram: RouteDiagram;
  /** BSicon code -> SVG url. Default: Commons Special:FilePath/BSicon_<code>.svg. */
  resolveIcon?: (code: string) => string;
  /** Label logo ({{rint}}) -> { url, size }. Default resolves `{ file }` icons;
   *  supply one built from `expandRint` (createLogoResolver) for rint codes. */
  resolveLogo?: (icon: LabelIcon) => ResolvedLogo;
  /** Link reference -> url (for `link` on labels/runs). Default: identity (the
   *  ref IS the url). Editor passes Wikipedia urls; an app passes custom urls. */
  resolveHref?: (ref: string) => string | undefined;
  /** {{rws}} args -> { target, display } (for `rws` runs). Build from `expandRws`.
   *  Wiki-side only; unresolved rws runs render nothing. */
  resolveRws?: (args: string) => RwsEntry | undefined;
  /** `tram|Derker` -> `[[Derker tram stop|Derker]]` — the station-link templates that
   *  would otherwise render as a muted placeholder (47% of them in real diagrams).
   *  Build from `expandTextTemplates`; unresolved keeps the placeholder. */
  resolveText?: TextResolver;
  /** Icon row height in px (Wikipedia's default is 20). */
  cellSize?: number;
  /** Currently selected element, highlighted in the render. Editor-only. */
  selection?: Selection | null;
  /** Fires when a cell / side label / colspan row is clicked. Passing this makes
   *  the diagram interactive (pointer cursor + highlight); omit for pure render. */
  onSelect?: (selection: Selection) => void;
}

// Highlight rings for the editor's click-to-inspect flow (editor-only). Both are
// inset so they hug the element without nudging layout. A solid ring + tint marks
// the SELECTED element; a lighter ring marks whatever is under the pointer.
const SELECT_COLOR = "#3182ce";
const selectedStyle: CSSProperties = {
  outline: `2px solid ${SELECT_COLOR}`,
  outlineOffset: "-2px",
  background: "rgba(49,130,206,0.08)",
};
const hoverStyle: CSSProperties = {
  outline: `1px solid rgba(49,130,206,0.5)`,
  outlineOffset: "-1px",
  background: "rgba(49,130,206,0.04)",
};

/** Commons image URL for a BSicon code (the default icon resolver; also handy
 *  for building icon previews in a GUI). */
export const commonsUrl = (code: string): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/BSicon_${encodeURIComponent(code)}.svg`;

// Default logo resolver: handles `{ file }` icons; `{ region, name }` need a
// resolver built from expandRint (they render nothing until resolved).
const defaultResolveLogo = createLogoResolver();

// Default href resolver: the reference is already a url/path.
const defaultResolveHref = (ref: string): string => ref;

// Default rws resolver: nothing resolved (rws is wiki-side; the editor supplies one).
const defaultResolveRws = (): RwsEntry | undefined => undefined;

// Text links: browser-default color (blue), underline on hover only — like
// Wikipedia. `revert` rolls back any app anchor reset (e.g. Chakra's
// `a { color: inherit; text-decoration: none }`) to the user-agent value; the
// hover rule needs a stylesheet, so we inject one scoped to this class.
const LINK_CLASS = "rm-link";
const linkCss =
  `.${LINK_CLASS}{color:revert;text-decoration:none}` +
  `.${LINK_CLASS}:hover{text-decoration:underline}`;

const labelCell: CSSProperties = {
  padding: "0 4px",
  color: "#333",
  verticalAlign: "middle",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

/**
 * The seven label cells of a row, styled as `Template:Routemap/styles.css` styles
 * them. A row is always seven columns wide — `.RMl4`, `.RMl`, `.RMl1`, `.RMir`,
 * `.RMr1`, `.RMr`, `.RMr4` — and the main cells absorb an absent outer cell with a
 * colspan rather than the row losing a column, which is what keeps labels lined up
 * from row to row.
 *
 * The alignments are NOT symmetric by position, which is easy to get wrong: `main`
 * hugs the icon strip while `dist` hugs away from it, and the outer remarks hug the
 * table's outside edges.
 */
const SLOT_CELL: Record<"outer" | "main" | "dist", Record<"left" | "right", CSSProperties>> = {
  // .RMl4 / .RMr4 — leftmost and rightmost.
  outer: {
    left: { ...labelCell, padding: "0 3px 0 0", textAlign: "left" },
    right: { ...labelCell, padding: "0 0 0 3px", textAlign: "right" },
  },
  // .RMl / .RMr — holds `main` and, sharing the cell, `remark`.
  main: {
    left: { ...labelCell, padding: 0, textAlign: "right" },
    right: { ...labelCell, padding: 0, textAlign: "left" },
  },
  // .RMl1 / .RMr1 — nearest the icons, and aligned away from them.
  dist: {
    left: { ...labelCell, padding: "0 3px", textAlign: "left" },
    right: { ...labelCell, padding: "0 3px", textAlign: "right" },
  },
};

/**
 * `.RMsi` — the 90% wrapper the module puts round `dist`, `remark` and `outer`.
 *
 * A span, and explicitly `display: inline`. The module uses a div here and the
 * stylesheet forces it back inline with the comment "HTML Tidy forced the use of div
 * instead of span" — so inline is the intent, and it matters: `remark` shares a cell
 * with `main` and has to sit BESIDE it, not below.
 */
const smallSlot: CSSProperties = { display: "inline", fontSize: "90%" };

type TextStyle = { fontStyle?: "italic"; fontWeight?: "bold"; fontSize?: string };

/**
 * How Wikipedia draws a label logo, and therefore how we do.
 *
 * On a rendered {{Routemap}}, a label's logos and its text are plain siblings in the
 * `<td>` — no wrapper, no flex, no grid. The image is `display: inline` with
 * `vertical-align: middle`, its anchor is untouched, and the logo carries
 * `margin: 0`. `Template:Routemap/styles.css` has no image rule for labels at all
 * (its one `img` rule is scoped to `.RMir`, the icon row).
 *
 * All spacing is therefore a LITERAL SPACE in the markup — the space the author typed
 * between `{{rint|…}}` and the label text. Which is exactly what a `" "` run is here,
 * so the render and the wikitext agree by construction rather than by coincidence.
 */
/**
 * How a label logo is sized and laid out — exported so anything else showing one shows
 * it at the same size.
 *
 * The width precedence and the width-not-height rule both live here because they were
 * duplicated once and drifted: the editor sized by HEIGHT, which made a wide logo like
 * National Rail render 1.9x too wide beside the same logo in the diagram.
 */
export function labelLogoStyle(icon: LabelIcon, resolved: ResolvedLogo): CSSProperties {
  const opt = typeof icon === "string" ? undefined : icon;
  return logoImgStyle(opt?.size ?? resolved.size ?? 14);
}

const logoImgStyle = (width: number): CSSProperties => ({
  // `inline` is what MediaWiki computes, but it has to be stated: host CSS resets
  // (Chakra's preflight, Tailwind's) set `img { display: block }`, which turns every
  // logo into its own line. Same reason the link styles below use `revert`.
  display: "inline",
  width,
  height: "auto",
  maxWidth: "none",
  verticalAlign: "middle",
});

/**
 * One {{rint}} logo.
 *
 * rint sizes are a WIDTH bound (MediaWiki `|Npx|` sets width; height auto-scales), so
 * we fix width and let height flow. Width precedence: the icon's explicit `size` >
 * rint's own size > 14px default.
 *
 * One logo, not a list: spacing between adjacent logos is the author's, written as a
 * run, exactly as the space between `{{rint|a}}` and `{{rint|b}}` is in the wikitext.
 * An unresolved code renders nothing until it resolves.
 */
function Logo({
  icon,
  resolveLogo,
  resolveHref,
}: {
  icon: LabelIcon;
  resolveLogo: (icon: LabelIcon) => ResolvedLogo;
  resolveHref: (ref: string) => string | undefined;
}): ReactNode {
  const resolved = resolveLogo(icon);
  const { url, link, alt } = resolved;
  if (!url) return null;
  const opt = typeof icon === "string" ? undefined : icon;
  const img = <img src={url} alt={opt?.alt ?? alt ?? ""} style={labelLogoStyle(icon, resolved)} />;
  // rint logos link to the operator's article, with the article as hover text.
  const href = link ? resolveHref(link) : undefined;
  return href ? (
    <a href={href} title={link}>
      {img}
    </a>
  ) : (
    <span>{img}</span>
  );
}

/**
 * Where a label sits. A colspan row is neither side: it leads with its logos like a
 * left label, but it is NOT one of the main side cells, which matters because the
 * wiki rule that shrinks a {{BSsplit}} is scoped to those.
 */
type LabelSide = "left" | "right" | "colspan";

interface Fragment {
  text: string;
  link?: string | true;
  rws?: string;
  title?: string;
  bold?: boolean;
  italic?: boolean;
}

/** Wikitext we can't render, shown compactly rather than dumped in full. */
interface RawPiece {
  raw: string;
}

/** A logo on a line, where the author put it. */
interface IconPiece {
  icon: LabelIcon;
}

/** A `<br>` on a line — a break WITHIN the line, not a new one. */
interface BreakPiece {
  br: true;
}

/** A split run nested in a line — its own stack of lines, rendered inline. */
interface SplitPiece {
  lines: Piece[][];
}
/** One thing on a line: a text fragment, or a `{{BSsplit}}` sitting beside it. */
type Piece = Fragment | SplitPiece | BreakPiece | IconPiece | RawPiece;

const isSplitPiece = (p: Piece): p is SplitPiece => "lines" in p;
const isBreakPiece = (p: Piece): p is BreakPiece => "br" in p;
const isIconPiece = (p: Piece): p is IconPiece => "icon" in p;
const isRawPiece = (p: Piece): p is RawPiece => "raw" in p;

// Split a run's text on an unescaped `|` (line break); unescape `\|` to a pipe.
const splitLines = (s: string): string[] =>
  s.split(/(?<!\\)\|/).map((p) => p.replace(/\\\|/g, "|"));

/**
 * Flatten a label's text into lines of inline pieces. Runs concatenate inline; a `|`
 * in any run's text starts a new line (BSsplit sugar). A run's link/title/icons ride
 * along on its fragment; label-level link/title are the per-fragment default.
 *
 * A `{ split }` run is a piece ON a line rather than a break in it, which is the whole
 * point: whatever sits beside it stays beside it instead of being pushed onto line one.
 */
function buildLines(
  text: string | TextRun[],
  labelLink?: string | true,
  labelTitle?: string,
): Piece[][] {
  const runs: TextRun[] = typeof text === "string" ? [text] : text;
  const lines: Piece[][] = [[]];
  for (const run of runs) {
    if (typeof run === "object" && "raw" in run) {
      (lines[lines.length - 1] as Piece[]).push({ raw: run.raw });
      continue;
    }
    if (typeof run === "object" && "icon" in run) {
      (lines[lines.length - 1] as Piece[]).push({ icon: run.icon });
      continue;
    }
    if (typeof run === "object" && "br" in run) {
      (lines[lines.length - 1] as Piece[]).push({ br: true });
      continue;
    }
    if (typeof run === "object" && "split" in run) {
      (lines[lines.length - 1] as Piece[]).push({
        lines: run.split.map((line) => buildLines(line, labelLink, labelTitle).flat()),
      });
      continue;
    }
    const r = typeof run === "string" ? { text: run } : run;
    const pieces = splitLines(r.text ?? "");
    pieces.forEach((piece, i) => {
      if (i > 0) lines.push([]);
      (lines[lines.length - 1] as Piece[]).push({
        text: piece,
        link: r.link ?? labelLink,
        rws: r.rws,
        title: r.title ?? labelTitle,
        bold: r.bold,
        italic: r.italic,
      });
    });
  }
  return lines;
}

/**
 * Wikitext we don't model — an unrecognised template, usually.
 *
 * Truncated, because a quarter of the rows in real diagrams carry one and dumping
 * `{{BSto|[[Template:X|X]]|to {{rws|Y}}|it=all}}` into a label at full length shoves the
 * icon strip off screen. Muted so it reads as "not understood" rather than as content,
 * with the whole thing one hover away.
 *
 * The station-link family IS expanded now (`resolveText`, from `expandTextTemplates`) —
 * that's 47% of the placeholders in real diagrams. What still lands here is the layout
 * family ({{BSto}}, {{left}}, {{enlarge}}), which expands to HTML we can't render, so
 * showing the source is genuinely better than showing its expansion.
 */
function RawText({ raw }: { raw: string }): ReactElement {
  return (
    <span
      title={raw}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        maxWidth: "10em",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: 0.55,
        fontStyle: "italic",
      }}
    >
      {raw}
    </span>
  );
}

/**
 * A `{{BSsplit}}`: lines stacked in an inline-table, tight enough that the track
 * either side stays connected.
 *
 * Shared by the `|` sugar (which splits the whole label) and an explicit `{ split }`
 * run (which stacks lines beside its neighbours), so the two can't drift apart.
 */
function SplitTable({
  lines,
  side,
  renderLine,
  style,
}: {
  lines: Piece[][];
  side: LabelSide;
  renderLine: (line: Piece[]) => ReactNode[];
  style?: CSSProperties;
}): ReactElement {
  return (
    <span
      style={{
        display: "inline-table",
        verticalAlign: "middle",
        margin: "-3px 0",
        // `table.routemap .RMl > .RMsplit, .RMr > .RMsplit { font-size: 90% }` — a
        // {{BSsplit}} in a main side cell is smaller, unconditionally. The rule is
        // scoped to those cells, so a colspan row's split is not.
        fontSize: side === "colspan" ? undefined : "90%",
        ...style,
      }}
    >
      {lines.map((line, i) => (
        <span key={i} style={{ display: "table-row" }}>
          <span style={{ display: "table-cell", textAlign: "inherit", lineHeight: 1.05 }}>
            {renderLine(line)}
          </span>
        </span>
      ))}
    </span>
  );
}

/** One fragment: (optionally linked) text + inline logos right after it. */
function renderFragment(
  f: Fragment,
  key: number,
  resolveHref: (ref: string) => string | undefined,
  resolveRws: (args: string) => RwsEntry | undefined,
): ReactNode {
  let node: ReactNode = f.text;
  if (f.rws) {
    // Station link: display + target both come from resolving the rws args.
    const r = resolveRws(f.rws);
    if (r) {
      const href = resolveHref(r.target);
      const title = f.title ?? r.target;
      node = href ? (
        <a href={href} title={title} className={LINK_CLASS}>
          {r.display}
        </a>
      ) : (
        <span title={title}>{r.display}</span>
      );
    } else {
      node = null; // unresolved -> omit until available
    }
  } else if (f.text && f.link != null) {
    const ref = f.link === true ? f.text : f.link;
    const href = resolveHref(ref);
    // Hover shows the link target (the article name), like a wiki [[link]].
    const title = f.title ?? ref;
    node = href ? (
      <a href={href} title={title} className={LINK_CLASS}>
        {f.text}
      </a>
    ) : (
      <span title={title}>{f.text}</span>
    );
  } else if (f.text && f.title) {
    node = <span title={f.title}>{f.text}</span>;
  }
  if (f.bold || f.italic) {
    node = (
      <span style={{ fontWeight: f.bold ? "bold" : undefined, fontStyle: f.italic ? "italic" : undefined }}>
        {node}
      </span>
    );
  }
  return <span key={key}>{node}</span>;
}

/**
 * A side label: its runs, in the order the author wrote them.
 *
 * Logos are `{ icon }` runs, so there is no outer-edge rule any more and no separate
 * whole-label icon list — which is what let two different models serialize to the same
 * wikitext. `italic`/`bold` style the whole label; a logo keeps its own size.
 */
/**
 * Replace resolvable `{ raw }` runs with the runs their expansion parses to.
 *
 * Done here, before `buildLines`, rather than in `RawText` — a station link expands to
 * `[[target|display]]`, and feeding that back through the normal run pipeline means links,
 * marks and splits all keep working with no second rendering path to maintain.
 *
 * Unresolved (not fetched yet, or the request failed) leaves the run exactly as it was, so
 * this can only ever improve on the placeholder.
 */
function expandRawRuns(
  text: string | TextRun[],
  resolveText?: TextResolver,
): string | TextRun[] {
  // No early return on a missing resolver: a File link written directly in the label needs
  // no resolution at all, and skipping the whole pass would keep showing its source.
  if (typeof text === "string") return text;
  return text.flatMap((run): TextRun[] => {
    if (run == null || typeof run !== "object") return [run];
    if ("split" in run) {
      return [
        {
          split: run.split.map((line) =>
            typeof line === "string" ? line : (expandRawRuns(line, resolveText) as TextRun[]),
          ),
        },
      ];
    }
    if (!("raw" in run)) return [run];

    // A File link written straight into the label — `[[File:BSicon TRAM.svg|20px|…]]`, which
    // real diagrams use for the transport-mode glyphs. Already expanded wikitext, so it
    // needs no fetch and resolves even with no resolver supplied at all.
    if (/^\[\[\s*(?:File|Image)\s*:/i.test(run.raw.trim())) {
      const entry = parseRintExpansion(run.raw);
      if (entry) return [{ icon: { file: entry.file, size: entry.size, alt: entry.alt } }];
    }

    // `{{BSto|line1|line2|linkTarget}}` — a "to <destinations>" label. It expands to exactly
    // the `.RMsplit` two-row table we already model, so it's built from the ARGUMENTS: no
    // API call, and nothing to pick out of HTML. The model keeps its `{ raw }`, so the
    // wikitext still round-trips byte for byte.
    //
    // Measured against the live template, because the name misleads on both counts: the
    // THIRD positional arg is a link target applied to BOTH lines, not a third line, and
    // `it=all` and `it=none` produce identical output — so `it=` is ignored here rather than
    // guessed at. Line 2 is italic; line 1's 105% is not modelled.
    const bsto = /^\{\{\s*bsto\s*\|/i.test(run.raw.trim()) ? template(run.raw.trim()) : null;
    if (bsto) {
      const positional = bsto.args.filter((a) => !/^\s*[a-z][\w-]*\s*=/i.test(a));
      const [first = "", second = "", link] = positional;
      const line = (body: string, italic: boolean): TextRun[] => {
        const runs = parseLabelText(body.trim());
        if (!italic && !link) return runs;
        return runs.map((r) =>
          typeof r === "string"
            ? ({ text: r, ...(italic ? { italic: true } : {}), ...(link ? { link } : {}) } as TextRun)
            : "text" in r
              ? ({ ...r, ...(italic ? { italic: true } : {}), ...(link && !r.link ? { link } : {}) } as TextRun)
              : r,
        );
      };
      return [{ split: [line(first, false), line(second, true)] }];
    }

    // A file-producing template ({{rmri}}, {{ric}}) expands to the same `[[File:…|Npx]]`
    // shape as {{rint}}, so it becomes a logo run and renders through the existing path.
    // `link=` is dropped: a `{ file }` label icon has nowhere to carry one. {{rmri}} emits
    // an empty link anyway; {{ric}} loses a station link, which still beats grey wikitext.
    const iconCall = resolveText ? iconTemplateCall(run.raw) : null;
    if (iconCall) {
      const entry = parseRintExpansion(resolveText!(iconCall) ?? "");
      return entry ? [{ icon: { file: entry.file, size: entry.size, alt: entry.alt } }] : [run];
    }

    const call = resolveText ? textTemplateCall(run.raw) : null;
    const expanded = call ? resolveText!(call) : undefined;
    return expanded ? parseLabelText(expanded) : [run];
  });
}

function Label({
  label,
  side,
  resolveHref,
  resolveRws,
  resolveLogo,
  resolveText,
}: {
  label?: NormalizedSide | null;
  side: LabelSide;
  resolveHref: (ref: string) => string | undefined;
  resolveRws: (args: string) => RwsEntry | undefined;
  resolveLogo: (icon: LabelIcon) => ResolvedLogo;
  resolveText?: TextResolver;
}): ReactNode {
  const text = label?.text;
  const hasText = text != null && text !== "" && (typeof text === "string" || text.length > 0);
  if (!hasText) return "";

  const style: TextStyle = {
    fontStyle: label?.italic ? "italic" : undefined,
    fontWeight: label?.bold ? "bold" : undefined,
  };

  let textNode: ReactNode = null;
  if (hasText) {
    const lines = buildLines(
      expandRawRuns(text as string | TextRun[], resolveText),
      label?.link,
      label?.title,
    );
    const renderLine = (line: Piece[]): ReactNode[] =>
      line.map((piece, i) =>
        isRawPiece(piece) ? (
          <RawText key={i} raw={piece.raw} />
        ) : isIconPiece(piece) ? (
          <Logo key={i} icon={piece.icon} resolveLogo={resolveLogo} resolveHref={resolveHref} />
        ) : isBreakPiece(piece) ? (
          <br key={i} />
        ) : isSplitPiece(piece) ? (
          // A split BESIDE other content, not around it. Same table as the whole-label
          // case below — one `.RMsplit`, so it shrinks by the same rule.
          <SplitTable key={i} lines={piece.lines} side={side} renderLine={renderLine} />
        ) : (
          renderFragment(piece, i, resolveHref, resolveRws)
        ),
      );
    const hasStyle = style.fontStyle || style.fontWeight || style.fontSize;
    if (lines.length === 1) {
      const inner = renderLine(lines[0] as Piece[]);
      textNode = hasStyle ? <span style={style}>{inner}</span> : <>{inner}</>;
    } else {
      // `|` sugar split the whole label — the same table, wrapping everything.
      textNode = (
        <SplitTable lines={lines} side={side} renderLine={renderLine} style={style} />
      );
    }
  }
  return textNode;
}

function Cell({
  cell,
  cellSize,
  resolveIcon,
}: {
  cell: PlacedCell;
  cellSize: number;
  resolveIcon: (code: string) => string;
}): ReactElement {
  // Spacer: a sized blank that keeps columns aligned (empty column or "d"/"cd"…).
  if (cell.spacer != null) {
    return (
      <span
        style={{
          display: "inline-block",
          width: cell.spacer * cellSize,
          height: cellSize,
          verticalAlign: "middle",
        }}
      />
    );
  }

  // Icon cell (possibly an `!~` stack). The FIRST icon is the base: it sits in
  // flow and alone sets the cell width (from its SVG aspect ratio); overlays are
  // absolutely positioned on top and never widen the cell — matching how the wiki
  // module lays out `!~`. A base that is a bare width prefix ("d", "" …) is not
  // an image but an empty sized box, the wiki trick for forcing a stack's width.
  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        height: cellSize,
        verticalAlign: "middle",
        fontSize: 0,
      }}
    >
      {cell.icons.map((icon, i) => {
        const base = i === 0;

        if (base && (icon.code === "" || isWidthPrefix(icon.code))) {
          const frac = icon.code === "" ? 1 : prefixWidthFraction(icon.code);
          return (
            <span
              key={i}
              style={{ display: "inline-block", width: frac * cellSize, height: cellSize }}
            />
          );
        }

        const img = (
          <img
            src={resolveIcon(icon.code)}
            // `alt=""` and the code as the tooltip is what Module:Routemap emits: a track
            // glyph is decorative to a screen reader, and the code is what a diagram author
            // wants on hover. `{{Routemap}}`'s own docs say "the ID of each icon can be
            // seen in its tooltip".
            alt=""
            title={icon.code}
            height={cellSize}
            style={{
              height: cellSize,
              // Defeat any global `img { max-width: 100% }` reset (Chakra/Next/etc.)
              // that would clamp a wider overlay to the base's width and squash it.
              // Matches the wiki's `.RMir img { max-width: initial !important }`.
              maxWidth: "none",
              display: "block",
              ...(base ? null : { position: "absolute", left: 0, top: 0 }),
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
    </span>
  );
}

export function RouteMap({
  diagram,
  resolveIcon = commonsUrl,
  resolveLogo = defaultResolveLogo,
  resolveHref = defaultResolveHref,
  resolveRws = defaultResolveRws,
  resolveText,
  cellSize = 20,
  selection = null,
  onSelect,
}: RouteMapProps): ReactElement {
  const layout = computeLayout(diagram);

  // Hover under the pointer (editor-only). A cell handler stops the mouseover
  // from bubbling to its <tr>, so hovering a cell highlights the cell and
  // hovering anything else in the row (label, colspan text, gaps) highlights the
  // whole row. Cleared when the pointer leaves the table.
  const interactive = !!onSelect;
  const [hovered, setHovered] = useState<Selection | null>(null);

  const same = (a: Selection | null, b: Selection): boolean =>
    a != null && a.kind === b.kind && a.row === b.row && (b.kind !== "cell" || a.kind !== "cell" || a.col === b.col);
  // Selected wins over hovered; neither → no ring.
  const ring = (target: Selection): CSSProperties =>
    same(selection, target) ? selectedStyle : same(hovered, target) ? hoverStyle : {};

  // Row-level interactivity (the <tr>): fires for label / colspan / gap clicks
  // that bubble up past the cells. stopPropagation lets a background click clear.
  const rowProps = (rowIndex: number) => {
    if (!interactive) return {};
    const sel: Selection = { kind: "row", row: rowIndex };
    return {
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onSelect(sel);
      },
      onMouseOver: () => setHovered(sel),
    };
  };
  // Cell-level interactivity (the wrapper <span>): overrides the row for both
  // click and hover by stopping propagation.
  const cellProps = (rowIndex: number, col: number) => {
    if (!interactive) return {};
    const sel: Selection = { kind: "cell", row: rowIndex, col };
    return {
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onSelect(sel);
      },
      onMouseOver: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setHovered(sel);
      },
    };
  };
  const cursor: CSSProperties = interactive ? { cursor: "pointer" } : {};

  return (
    <>
      <style>{linkCss}</style>
      <table
        onMouseLeave={interactive ? () => setHovered(null) : undefined}
        style={{
          borderCollapse: "collapse",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
      <tbody>
        {layout.rows.map((row) => {
          const rowSel: Selection = { kind: "row", row: row.index };
          /** One slot's content: `.RMsi`-wrapped when small, nothing when absent. */
          const slot = (
            label: NormalizedSide | null,
            side: "left" | "right",
            small: boolean,
          ): ReactNode => {
            if (label == null) return null;
            const el = (
              <Label
                label={label}
                side={side}
                resolveHref={resolveHref}
                resolveRws={resolveRws}
                resolveLogo={resolveLogo}
                resolveText={resolveText}
              />
            );
            return small ? <span style={smallSlot}>{el}</span> : el;
          };
          if (row.colspan != null) {
            return (
              <tr key={row.index} {...rowProps(row.index)} style={{ ...cursor, ...ring(rowSel) }}>
                <td colSpan={7} style={{ ...labelCell, textAlign: "center", padding: "4px 8px" }}>
                  <Label
                    label={row.colspan}
                    side="colspan"
                    resolveHref={resolveHref}
                    resolveRws={resolveRws}
                    resolveLogo={resolveLogo}
                    resolveText={resolveText}
                  />
                </td>
              </tr>
            );
          }

          return (
            <tr key={row.index} {...rowProps(row.index)} style={{ ...cursor, ...ring(rowSel) }}>
              {/* .RMl4 — present only when `outer` is; the .RMl colspan covers it. */}
              {row.left.outer ? <td style={SLOT_CELL.outer.left}>{slot(row.left.outer, "left", true)}</td> : null}
              {/* .RMl — `remark` PRECEDES `main` here and follows it on the right, so
                  the pair always reads outward from the icons. */}
              <td colSpan={row.left.outer ? 1 : 2} style={SLOT_CELL.main.left}>
                {row.left.remark ? <>{slot(row.left.remark, "left", true)} </> : null}
                {slot(row.left.main, "left", false)}
              </td>
              {/* .RMl1 */}
              <td style={SLOT_CELL.dist.left}>{slot(row.left.dist, "left", true)}</td>
              <td
                style={{
                  padding: 0,
                  fontSize: 0,
                  verticalAlign: "middle",
                  whiteSpace: "nowrap",
                  textAlign: "center", // wiki centers the icon strip (the RMir cell)
                }}
              >
                {row.cells.map((cell, i) => (
                  <span
                    key={i}
                    {...cellProps(row.index, cell.column)}
                    style={{
                      display: "inline-block",
                      verticalAlign: "middle",
                      ...cursor,
                      ...ring({ kind: "cell", row: row.index, col: cell.column }),
                    }}
                  >
                    <Cell cell={cell} cellSize={cellSize} resolveIcon={resolveIcon} />
                  </span>
                ))}
              </td>
              {/* .RMr1 */}
              <td style={SLOT_CELL.dist.right}>{slot(row.right.dist, "right", true)}</td>
              {/* .RMr — `main` then `remark`, mirroring the left cell. */}
              <td colSpan={row.right.outer ? 1 : 2} style={SLOT_CELL.main.right}>
                {slot(row.right.main, "right", false)}
                {row.right.remark ? <> {slot(row.right.remark, "right", true)}</> : null}
              </td>
              {/* .RMr4 */}
              {row.right.outer ? <td style={SLOT_CELL.outer.right}>{slot(row.right.outer, "right", true)}</td> : null}
            </tr>
          );
        })}
      </tbody>
      </table>
    </>
  );
}
