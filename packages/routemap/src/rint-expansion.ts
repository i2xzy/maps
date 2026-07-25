/**
 * Reading a {{rint}} expansion — the one place that knows what the template's
 * output looks like.
 *
 * Shared by two callers that reach it very differently: `rint.ts` expands one code
 * at a time in the browser, and `scripts/build-rint-catalog.mjs` expands ~2,900 in
 * batches from node. They used to carry a copy each, and the copies drifted: only
 * one normalised `_` to a space, so the catalog recorded "ACE arrows.svg" while the
 * live lookup recorded "ACE_arrows.svg". Both URLs resolve — MediaWiki treats the
 * two as the same title — so the catalog seed and the live result were the same
 * image under different urls, and the logo silently re-fetched and flickered
 * exactly where seeding was supposed to prevent it.
 *
 * DELIBERATELY A LEAF MODULE with no runtime imports. The catalog script is plain
 * node, which can strip TypeScript types but cannot resolve this package's
 * extensionless relative imports — so anything this file imported at runtime would
 * put the duplication back. `import type` is erased, so types are free.
 */

/** A resolved rint logo: file, size, and the operator article it links to. */
export interface RintEntry {
  /** Commons file name, no `File:` prefix, MediaWiki-normalized (spaces, not `_`). */
  file: string;
  /** Width in px that rint itself emits. */
  size?: number;
  /** Link target (the operator's article), from rint's `link=`. */
  link?: string;
  /** Descriptive alt text, from rint's `alt=`. */
  alt?: string;
}

/**
 * The logo a {{rint}} expansion describes, or null if it produced no image.
 *
 * rint emits `[[File:X|Npx|link=Article|alt=Alt]]`. Plenty of codes legitimately
 * expand to something else — a coloured {{RouteBox}}, plain text, or nothing at all
 * — and those are not failures, they're just not drawable, hence null rather than a
 * throw.
 */
export function parseRintExpansion(wikitext: string): RintEntry | null {
  // Whitespace is legal either side of the namespace colon, and the namespace is
  // case-insensitive — so match what MediaWiki accepts, not just what rint happens
  // to emit today.
  const file = /\[\[\s*File\s*:\s*([^|\]]+)/i.exec(wikitext)?.[1]?.trim();
  if (!file) return null;
  return {
    // MediaWiki titles treat `_` and ` ` as the same character. Normalizing here
    // means one code always yields one url, whichever caller resolved it.
    file: file.replace(/_/g, " "),
    // rint sizes the icon in the File link, e.g. `|10px|` (or `|10x10px|`).
    size: Number(/\|\s*(\d+)(?:x\d+)?px/.exec(wikitext)?.[1]) || undefined,
    link: /\|\s*link\s*=\s*([^|\]]+)/.exec(wikitext)?.[1]?.trim() || undefined,
    alt: /\|\s*alt\s*=\s*([^|\]]+)/.exec(wikitext)?.[1]?.trim() || undefined,
  };
}
