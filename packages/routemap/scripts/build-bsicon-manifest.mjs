#!/usr/bin/env node
/**
 * Generate `src/bsicon-manifest.data.ts` — which BSicon codes actually have a file.
 *
 * The icon form offers a field for anything the MODEL can represent, and the model is
 * generous: `previewOptions({kind:"track"}, "curve")` produces `kSTR` and `kkSTR`. Neither
 * file exists. Measured across the 2,638 modellable cells in the real-diagram fixture,
 * filtering to fields with at least one option that resolves to a real file takes 15.6
 * offered fields per icon down to 8.6, and 51% of the options inside the surviving fields
 * are dead too. Half the form edits nothing.
 *
 * Existence can't be asked per render — that's an API call per option per keystroke, the
 * trap the {{rint}} catalog exists to avoid. So it's baked.
 *
 * Two passes, because they have very different costs:
 *
 *   1. CRAWL Commons for every `BSicon *.svg`. `list=allimages` with a title prefix rather
 *      than a category: `Category:BSicon` holds 13 files, and the icons are spread over
 *      hundreds of descriptive subcategories with no root that enumerates them. The
 *      `BSicon ` filename prefix is the actual convention. There are ~372,000, which takes
 *      ~740 requests and ~12 minutes — so the raw list is written out and `--from` can
 *      reuse it, because everything after this point is worth iterating on.
 *
 *   2. REDUCE to a Bloom filter over the codes our ENCODER can emit. Both halves matter:
 *      - The form only ever asks `bloomHas(iconToCode(...))`, so a code the encoder cannot
 *        produce can never be asked about. That's 172,005 of 371,890 — a 54% cut for free.
 *      - Membership is the only question, never "list them", so bits suffice: 268 KB of
 *        filter against 2.5 MB of source and ~10–15 MB of heap for the strings.
 *      A Bloom filter cannot have false negatives, so it can never hide an icon that
 *      really exists; it can only keep a dead one, which is the status quo.
 *
 *      The default 1% false-positive rate is measured, not taste. A dead field survives if
 *      ANY of its options false-positives, so the rate is amplified per field: 5% cost 5
 *      points of field hiding (9.4 fields per icon against 8.6) to save 71 KB.
 *
 * Imports the real `codeToIcon`/`iconToCode`/`bloom` from src (hence
 * `--experimental-strip-types`) so the filter cannot be built against a different
 * encoder or a different hash than the browser queries it with.
 *
 * Usage:
 *   node --experimental-strip-types scripts/build-bsicon-manifest.mjs [--from raw.txt]
 *                                   [--out src/bsicon-manifest.data.ts] [--fpr 0.01]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// `src/` imports are extensionless (written for a bundler), so teach Node to resolve them
// before pulling any of it in. Static imports hoist above this call, hence the dynamic
// ones below — importing the REAL encoder is the point, so it can't be worked around by
// copying the logic in here.
register("./ts-resolve.mjs", import.meta.url);
const { codeToIcon } = await import("../src/parse.ts");
const { iconToCode } = await import("../src/icon.ts");
const { bloomBuild, bloomHas, bloomSize, bloomToBase64 } = await import("../src/bloom.ts");

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia requires a descriptive User-Agent; anonymous bulk fetches get served an
// error page instead of content.
const UA = "routemap-catalog-builder/1.0 (github.com/anthropics/routemap; dev tooling)";
const PAGE = 500; // the `allimages` ceiling for an unauthenticated client
const PAUSE_MS = 600; // be polite between calls
const RETRIES = 6; // 429s are routine on a full run, not exceptional

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await sleep(2000 * 2 ** attempt); // a 429 means slow down, not stop
  }
  throw new Error(`giving up on ${url}`);
}

/** `BSicon_STR_red.svg` -> `STR red`; anything else -> null. */
const codeOf = (name) => {
  const m = /^BSicon_(.+)\.svg$/.exec(name);
  return m ? m[1].replaceAll("_", " ") : null;
};

/** Pass 1: every BSicon code on Commons. */
async function crawl() {
  const codes = new Set();
  let aicontinue, pages = 0, skipped = 0;
  do {
    const data = await get({
      action: "query", list: "allimages", aiprefix: "BSicon",
      ailimit: String(PAGE), aiprop: "", ...(aicontinue ? { aicontinue } : {}),
    });
    for (const file of data.query.allimages) {
      const code = codeOf(file.name);
      if (code) codes.add(code);
      else skipped++;
    }
    aicontinue = data.continue?.aicontinue;
    if (++pages % 20 === 0) console.log(`  ${pages} pages, ${codes.size} codes…`);
    if (aicontinue) await sleep(PAUSE_MS);
  } while (aicontinue);
  console.log(`crawled ${codes.size} codes in ${pages} pages (${skipped} non-SVG skipped)`);
  return [...codes].sort();
}

/**
 * Whether our encoder can produce this exact code.
 *
 * Needs BOTH halves. `codeToIcon` falls back to a `{ code }` passthrough for anything it
 * can't model, and `iconToCode` hands that straight back — so a round-trip check alone
 * passes for every string in existence. The `kind` test is what makes it mean something.
 */
function reachable(code) {
  try {
    const icon = codeToIcon(code);
    return "kind" in icon && iconToCode(icon) === code;
  } catch {
    return false;
  }
}

async function main() {
  const out = resolve(here, "..", arg("out", "src/bsicon-manifest.data.ts"));
  const rawPath = resolve(here, "..", arg("from", "") || ".cache/bsicon-codes.txt");
  const fpr = Number(arg("fpr", "0.01"));

  let all;
  if (arg("from", null)) {
    all = readFileSync(rawPath, "utf8").split("\n").filter(Boolean);
    console.log(`reusing ${all.length} codes from ${rawPath}`);
  } else {
    all = await crawl();
    mkdirSync(dirname(rawPath), { recursive: true });
    // 5.6 MB, and gitignored: it's an input to the reduce pass, not an artefact. Keeping it
    // means the 12-minute crawl is paid once while the filter is still being tuned.
    writeFileSync(rawPath, all.join("\n"));
    console.log(`raw list -> ${rawPath} (pass --from to reuse it)`);
  }

  const keys = all.filter(reachable);
  const { m, k } = bloomSize(keys.length, fpr);
  const filter = bloomBuild(keys, m, k);

  // Verify before writing. A filter cannot have false negatives, so any miss here means
  // the build and the query disagree — the one failure mode that would otherwise ship
  // silently and answer confidently wrong.
  const missing = keys.filter((code) => !bloomHas(filter, code));
  if (missing.length) throw new Error(`${missing.length} false negatives, e.g. ${missing.slice(0, 5)}`);

  // Measure the ACTUAL false-positive rate against codes known to be absent, rather than
  // trusting the target. Absent = encoder-emittable but not on Commons.
  const present = new Set(keys);
  const absent = [];
  for (const code of all) {
    // Perturb a real code into one the encoder could emit but Commons doesn't have.
    const candidate = `${code}ZZ`;
    if (!present.has(candidate) && reachable(candidate)) absent.push(candidate);
    if (absent.length >= 20000) break;
  }
  const measured = absent.length
    ? absent.filter((code) => bloomHas(filter, code)).length / absent.length
    : NaN;

  const base64 = bloomToBase64(filter);
  writeFileSync(
    out,
    `/**
 * GENERATED by scripts/build-bsicon-manifest.mjs — do not edit.
 *
 * A Bloom filter over the ${keys.length} BSicon codes that both exist on Wikimedia Commons
 * and can be produced by our encoder (of ${all.length} BSicon files in total). No false
 * negatives; ${(fpr * 100).toFixed(0)}% target false-positive rate, ${(measured * 100).toFixed(1)}% measured over ${absent.length} known-absent codes.
 *
 * See bloom.ts for the filter and bsicon-manifest.ts for the lookup.
 */
export const BSICON_BLOOM = ${JSON.stringify(base64)};
export const BSICON_BLOOM_M = ${m};
export const BSICON_BLOOM_K = ${k};
export const BSICON_BLOOM_N = ${keys.length};
`,
  );
  console.log(
    `${keys.length} reachable of ${all.length} -> ${m} bits, k=${k}, ` +
      `${(base64.length / 1024).toFixed(0)} KB base64, measured FPR ${(measured * 100).toFixed(1)}% -> ${out}`,
  );
}

await main();
