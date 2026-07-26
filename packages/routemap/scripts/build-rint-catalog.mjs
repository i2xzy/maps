#!/usr/bin/env node
/**
 * Generate `src/rint-catalog.ts` — the browsable list of {{rint}} logo codes.
 *
 * `rint.ts` resolves a single code on demand and stays the source of truth. But a
 * *picker* has to enumerate, and {{Rail-interchange}} is a 250 KB nested wikitext
 * `#switch`, not a data table. So we do it in two passes:
 *
 *   1. Parse the template's `#switch` to harvest the CODE vocabulary — outer cases
 *      are the first arg (region/mode), each one's nested `#switch` gives the second
 *      (`london` + `underground` -> "london|underground"). One `| a | b =value` case
 *      declares aliases, so it yields one code each.
 *   2. Expand every candidate through the API and keep the ones that really produce
 *      a File. Pass 1 alone would be a guess: plenty of cases render a coloured
 *      {{RouteBox}} or delegate to {{ric}}, and only expansion tells you which of
 *      those lands on an image our renderer can draw.
 *
 * Codes that expand to no file are counted and reported, not emitted — the picker
 * only offers logos that will actually render.
 *
 * A third pass harvests the CATEGORIES. The template's own documentation groups the
 * codes as "Generic" plus a list of countries, each country a `/doc/XX` subpage of
 * `{{rail-interchange item|<code>}}` lines (sometimes with a further subpage per big
 * city). That's the country -> system hierarchy, maintained by the same people as the
 * template, so it's harvested rather than invented.
 *
 * Writes DATA ONLY; the hand-written `src/rint-catalog.ts` owns the type and the
 * lookup helpers, so regenerating never clobbers logic.
 *
 * Usage: node scripts/build-rint-catalog.mjs [--out src/rint-catalog.data.ts]
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// The same parser the renderer uses at runtime, so the catalog can't record a
// different file name than a live lookup would. Needs `--experimental-strip-types`
// (see the `build-rint-catalog` script in package.json); rint-expansion.ts is a
// leaf module precisely so node can load it without resolving package imports.
import { parseRintExpansion } from "../src/rint-expansion.ts";

const API = "https://en.wikipedia.org/w/api.php";
const TEMPLATE = "Template:Rail-interchange";
const COUNTRY_INDEX = "Template:Rail-interchange/doc/countries";
// Wikimedia requires a descriptive User-Agent; anonymous bulk fetches get served
// an error page instead of content (see .context/rdt-spike/FINDINGS.md).
const UA = "routemap-catalog-builder/1.0 (github.com/anthropics/routemap; dev tooling)";
const CHUNK = 40; // codes per expandtemplates call
const PAUSE_MS = 600; // be polite between calls
const RETRIES = 6; // 429s are routine on a full run, not exceptional

const argOut = process.argv.indexOf("--out");
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  argOut > 0 ? process.argv[argOut + 1] : "../src/rint-catalog.data.ts",
);

/* ---------------------------------------------------------------- wikitext -- */

/**
 * Walk wikitext tracking `{{template}}` / `{{{param}}}` / `[[link]]` nesting,
 * calling `onChar(index, depth, char)` outside brackets.
 *
 * Closing braces are matched against the open stack rather than greedily, which
 * is the whole trick: `{{RouteBox|X|#{{rail color|Y|Z}}}}` ends in four braces
 * that are two `}}`, and a greedy reader takes `}}}` + a stray `}` and loses a
 * level for the rest of the file. With `stopAtDepth0`, returns the index just
 * past the construct that started at 0 (else -1); otherwise returns the final
 * depth.
 */
function walk(s, onChar, stopAtDepth0 = false) {
  const stack = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "{") {
      let n = 0;
      while (s[i + n] === "{") n++;
      let rem = n;
      while (rem >= 2) {
        const tok = rem >= 3 ? "{{{" : "{{";
        stack.push(tok);
        rem -= tok.length;
      }
      i += n;
      continue;
    }
    if (c === "}") {
      let n = 0;
      while (s[i + n] === "}") n++;
      let rem = n;
      while (rem >= 2 && stack.length) {
        const top = stack.pop();
        rem -= top === "{{{" && rem >= 3 ? 3 : 2;
        if (stopAtDepth0 && stack.length === 0) return i + (n - rem);
      }
      i += n;
      continue;
    }
    if (c === "[" && s[i + 1] === "[") {
      stack.push("[[");
      i += 2;
      continue;
    }
    if (c === "]" && s[i + 1] === "]") {
      stack.pop();
      i += 2;
      continue;
    }
    onChar?.(i, stack.length, c);
    i++;
  }
  return stopAtDepth0 ? -1 : stack.length;
}

/** Split a `#switch` body on its top-level `|` separators. */
function splitCases(body) {
  const cuts = [];
  walk(body, (i, depth, c) => {
    if (c === "|" && depth === 0) cuts.push(i);
  });
  const parts = [];
  let prev = 0;
  for (const cut of cuts) {
    parts.push(body.slice(prev, cut));
    prev = cut + 1;
  }
  parts.push(body.slice(prev));
  return parts;
}

/** If `text` is a `{{#switch: … }}`, its cases (the selector expression dropped). */
function switchCases(text) {
  const t = text.trim();
  if (!/^\{\{#switch:/i.test(t)) return null;
  const end = walk(t, null, true);
  if (end < 0) return null;
  return splitCases(t.slice(2, end - 2)).slice(1);
}

/**
 * Split `key = value` at the case's own `=`, or null if it has none.
 *
 * Must be the first `=` OUTSIDE brackets: a `#switch` default can be written
 * positionally, as a bare value with no key at all, and those values contain
 * `[[File:…|link=…]]`. Reaching for `indexOf("=")` there splits mid-file-link and
 * mints garbage codes out of the pieces.
 */
function splitCase(caseText) {
  let eq = -1;
  walk(caseText, (i, depth, c) => {
    if (c === "=" && depth === 0 && eq < 0) eq = i;
  });
  return eq < 0 ? null : { key: caseText.slice(0, eq), value: caseText.slice(eq + 1) };
}

/** One case key: lowercased and comment-stripped, or "" for `#default`. */
function caseKey(raw) {
  const key = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .toLowerCase();
  return key.startsWith("#default") ? "" : key;
}

/**
 * A switch body's cases as `{ keys, value }`, aliases resolved.
 *
 * MediaWiki writes aliases as `| a | b = value`, so by the time the body is split
 * on its top-level pipes each alias arrives as its OWN fragment with no `=`, and
 * only the last one is attached to the value. Splitting a fragment's key on `|` is
 * therefore useless — the pipes are already gone — so keyless fragments are held as
 * pending aliases and flushed onto the next fragment that does have a value. A
 * keyless fragment at the very END is different: that's a positional `#default`,
 * which has no key to give anyone, so it's dropped.
 */
function switchEntries(body) {
  const entries = [];
  let pending = [];
  for (const text of body) {
    const split = splitCase(text);
    if (!split) {
      pending.push(caseKey(text)); // an alias for whichever case comes next
      continue;
    }
    const keys = [...pending, caseKey(split.key)].filter(Boolean);
    pending = [];
    if (keys.length) entries.push({ keys, value: split.value });
  }
  return entries;
}

/** Every `{{rint}}` code the template's switch declares, in template order. */
function harvestCodes(wikitext) {
  const codes = [];
  const seen = new Set();
  const push = (code) => {
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  };
  for (const outer of switchEntries(switchCases(wikitext) ?? [])) {
    const inner = switchCases(outer.value);
    // Always try the bare region too, not just when there's no sub-switch: a region
    // whose sub-switch has an image-producing `#default` answers `{{rint|<region>}}`
    // on its own. That's how the most generic logos of all are reached — `bus`,
    // `air`, `tram`, `metro` are all `#default`s under a sub-switch, and skipping
    // them left the catalog missing the codes most likely to be wanted.
    for (const region of outer.keys) push(region);
    if (!inner) continue;
    for (const sub of switchEntries(inner)) {
      for (const region of outer.keys) for (const name of sub.keys) push(`${region}|${name}`);
    }
  }
  return codes;
}

/* ------------------------------------------------------------------- expand -- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to the API, retrying on 429/5xx with exponential backoff. A full run makes
 * ~36 calls and Wikimedia will throttle partway through, so this is the normal
 * path, not error handling: honour `Retry-After` when it's sent.
 */
async function postWithRetry(body) {
  let wait = 2000;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt > RETRIES) throw new Error(`API ${res.status} ${res.statusText}`);
    const after = Number(res.headers.get("retry-after"));
    const delay = Number.isFinite(after) && after > 0 ? after * 1000 : wait;
    process.stderr.write(`\n  ${res.status}; retrying in ${Math.round(delay / 1000)}s…\n`);
    await sleep(delay);
    wait = Math.min(wait * 2, 60_000);
  }
}

/** Expand `{{rint|code}}` for a batch of codes in one API call: code -> wikitext. */
async function expandBatch(codes) {
  // Markers survive expansion, so one request can carry the whole batch.
  const text = codes.map((code, i) => `@@${i}@@{{rint|${code}}}`).join("\n");
  const body = new URLSearchParams({
    action: "expandtemplates",
    format: "json",
    formatversion: "2",
    prop: "wikitext",
    text,
  });
  const json = await postWithRetry(body);
  const out = json?.expandtemplates?.wikitext;
  if (typeof out !== "string") throw new Error("no wikitext in response");
  const parts = out.split(/@@(\d+)@@/).slice(1); // [index, chunk, index, chunk, …]
  const byCode = {};
  for (let i = 0; i < parts.length; i += 2) {
    const code = codes[Number(parts[i])];
    if (code != null) byCode[code] = parts[i + 1] ?? "";
  }
  return byCode;
}

/**
 * Which of these file names actually exist (as a Set of the ones that do).
 *
 * Expanding proves the template produced a File LINK, not that the file is real.
 * Some cases switch on the first CHARACTER of the argument — `belgrade|s` is
 * `{{#switch: {{str left|{{lc:{{{2}}}}}|1}}}}`, a family whose line number
 * interpolates into the name — so expanding the bare case yields a plausible but
 * nonexistent `Bg-voz--sup.svg`. Only asking the wiki catches that, and it catches
 * every other cause of a dead name too.
 *
 * Also collects each file's LICENCE, since the same request can answer both. A public
 * tool has to say where a logo came from and under what terms — 23% of the catalog is
 * CC BY-SA or CC BY, which carries an attribution requirement that public domain and
 * CC0 do not.
 *
 * The existence test is `imagerepository`, NOT `missing`. Practically every one of
 * these files lives on Commons, so en.wikipedia has no local File page and reports
 * `missing: true` for all of them — trusting that flag throws the whole catalog
 * away. A file that resolves anywhere reports `imagerepository: "shared"` (or
 * `"local"`); one that exists nowhere reports `""`.
 *
 * `titles` takes 50 per query, so this is ~20 calls for the whole catalog.
 */
async function fileFacts(files) {
  const facts = new Map();
  const list = [...new Set(files)];
  // 25, not 50: `extmetadata` makes the responses much larger, and Wikimedia starts
  // returning 429 well before this pass finishes as it is.
  const STEP = 25;
  for (let i = 0; i < list.length; i += STEP) {
    const batch = list.slice(i, i + STEP);
    const json = await postWithRetry(
      new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "imageinfo",
        iiprop: "extmetadata",
        titles: batch.map((f) => `File:${f}`).join("|"),
      }),
    );
    // The API answers under the CANONICAL title, and the File namespace capitalises
    // its first letter — ask about "fvallvidrera.svg" and the reply is keyed
    // "Fvallvidrera.svg". Map canonical titles back to what we asked, or every
    // lowercase-initial file name looks nonexistent and gets dropped.
    const asked = new Map(batch.map((f) => [`File:${f}`, f]));
    for (const { from, to } of json?.query?.normalized ?? []) {
      const original = asked.get(from);
      if (original != null) asked.set(to, original);
    }
    for (const page of json?.query?.pages ?? []) {
      if (!page.imagerepository) continue; // exists nowhere — dropped by the caller
      const md = page?.imageinfo?.[0]?.extmetadata ?? {};
      // `LicenseShortName` arrives with markup in it often enough to strip.
      const licence = (md.LicenseShortName?.value ?? "").replace(/<[^>]*>/g, "").trim();
      facts.set(asked.get(page.title) ?? page.title.replace(/^File:/, ""), {
        licence: licence || "Unknown",
      });
    }
    process.stderr.write(`  verified ${Math.min(i + STEP, list.length)}/${list.length}\r`);
    if (i + STEP < list.length) await sleep(PAUSE_MS);
  }
  return facts;
}

/* ------------------------------------------------------------------ countries -- */

/** Raw wikitext for a batch of page titles, as a Map (missing pages absent). */
async function fetchWikitext(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const json = await postWithRetry(
      new URLSearchParams({
        action: "query",
        prop: "revisions",
        rvslots: "main",
        rvprop: "content",
        format: "json",
        formatversion: "2",
        titles: titles.slice(i, i + 40).join("|"),
      }),
    );
    for (const page of json?.query?.pages ?? []) {
      const text = page?.revisions?.[0]?.slots?.main?.content;
      if (typeof text === "string") out.set(page.title, text);
    }
    if (i + 40 < titles.length) await sleep(PAUSE_MS);
  }
  return out;
}

/**
 * region arg -> country name, from the template's own documentation.
 *
 * `/doc/countries` lists one `/doc/XX` subpage per country; each lists its systems as
 * `{{rail-interchange item|<args>}}`, and a few delegate a big city to a further
 * subpage (`/doc/UK/london`). Only the FIRST arg matters here — that's the region the
 * catalog's codes are keyed by; later args are line names or aliases.
 */
async function harvestRegionCountries() {
  const index = (await fetchWikitext([COUNTRY_INDEX])).get(COUNTRY_INDEX);
  if (!index) throw new Error(`could not read ${COUNTRY_INDEX}`);
  const countries = [...index.matchAll(/\[\[(Template:Rail-interchange\/doc\/[^|\]]+)\|([^\]]+)\]\]/g)].map(
    (m) => ({ title: m[1], name: m[2].trim() }),
  );

  // Follow the nested city subpages, keeping each page attributed to its country.
  const owner = new Map(countries.map((c) => [c.title, c.name]));
  const seen = new Set();
  let frontier = countries.map((c) => c.title);
  const regionCountry = {};
  while (frontier.length) {
    const pages = await fetchWikitext(frontier.filter((t) => !seen.has(t)));
    frontier.forEach((t) => seen.add(t));
    const next = [];
    for (const [title, text] of pages) {
      const country = owner.get(title);
      if (!country) continue;
      for (const m of text.matchAll(/\{\{\s*rail-interchange item\s*\|([^}]*)\}\}/gi)) {
        const first = m[1].split("|")[0]?.trim().toLowerCase();
        // First definition wins: a system listed under two countries (cross-border
        // operators) belongs to whichever the docs name first.
        if (first && !(first in regionCountry)) regionCountry[first] = country;
      }
      for (const m of text.matchAll(/\{\{\s*(Rail-interchange\/doc\/[A-Za-z0-9/_-]+)\s*\}\}/g)) {
        const child = `Template:${m[1]}`;
        if (!seen.has(child)) {
          owner.set(child, country);
          next.push(child);
        }
      }
    }
    frontier = next;
  }
  return { regionCountry, countries: countries.length };
}


/* --------------------------------------------------------------------- main -- */

async function main() {
  process.stderr.write(`Fetching ${TEMPLATE}…\n`);
  const url =
    `${API}?action=query&prop=revisions&rvslots=main&rvprop=content` +
    `&formatversion=2&format=json&titles=${encodeURIComponent(TEMPLATE)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await res.json();
  const wikitext = json?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
  if (typeof wikitext !== "string") throw new Error(`could not read ${TEMPLATE}`);
  process.stderr.write(`  ${wikitext.length} bytes\n`);

  const codes = harvestCodes(wikitext);
  process.stderr.write(`Harvested ${codes.length} candidate codes.\n`);

  // `--dry-run` prints the harvested vocabulary and stops, so a change to the
  // wikitext parser can be diffed against the committed catalog for free — the
  // expansion pass is ~36 throttled API calls and several minutes.
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(codes.join("\n") + "\n");
    return;
  }
  process.stderr.write(`Expanding…\n`);

  const entries = [];
  let noImage = 0;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const batch = codes.slice(i, i + CHUNK);
    const expanded = await expandBatch(batch);
    for (const code of batch) {
      const parsed = parseRintExpansion(expanded[code] ?? "");
      if (parsed) entries.push({ code, ...parsed });
      else noImage++;
    }
    process.stderr.write(`  ${Math.min(i + CHUNK, codes.length)}/${codes.length}\r`);
    if (i + CHUNK < codes.length) await sleep(PAUSE_MS);
  }
  process.stderr.write(
    `\n${entries.length} codes expand to a File; ${noImage} produce no image ` +
      `(coloured {{RouteBox}} / text / intentionally blank) and are omitted.\n` +
      `Verifying those files exist…\n`,
  );

  const facts = await fileFacts(entries.map((e) => e.file));
  const dead = entries.filter((e) => !facts.has(e.file));
  const kept = entries
    .filter((e) => facts.has(e.file))
    .map((e) => ({ ...e, licence: facts.get(e.file).licence }));
  process.stderr.write(
    `\n${kept.length} kept; ${dead.length} dropped for a nonexistent file` +
      (dead.length ? `: ${dead.map((e) => `${e.code} -> ${e.file}`).join(", ")}` : "") +
      `.\n`,
  );

  process.stderr.write(`Harvesting categories from the template's documentation…\n`);
  const { regionCountry, countries } = await harvestRegionCountries();
  const used = new Set(kept.map((e) => e.code.split("|")[0]));
  // Only ship the regions this catalog actually uses; the docs also list systems
  // whose codes render no image and never reach the picker.
  const relevant = Object.keys(regionCountry)
    .filter((r) => used.has(r))
    .sort();
  const unmapped = [...used].filter((r) => !(r in regionCountry)).sort();
  process.stderr.write(
    `  ${countries} countries; ${relevant.length}/${used.size} regions categorised` +
      (unmapped.length ? `; undocumented: ${unmapped.join(", ")}` : "") +
      `.\n`,
  );

  const rows = kept.map((e) => {
    const fields = [`code: ${JSON.stringify(e.code)}`, `file: ${JSON.stringify(e.file)}`];
    if (e.link) fields.push(`link: ${JSON.stringify(e.link)}`);
    if (e.size) fields.push(`size: ${e.size}`);
    if (e.licence) fields.push(`licence: ${JSON.stringify(e.licence)}`);
    return `  { ${fields.join(", ")} },`;
  });
  const countryRows = relevant.map((r) => `  ${JSON.stringify(r)}: ${JSON.stringify(regionCountry[r])},`);

  writeFileSync(
    OUT,
    `/**
 * {{rint}} logo codes — GENERATED by scripts/build-rint-catalog.mjs. Do not edit.
 *
 * Data only: the type and the lookup helpers live in ./rint-catalog, which is
 * also the module consumers should import.
 *
 * Each entry expanded to a File against the live template when generated, and that
 * file was confirmed to exist. Codes that render a coloured {{RouteBox}} rather
 * than an image are omitted, because our renderer can only draw images.
 *
 * Generated ${new Date().toISOString().slice(0, 10)} · ${kept.length} codes, ${relevant.length} regions categorised.
 */
import type { RintCatalogEntry } from "./rint-catalog";

export const RINT_CATALOG: RintCatalogEntry[] = [
${rows.join("\n")}
];

/**
 * Region arg -> country, from the template's own documentation (\`/doc/countries\`
 * and its per-country subpages), which is where the maintainers keep the country ->
 * system grouping. Regions the docs don't mention are absent; ./rint-catalog fills
 * those in by hand.
 */
export const RINT_REGION_COUNTRY: Record<string, string> = {
${countryRows.join("\n")}
};
`,
  );
  process.stderr.write(`Wrote ${OUT}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});
