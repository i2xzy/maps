#!/usr/bin/env node
/**
 * Harvest real `{{Routemap}}` diagrams from Wikipedia into a test fixture.
 *
 * Every fidelity number this package reports is measured against these, so what's in here
 * decides what "100% round-trip" means. The first corpus was 21 diagrams and heavily one
 * region's — a statement about those diagrams, not about Wikipedia. This samples ACROSS the
 * transclusion list rather than taking the first N, because the first N of anything alphabetical
 * are one country's rail network and share its conventions.
 *
 * Two traps, both of which have bitten:
 *
 *   1. **Stop at the end of the `{{Routemap}}` call, not the end of the page.** An earlier
 *      extractor ran on and counted 119 lines of `|map2 =`, `}}<noinclude>` and
 *      `{{documentation}}` as diagram rows. They round-tripped trivially and flattered every
 *      ratio. Brace matching, not a regex.
 *   2. **`map=` is one parameter among several.** `title=`, `map2=`, `collapsible=` and friends
 *      are not rows. Only the `map`-family parameters' bodies are.
 *
 * Usage:
 *   node scripts/build-diagram-corpus.mjs [--count 120] [--out src/__fixtures__/wide-corpus.json]
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const API = "https://en.wikipedia.org/w/api.php";
const UA = "routemap-corpus-builder/1.0 (github.com/anthropics/routemap; dev tooling)";
const PAUSE_MS = 600;
const RETRIES = 6;
const BATCH = 50; // the `titles` ceiling

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
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error(`giving up on ${url}`);
}

/** Every page that transcludes Template:Routemap. */
async function transclusions() {
  const titles = [];
  let cont;
  do {
    const data = await get({
      action: "query",
      list: "embeddedin",
      eititle: "Template:Routemap",
      eilimit: "500",
      einamespace: "0|10", // articles and templates; diagrams live in both
      ...(cont ? { eicontinue: cont } : {}),
    });
    titles.push(...data.query.embeddedin.map((p) => p.title));
    cont = data.continue?.eicontinue;
    if (cont) await sleep(PAUSE_MS);
  } while (cont);
  return titles;
}

/**
 * The `map`-parameter bodies of every `{{Routemap}}` call on a page.
 *
 * Brace-matched so it stops where the call does. A nested `{{rint|…}}` or `{{BSsplit|…}}` inside
 * a row must not end it, which is why depth is counted rather than searching for `}}`.
 */
function extractMaps(wikitext) {
  const out = [];
  const lower = wikitext.toLowerCase();
  let from = 0;
  for (;;) {
    const start = lower.indexOf("{{routemap", from);
    if (start < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < wikitext.length; i++) {
      if (wikitext.startsWith("{{", i)) {
        depth++;
        i++;
      } else if (wikitext.startsWith("}}", i)) {
        depth--;
        i++;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) break; // unbalanced; skip the rest of the page
    const call = wikitext.slice(start, end);
    from = end;

    // Split the call's top-level parameters, then keep the map-family ones.
    let depth2 = 0;
    let current = "";
    const params = [];
    for (let i = 2; i < call.length - 2; i++) {
      if (call.startsWith("{{", i) || call.startsWith("[[", i)) {
        depth2++;
        current += call.slice(i, i + 2);
        i++;
        continue;
      }
      if (call.startsWith("}}", i) || call.startsWith("]]", i)) {
        depth2--;
        current += call.slice(i, i + 2);
        i++;
        continue;
      }
      if (call[i] === "|" && depth2 === 0) {
        params.push(current);
        current = "";
        continue;
      }
      current += call[i];
    }
    params.push(current);
    for (const p of params) {
      const eq = p.indexOf("=");
      if (eq < 0) continue;
      const name = p.slice(0, eq).trim().toLowerCase();
      if (!/^map\d*$/.test(name)) continue; // `title=`, `collapsible=` etc. are not rows
      const body = p.slice(eq + 1).replace(/^\n/, "").replace(/\n\s*$/, "");
      if (body.trim()) out.push(body);
    }
  }
  return out;
}

async function main() {
  const want = Number(arg("count", "120"));
  const out = resolve(here, "..", arg("out", "src/__fixtures__/wide-corpus.json"));

  console.log("listing transclusions of Template:Routemap…");
  const all = await transclusions();
  console.log(`  ${all.length} pages transclude it`);

  // Sample evenly across the list rather than taking a prefix: the first N alphabetically are
  // one network's templates and share its conventions, which is how a corpus ends up
  // measuring itself.
  const step = Math.max(1, Math.floor(all.length / want));
  const picked = all.filter((_, i) => i % step === 0).slice(0, want);
  console.log(`  sampling every ${step} -> ${picked.length} pages`);

  const corpus = {};
  let rows = 0;
  for (let i = 0; i < picked.length; i += BATCH) {
    const chunk = picked.slice(i, i + BATCH);
    const data = await get({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });
    for (const page of data.query.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!text) continue;
      const maps = extractMaps(text);
      maps.forEach((body, n) => {
        const key = maps.length > 1 ? `${page.title} #${n + 1}` : page.title;
        corpus[key] = body;
        rows += body.split("\n").filter((l) => l.trim()).length;
      });
    }
    console.log(`  fetched ${Math.min(i + BATCH, picked.length)}/${picked.length}…`);
    if (i + BATCH < picked.length) await sleep(PAUSE_MS);
  }

  writeFileSync(out, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`${Object.keys(corpus).length} diagrams, ${rows} rows -> ${out}`);
}

await main();
