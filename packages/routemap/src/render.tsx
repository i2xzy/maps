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
import { useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { LabelIcon, RouteDiagram, TextRun } from "./types";
import { computeLayout, type PlacedCell } from "./layout";
import { isWidthPrefix, prefixWidthFraction, type NormalizedSide } from "./normalize";
import { createLogoResolver, type ResolvedLogo, type RwsEntry } from "./rint";

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
 * between `{{rint|…}}` and the label text. `spaced()` below reproduces exactly where
 * `serialize.ts` writes those spaces, so the render and the wikitext agree by
 * construction rather than by coincidence.
 */
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
 * Join logos, and the boundary between logos and text, with single spaces — the way
 * `serialize.ts` does: logos are `join(" ")`, and a boundary space appears only when
 * there is text on that side (`${s}${s ? " " : ""}${icons}`). A lone `{ icons: [...] }`
 * run gets no space of its own, because on the wiki side the neighbouring text
 * carries it.
 */
function spaced(...parts: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (part == null || part === "") continue;
    if (out.length) out.push(" ");
    out.push(part);
  }
  return out;
}

/** Render {{rint}} logo <img>s for a set of label icons (unresolved ones omitted).
 *  rint sizes are a WIDTH bound (MediaWiki `|Npx|` sets width; height auto-scales),
 *  so we fix width and let height flow. Width precedence: the icon's explicit
 *  `size` > rint's own size > 14px default. */
function renderLogos(
  icons: LabelIcon[],
  resolveLogo: (icon: LabelIcon) => ResolvedLogo,
  resolveHref: (ref: string) => string | undefined,
): ReactNode[] {
  return icons
    .map((ic, i) => {
      const { url, size, link, alt } = resolveLogo(ic);
      if (!url) return null; // unresolved rint code — omit until available
      const opt = typeof ic === "string" ? undefined : ic;
      const img = <img src={url} alt={opt?.alt ?? alt ?? ""} style={logoImgStyle(opt?.size ?? size ?? 14)} />;
      // rint logos link to the operator's article, with the article as hover text.
      const href = link ? resolveHref(link) : undefined;
      return href ? (
        <a key={i} href={href} title={link}>
          {img}
        </a>
      ) : (
        <span key={i}>{img}</span>
      );
    })
    .filter(Boolean)
    .flatMap((logo, i) => (i ? [" ", logo] : [logo])); // {{rint|a}} {{rint|b}}
}

/**
 * Where a label sits. A colspan row is neither side: it leads with its logos like a
 * left label, but it is NOT one of the main side cells, which matters because the
 * wiki rule that shrinks a {{BSsplit}} is scoped to those.
 */
type LabelSide = "left" | "right" | "colspan";

/**
 * Place logos on the OUTER edge of text: before it for a left label, after for right.
 *
 * Plain inline flow, NOT a flex container. Wrapping a label in `inline-flex` makes
 * every text run a flex item, and a flex item trims its own leading and trailing
 * whitespace — so `["…", " London ", { rws }]` lost the spaces around "London" and
 * the words ran together. A `gap` on the container used to hide that by inserting
 * space between every item; take the gap away and the crushing shows. Logos align
 * themselves via `vertical-align`, which is what inline content is supposed to use.
 */
function withLogos(text: ReactNode, logos: ReactNode[], side: LabelSide): ReactNode {
  if (logos.length === 0) return text;
  return <>{side === "right" ? spaced(text, logos) : spaced(logos, text)}</>;
}

interface Fragment {
  text: string;
  link?: string | true;
  rws?: string;
  title?: string;
  icons?: LabelIcon[];
  bold?: boolean;
  italic?: boolean;
}

// Split a run's text on an unescaped `|` (line break); unescape `\|` to a pipe.
const splitLines = (s: string): string[] =>
  s.split(/(?<!\\)\|/).map((p) => p.replace(/\\\|/g, "|"));

/**
 * Flatten a label's text into lines of inline fragments. Runs concatenate inline;
 * a `|` in any run's text starts a new line (BSsplit). A run's link/title/icons
 * ride along on its fragment; label-level link/title are the per-fragment default.
 */
function buildLines(
  text: string | TextRun[],
  labelLink?: string | true,
  labelTitle?: string,
): Fragment[][] {
  const runs: TextRun[] = typeof text === "string" ? [text] : text;
  const lines: Fragment[][] = [[]];
  for (const run of runs) {
    const r = typeof run === "string" ? { text: run } : run;
    const pieces = splitLines(r.text ?? "");
    pieces.forEach((piece, i) => {
      if (i > 0) lines.push([]);
      (lines[lines.length - 1] as Fragment[]).push({
        text: piece,
        link: r.link ?? labelLink,
        rws: r.rws,
        title: r.title ?? labelTitle,
        icons: i === pieces.length - 1 ? r.icons : undefined, // icons trail the run
        bold: r.bold,
        italic: r.italic,
      });
    });
  }
  return lines;
}

/** One fragment: (optionally linked) text + inline logos right after it. */
function renderFragment(
  f: Fragment,
  key: number,
  resolveHref: (ref: string) => string | undefined,
  resolveRws: (args: string) => RwsEntry | undefined,
  resolveLogo: (icon: LabelIcon) => ResolvedLogo,
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
  const logos = renderLogos(f.icons ?? [], resolveLogo, resolveHref);
  // Plain inline flow — see logoImgStyle on why this must not be a flex container.
  return <span key={key}>{logos.length ? spaced(node, logos) : node}</span>;
}

/**
 * A side label: text plus optional inline logos ({{rint}} transit icons). Logos
 * render on the OUTER edge — before the text for a left label, after it for a
 * right one — mirroring how wiki places interchange icons beside a station name.
 * `italic` renders the text slightly smaller (wiki line/annotation convention);
 * `bold` bolds it. Logos keep their own size.
 */
function Label({
  label,
  side,
  resolveHref,
  resolveRws,
  resolveLogo,
}: {
  label?: NormalizedSide | null;
  side: LabelSide;
  resolveHref: (ref: string) => string | undefined;
  resolveRws: (args: string) => RwsEntry | undefined;
  resolveLogo: (icon: LabelIcon) => ResolvedLogo;
}): ReactNode {
  const text = label?.text;
  const hasText = text != null && text !== "" && (typeof text === "string" || text.length > 0);
  const icons = Array.isArray(label?.icons) ? label.icons : [];
  if (!hasText && icons.length === 0) return "";

  const style: TextStyle = {
    fontStyle: label?.italic ? "italic" : undefined,
    fontWeight: label?.bold ? "bold" : undefined,
  };

  let textNode: ReactNode = null;
  if (hasText) {
    const lines = buildLines(text as string | TextRun[], label?.link, label?.title);
    const renderLine = (line: Fragment[]) =>
      line.map((f, i) => renderFragment(f, i, resolveHref, resolveRws, resolveLogo));
    const hasStyle = style.fontStyle || style.fontWeight || style.fontSize;
    if (lines.length === 1) {
      const inner = renderLine(lines[0] as Fragment[]);
      textNode = hasStyle ? <span style={style}>{inner}</span> : <>{inner}</>;
    } else {
      // Multi-line -> BSsplit inline-table (tight rows so the track stays connected).
      textNode = (
        <span
          style={{
            display: "inline-table",
            verticalAlign: "middle",
            margin: "-3px 0",
            // `table.routemap .RMl > .RMsplit, .RMr > .RMsplit { font-size: 90% }`
            // — a {{BSsplit}} in a main side cell is smaller, unconditionally. The
            // rule is scoped to those cells, so a colspan row's split is not.
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
  }
  // Whole-label icons sit on the outer edge (before text for left, after for right).
  return withLogos(textNode, renderLogos(icons, resolveLogo, resolveHref), side);
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
            alt={base ? (icon.title ?? icon.code) : (icon.title ?? "")}
            title={icon.title}
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
          if (row.colspan != null) {
            return (
              <tr key={row.index} {...rowProps(row.index)} style={{ ...cursor, ...ring(rowSel) }}>
                <td colSpan={3} style={{ ...labelCell, textAlign: "center", padding: "4px 8px" }}>
                  <Label label={row.colspan} side="colspan" resolveHref={resolveHref} resolveRws={resolveRws} resolveLogo={resolveLogo} />
                </td>
              </tr>
            );
          }

          return (
            <tr key={row.index} {...rowProps(row.index)} style={{ ...cursor, ...ring(rowSel) }}>
              <td style={{ ...labelCell, textAlign: "right" }}>
                <Label label={row.left} side="left" resolveHref={resolveHref} resolveRws={resolveRws} resolveLogo={resolveLogo} />
              </td>
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
              <td style={{ ...labelCell, textAlign: "left" }}>
                <Label label={row.right} side="right" resolveHref={resolveHref} resolveRws={resolveRws} resolveLogo={resolveLogo} />
              </td>
            </tr>
          );
        })}
      </tbody>
      </table>
    </>
  );
}
