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
import type { LabelIcon, RouteDiagram, TextRun } from "./types";
import { SLOT_NAMES } from "./normalize";
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

/**
 * args -> entry, kept so a repeat lookup hands back the SAME object.
 *
 * Referential stability is load-bearing: the editor's `useExpanded` diffs the resolved map by
 * identity to decide whether to re-render, so minting a fresh entry each call would report a
 * change on every pass. The promise cache this replaced gave that for free.
 */
const rwsEntries = new Map<string, RwsEntry>();

/**
 * Resolve {{rws|args}} station links. rws builds both the article name (parentheses,
 * disambiguators) and the display text non-trivially, so we expand it and parse the resulting
 * `[[target|display]]`. Returns args -> entry.
 *
 * Unlike rint logos these can't be pre-baked: the args name any station on any network, so
 * there is no finite set to generate a catalog from.
 *
 * BATCHED, sharing the request the station-link templates already use. It was one request per
 * station: 309 across the 21-diagram corpus and **66 for a single diagram**, which is worse
 * than the 10-to-2 saving the {{rint}} catalog exists to provide. That diagram now costs 2.
 */
export async function expandRws(
  argsList: string[],
  opts: { apiBase?: string } = {},
): Promise<Record<string, RwsEntry>> {
  const wanted = [...new Set(argsList)];
  const texts = await expandTextTemplates(
    wanted.filter((a) => !rwsEntries.has(a)).map((a) => `rws|${a}`),
    opts,
  );
  const out: Record<string, RwsEntry> = {};
  for (const args of wanted) {
    let entry = rwsEntries.get(args);
    if (!entry) {
      const m = texts[`rws|${args}`]?.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/); // [[target|display]]
      const target = m?.[1]?.trim();
      if (!target) continue; // unresolved is simply absent, and stays retryable
      entry = { target, display: (m?.[2] ?? target).trim() };
      rwsEntries.set(args, entry);
    }
    out[args] = entry;
  }
  return out;
}

/** Build a `resolveRws(args)` for RouteMap from an expandRws result map. */
export function createRwsResolver(
  rws: Record<string, RwsEntry> = {},
): (args: string) => RwsEntry | undefined {
  return (args) => rws[args];
}

/** A run that carries fields — the walker skips bare strings, so `in` is always valid. */
type ObjectRun = Exclude<TextRun, string>;

/**
 * Every run in a side, whatever shape the side takes.
 *
 * The three collectors below all need this and all used to get it slightly wrong.
 * `normalizeSide` accepts a `SideLabel`, so a SLOTS-based side (`{ dist, main, remark,
 * outer }`) came back null and only `main` was ever scanned — a {{rint}} logo or {{rws}}
 * station link in a `remark` or `dist` slot was never fetched, so it rendered as nothing
 * at all. Silently. `labelRuns` additionally drops `{ raw }` runs on purpose, which the
 * station-link collector needs.
 *
 * Descends into `{{BSsplit}}` lines, because a logo or link nested in one still has to
 * resolve, and keeps `normalizeSide`'s rule that a whole-label `rws` with no text is sugar
 * for a single station run.
 */
function eachRun(side: unknown, visit: (run: ObjectRun) => void): void {
  if (side == null || typeof side !== "object") return;
  const walk = (runs: unknown): void => {
    if (!Array.isArray(runs)) return;
    for (const run of runs) {
      if (run == null || typeof run !== "object") continue;
      visit(run as ObjectRun);
      if ("split" in run && Array.isArray(run.split)) for (const line of run.split) walk(line);
    }
  };
  if (Array.isArray(side)) return walk(side);
  const obj = side as Record<string, unknown>;
  if (SLOT_NAMES.some((name) => name in obj)) {
    for (const name of SLOT_NAMES) eachRun(obj[name], visit);
    return;
  }
  const text = obj.text;
  const empty = text == null || text === "" || (Array.isArray(text) && text.length === 0);
  if (empty && typeof obj.rws === "string") return visit({ rws: obj.rws } as ObjectRun);
  walk(text);
}

/** Run `visit` over every run in every label of a diagram. */
function eachLabelRun(diagram: RouteDiagram, visit: (run: ObjectRun) => void): void {
  for (const row of diagram.rows) {
    if ("cells" in row) {
      eachRun(row.left, visit);
      eachRun(row.right, visit);
    } else {
      eachRun({ text: row.text, rws: row.rws }, visit);
    }
  }
}

/** Every distinct {{rws}} args string used by a diagram's labels (for expandRws). */
export function collectRwsArgs(diagram: RouteDiagram): string[] {
  const seen = new Set<string>();
  eachLabelRun(diagram, (run) => {
    if ("rws" in run && run.rws) seen.add(run.rws);
  });
  return [...seen];
}

/** Every distinct rint code used by a diagram's labels (for expandRint). */
export function collectRintCodes(diagram: RouteDiagram): string[] {
  const seen = new Set<string>();
  eachLabelRun(diagram, (run) => {
    if ("icon" in run) {
      const code = rintCode(run.icon);
      if (code) seen.add(code);
    }
  });
  return [...seen];
}

/* ------------------------------------------------------------------ */
/* Text-producing templates in labels ({{tram}}, {{stnlnk}}, …)        */
/* ------------------------------------------------------------------ */

/**
 * Templates worth expanding, because they resolve to label TEXT we can already parse.
 *
 * Measured over the 21-diagram fixture: 205 of 915 rows (22%) render a muted `{ raw }`
 * placeholder, 260 in total across 30 distinct constructs. They fall into three families,
 * and only one of them is worth expanding:
 *
 *   - STATION LINKS — `{{tram}}` 45, `{{stl}}` 34, `{{stnlnk}}` 32, `{{stn}}` 2 = 113,
 *     **43% of all placeholders**. Each becomes a plain wikilink:
 *     `{{tram|Derker}}` -> `[[Derker tram stop|Derker]]`,
 *     `{{stl|Sofia Metro|Mladost 1}}` -> `[[Mladost 1 Metro Station|Mladost 1]]`.
 *     `{{BSsrws}}` (9) LOOKS like one of these and is not: it expands to a `<table>` with
 *     templatestyles, so it belongs to the layout family below. Verified by expanding each
 *     name rather than inferring from what it's called.
 *   - LAYOUT — `{{BSto}}` 38, `{{enlarge}}` 12, `{{left}}` 14, `{{float}}` 6, `{{0}}` 6,
 *     `{{right}}` 4 = ~85, 33%. These expand to HTML we can't render, so expanding them
 *     would trade a readable placeholder for a wall of markup. Left alone deliberately.
 *   - ROUTE ICONS — `{{rmri}}` 22, `{{rcb}}` 13, `{{ric}}` 4 = 39, 15%. Same shape as
 *     `{{rint}}`, so these belong in the generated catalog, not here.
 *
 * Adding a name is a one-line change, but check which family it's in first.
 */
export const TEXT_TEMPLATES = new Set([
  "tram",
  "stl",
  "stnlnk",
  "stn",
  // Found by widening the corpus from 21 diagrams to 68 sampled across all 28,012 pages that
  // transclude {{Routemap}}. Each verified by expanding it: they all produce a bare wikilink,
  // the same shape as `stnlnk`. Together they were 75 of the 195 unresolved placeholders.
  "njts", // [[Newark station|Newark]]
  "lrts", // [[Ampang LRT station|Ampang]]
  "bmts", // [[Sirsi Circle BTS station|Sirsi Circle]]
  "mrts", // [[Woodlands MRT station|Woodlands]]
  "sta", // [[Shinjuku railway station|Shinjuku]]
]);

/**
 * Templates that expand to a FILE link rather than label text.
 *
 * `{{rmri|u}}` -> `[[File:Arrow Blue Up 001.svg|10px|alt=Up arrow|link=]]` and
 * `{{ric|Kolkata Metro|orange}}` -> `[[File:Kolkata Metro Orange Line.svg|16px|link=…]]` —
 * the same shape `{{rint}}` produces, so `parseRintExpansion` already reads them and they
 * render through the existing logo path. 26 of the fixture's placeholders, 10%.
 *
 * `{{enlarge}}` (12) is here for the opposite reason to {{BSsrws}}: it reads like a text
 * wrapper — `{{enlarge|Foo}}` — and is actually the magnifier glyph,
 * `[[File:Gnome-searchtool.svg|10px|link=…]]`, with its argument as the link target.
 *
 * `{{rcb}}` (13) belongs to neither family despite sitting alongside these in real
 * diagrams: it expands to a `<span>` carrying inline styles, not a file. Checked by
 * expanding it, which is the only way to know — see the {{BSsrws}} note above.
 */
export const ICON_TEMPLATES = new Set([
  "rmri",
  "ric",
  "enlarge",
  // `{{BSflag|GBR}}` -> `[[File:GBR flag waving.svg|10px|link=request stop]]`. Verified, like the
  // rest: a flag is a file, whatever its name suggests.
  "bsflag",
]);

/**
 * Templates that expand to a coloured route BADGE — a pill wrapping a link.
 *
 * `{{rcb|Sofia Metro|M2|croute}}` becomes
 * `<span style="…background-color:#1C75BB;border-radius:.5em…">[[Sofia Metro#M2 line|<span
 * style="color:white;font-weight:bold">2</span>]]</span>`.
 *
 * The only family whose expansion is markup we deliberately accept, and only because we don't
 * render that markup — two named fields are extracted from a shape that was checked against
 * the live template. Everything else still fails the markup guard, which is what makes a
 * misfiled name safe.
 */
export const BADGE_TEMPLATES = new Set(["rcb"]);

/**
 * Templates that expand to an `.RMsplit` table — the same construct as `{{BSsplit}}`.
 *
 * `{{BSsrws|Ewood Bridge|and Edenfield}}` stacks a station name over two lines, BOTH linking
 * to the article its args resolve to. Unlike `{{BSto}}` this can't be built from the args: the
 * article is derived the way `{{rws}}` derives one (`… railway station`, disambiguators and
 * all), so only the expansion knows the target.
 *
 * This was filed as "genuine layout, keep the placeholder" on the strength of it expanding to
 * a `<table>`. It expands to a table because a split IS a table — the same mistake as reading
 * `{{enlarge}}` as a text wrapper, in the opposite direction.
 */
export const SPLIT_TABLE_TEMPLATES = new Set(["bssrws"]);

/**
 * The expandable call inside a `{ raw }` run, or null if it isn't one.
 *
 * `{{tram|Derker}}` -> `tram|Derker`, ready to be re-wrapped for the API.
 */
function templateCall(raw: string, names: Set<string>): string | null {
  const text = raw.trim();
  if (!text.startsWith("{{") || !text.endsWith("}}")) return null;
  const name = /^\{\{\s*([^|}]+)/.exec(text)?.[1]?.trim().toLowerCase();
  return name && names.has(name) ? text.slice(2, -2).trim() : null;
}

/** The call inside a `{ raw }` run if it's a text-producing template, else null. */
export const textTemplateCall = (raw: string): string | null => templateCall(raw, TEXT_TEMPLATES);

/** The call inside a `{ raw }` run if it's a file-producing template, else null. */
export const iconTemplateCall = (raw: string): string | null => templateCall(raw, ICON_TEMPLATES);

/** The call inside a `{ raw }` run if it's a route-badge template, else null. */
export const badgeTemplateCall = (raw: string): string | null => templateCall(raw, BADGE_TEMPLATES);

/** The call inside a `{ raw }` run if it expands to an `.RMsplit` table, else null. */
export const splitTableCall = (raw: string): string | null =>
  templateCall(raw, SPLIT_TABLE_TEMPLATES);

/**
 * Any family, seeing through wiki marks wrapped round the whole run.
 *
 * This is what the COLLECTOR asks, and it has to unwrap: a run like `'''{{stl|X}}'''` is not a
 * bare call, so the call was never fetched and the renderer had nothing to substitute — the
 * label stayed a placeholder however well the render path handled marks.
 *
 * The per-family helpers deliberately do NOT unwrap. The renderer routes a marked run through
 * its own branch so the marks get re-applied to the expansion; if `textTemplateCall` matched
 * through marks, that branch would be skipped and the bold silently lost.
 */
export const expandableCall = (raw: string): string | null => {
  const bare = /^('{2,5})([\s\S]+)\1$/.exec(raw.trim())?.[2]?.trim() ?? raw;
  return (
    textTemplateCall(bare) ?? iconTemplateCall(bare) ?? badgeTemplateCall(bare) ?? splitTableCall(bare)
  );
};

/**
 * A separator that survives `expandtemplates` untouched.
 *
 * Literal text passes through the API unchanged, so this lets many template calls share
 * ONE request. That matters: a diagram with 20 station links would otherwise cost 20
 * round trips per page load, against the 2 the {{rint}} catalog got us down to.
 *
 * No `%`, `#` or `&` in it. Those all survive `encodeURIComponent` correctly, but they make
 * the request unreadable in a network log and invite a double-decode bug in anything that
 * inspects it — which is exactly what happened the first time.
 */
const SEP = "@ROUTEMAP-SPLIT@";
const BATCH = 50; // calls per request

/** call -> expanded wikitext. Module-level, so a repeat visit never re-fetches. */
const textCache = new Map<string, string>();
/** call -> the in-flight batch it belongs to, so React's double-invoke doesn't double-fetch. */
const textPending = new Map<string, Promise<void>>();

async function fetchBatch(api: string, calls: string[]): Promise<void> {
  const text = await expandTemplate(api, calls.map((c) => `{{${c}}}`).join(SEP));
  const parts = text.split(SEP);
  // Only trust the split when the arity matches. A failed request returns "", and a
  // template that somehow emitted the separator would shift every label onto the wrong
  // row — silently. Mismatched means unresolved, which stays retryable.
  if (parts.length !== calls.length) return;
  calls.forEach((call, i) => {
    const value = parts[i]?.trim();
    if (!value) return;
    // Only keep expansions that are label TEXT. `{{BSsrws}}` was misfiled here on the
    // strength of its name and expands to a `<table>` — rendering that into a label is
    // worse than the placeholder it replaced, so markup is rejected rather than trusted.
    //
    // A badge template is the exception, and only because we don't render its markup: we
    // extract two named fields from a shape we've checked. The guard stays for everything
    // else precisely so the next misfiled name fails closed.
    const family = call.split("|")[0]!.trim().toLowerCase();
    const expectsMarkup = BADGE_TEMPLATES.has(family) || SPLIT_TABLE_TEMPLATES.has(family);
    if (expectsMarkup || !/[<>]/.test(value)) textCache.set(call, value);
  });
}

/**
 * Expand a set of text-template calls, batched. Returns call -> expanded wikitext.
 *
 * Unresolved calls are simply absent, and the caller keeps showing the placeholder — the
 * same contract as `expandRws`, and for the same reason: a network failure must not be
 * remembered as "no such thing".
 */
export async function expandTextTemplates(
  calls: string[],
  opts: { apiBase?: string } = {},
): Promise<Record<string, string>> {
  const api = opts.apiBase ?? DEFAULT_API;
  const wanted = [...new Set(calls)];
  const missing = wanted.filter((c) => !textCache.has(c) && !textPending.has(c));
  const batches: Promise<void>[] = [];
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const pending = fetchBatch(api, chunk).finally(() => {
      for (const call of chunk) textPending.delete(call);
    });
    for (const call of chunk) textPending.set(call, pending);
    batches.push(pending);
  }
  // Await our own batches AND any already in flight that we're waiting on.
  await Promise.all([...batches, ...wanted.map((c) => textPending.get(c)).filter(Boolean)]);

  const out: Record<string, string> = {};
  for (const call of wanted) {
    const value = textCache.get(call);
    if (value) out[call] = value;
  }
  return out;
}

/** Build a `resolveText(call)` for RouteMap from an expandTextTemplates result map. */
export function createTextResolver(
  texts: Record<string, string> = {},
): (call: string) => string | undefined {
  return (call) => texts[call];
}

/**
 * Every distinct expandable template call in a diagram's labels, both families.
 *
 * One list, because they share one batched request — the renderer decides how to read each
 * expansion, so the fetch doesn't need to care which family a call belongs to.
 */
export function collectTextTemplates(diagram: RouteDiagram): string[] {
  const seen = new Set<string>();
  eachLabelRun(diagram, (run) => {
    if ("raw" in run && run.raw) {
      const call = expandableCall(run.raw);
      if (call) seen.add(call);
    }
  });
  return [...seen];
}
