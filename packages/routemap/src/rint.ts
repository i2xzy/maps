/**
 * Resolve {{rint}} (a.k.a. {{Rail-interchange}}) transit logos.
 *
 * {{Rail-interchange}} is a ~2,000-line wikitext #switch, not a data table, so we
 * don't mirror it — we ask Wikipedia to expand `{{rint|<args>}}` and read back the
 * File it produced. A logo is identified by its rint CODE: the positional args
 * exactly as the template takes them, joined by `|` (e.g. "air",
 * "london|underground"). Config therefore uses the same args as wiki and stays in
 * sync automatically; results are cached.
 *
 * Note: these are trademarked transit logos (and some are non-free), unlike the
 * PD-shape BSicons — a licensing decision for any non-Wikipedia use.
 */
import type { LabelIcon, RouteDiagram } from "./types";
import { normalizeSide } from "./normalize";
import { parseRintExpansion, type RintEntry } from "./rint-expansion";

const DEFAULT_API = "https://en.wikipedia.org/w/api.php";

/** The rint code for an icon (positional args, `|`-joined), or null if it's a file. */
export function rintCode(icon: LabelIcon): string | null {
  if (typeof icon === "string") return icon;
  if ("file" in icon) return null;
  if ("rint" in icon) return icon.rint;
  // region/name -> "region|name"; forgive a lone region OR name (single-arg rint).
  const parts = [icon.region, icon.name].filter((p): p is string => !!p);
  return parts.length ? parts.join("|") : null;
}

/** The explicit file name for an icon, or null if it's a rint code. */
export function iconFile(icon: LabelIcon): string | null {
  return typeof icon === "object" && "file" in icon ? icon.file : null;
}

/** Resolve a raw file name (no `File:` prefix) to an SVG url via Special:FilePath. */
export function logoUrl(file: string): string {
  return `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}

export type { RintEntry } from "./rint-expansion";

/** What `resolveLogo` returns: the image url, rint's size, and its link/alt. */
export interface ResolvedLogo {
  url: string;
  size?: number;
  link?: string;
  alt?: string;
}

/**
 * Resolve wiki references through a cache of IN-FLIGHT requests.
 *
 * The cache holds the promise rather than the result, so callers asking for the same
 * uncached reference at the same time share one request instead of racing to make
 * two. React's dev-mode double-invoke of effects makes that race the norm rather
 * than an edge case — it was fetching every reference exactly twice.
 *
 * A reference that doesn't resolve is evicted, so a transient network error stays
 * retryable instead of being remembered as "no such thing".
 *
 * Awaiting a cached promise hands back the very same entry object each time, which is
 * what lets a caller spot a repeat by reference and skip re-rendering.
 */
async function expandCached<T>(
  refs: string[],
  cache: Map<string, Promise<T | null>>,
  fetchOne: (ref: string) => Promise<T | null>,
): Promise<Record<string, T>> {
  const out: Record<string, T> = {};
  await Promise.all(
    [...new Set(refs)].map(async (ref) => {
      let pending = cache.get(ref);
      if (!pending) {
        pending = fetchOne(ref);
        cache.set(ref, pending);
      }
      const entry = await pending;
      if (entry) out[ref] = entry;
      else cache.delete(ref);
    }),
  );
  return out;
}

/** Expand wikitext via `expandtemplates` (CORS-enabled with origin=*, so it works
 *  client-side). Returns "" if the request fails, which the callers read as
 *  unresolved — and unresolved stays retryable. */
async function expandTemplate(api: string, wikitext: string): Promise<string> {
  const url =
    `${api}?action=expandtemplates&format=json&prop=wikitext&origin=*` +
    `&text=${encodeURIComponent(wikitext)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json?.expandtemplates?.wikitext ?? "";
  } catch {
    return "";
  }
}

// rint code -> resolved entry. Module-level so repeat lookups never re-fetch.
const cache = new Map<string, Promise<RintEntry | null>>();

/**
 * Resolve rint codes to files (and rint's own size) via the MediaWiki
 * `expandtemplates` API. Returns a map of code -> { file, size }; unresolved codes
 * are simply absent.
 *
 * Most codes never reach here: the generated catalog already holds the file, size and
 * link for the 2,130 codes the template defines, so callers seed from it and only ask
 * the wiki about codes it doesn't cover.
 */
export async function expandRint(
  codes: string[],
  opts: { apiBase?: string } = {},
): Promise<Record<string, RintEntry>> {
  const api = opts.apiBase ?? DEFAULT_API;
  return expandCached(codes, cache, async (code) =>
    // No `link=no`: rint emits `[[File:X|Npx|link=Article|alt=Alt]]`, and we
    // want the link/alt so the logo renders as a link with a tooltip, like wiki.
    parseRintExpansion(await expandTemplate(api, `{{rint|${code}}}`)),
  );
}

/**
 * Build a `resolveLogo(icon)` for RouteMap. `{ file }` icons resolve directly (no
 * rint size); rint-code icons look up `rint` (from expandRint) and carry rint's
 * own size. An unresolved code yields `{ url: "" }` so the renderer omits it.
 */
export function createLogoResolver(
  rint: Record<string, RintEntry> = {},
): (icon: LabelIcon) => ResolvedLogo {
  return (icon) => {
    const file = iconFile(icon);
    if (file) return { url: logoUrl(file) };
    const code = rintCode(icon);
    const entry = code ? rint[code] : undefined;
    return entry
      ? { url: logoUrl(entry.file), size: entry.size, link: entry.link, alt: entry.alt }
      : { url: "" };
  };
}

/* ------------------------------------------------------------------ */
/* {{rws}} station links (wiki-side; resolved like rint)               */
/* ------------------------------------------------------------------ */

/** A resolved {{rws}} station link: the article target + the display text. */
export interface RwsEntry {
  target: string;
  display: string;
}

const rwsCache = new Map<string, Promise<RwsEntry | null>>();

/**
 * Resolve {{rws|args}} station links via the API. rws builds both the article
 * name (parentheses, disambiguators) and the display text non-trivially, so we
 * expand it and parse the resulting `[[target|display]]`. Returns args -> entry.
 *
 * Unlike rint logos these can't be pre-baked: the args name any station on any
 * network, so there is no finite set to generate a catalog from.
 */
export async function expandRws(
  argsList: string[],
  opts: { apiBase?: string } = {},
): Promise<Record<string, RwsEntry>> {
  const api = opts.apiBase ?? DEFAULT_API;
  return expandCached(argsList, rwsCache, async (args) => {
    const text = await expandTemplate(api, `{{rws|${args}}}`);
    const m = text.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/); // [[target|display]]
    const target = m?.[1]?.trim();
    return target ? { target, display: (m?.[2] ?? target).trim() } : null;
  });
}

/** Build a `resolveRws(args)` for RouteMap from an expandRws result map. */
export function createRwsResolver(
  rws: Record<string, RwsEntry> = {},
): (args: string) => RwsEntry | undefined {
  return (args) => rws[args];
}

/** Every distinct {{rws}} args string used by a diagram's labels (for expandRws). */
export function collectRwsArgs(diagram: RouteDiagram): string[] {
  const seen = new Set<string>();
  const scan = (side: unknown) => {
    const norm = normalizeSide(side as never);
    if (Array.isArray(norm?.text)) {
      for (const run of norm.text) if (typeof run !== "string" && run.rws) seen.add(run.rws);
    }
  };
  for (const row of diagram.rows) {
    if ("cells" in row) {
      scan(row.left);
      scan(row.right);
    } else {
      scan({ text: row.text, rws: row.rws, icons: row.icons });
    }
  }
  return [...seen];
}

/** Every distinct rint code used by a diagram's labels (for expandRint). */
export function collectRintCodes(diagram: RouteDiagram): string[] {
  const seen = new Set<string>();
  const add = (icons: LabelIcon[] | undefined) => {
    for (const ic of icons ?? []) {
      const code = rintCode(ic);
      if (code) seen.add(code);
    }
  };
  const scan = (side: unknown) => {
    const norm = normalizeSide(side as never);
    add(norm?.icons); // whole-label logos
    if (Array.isArray(norm?.text)) {
      for (const line of norm.text) if (typeof line !== "string") add(line.icons); // per-line logos
    }
  };
  for (const row of diagram.rows) {
    if ("cells" in row) {
      scan(row.left);
      scan(row.right);
    } else {
      scan({ text: row.text, icons: row.icons }); // colspan row logos
    }
  }
  return [...seen];
}
