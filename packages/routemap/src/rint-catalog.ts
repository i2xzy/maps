/**
 * A browsable catalog of {{rint}} transit-logo codes, for editor UIs that need to
 * OFFER a choice of logo. `rint.ts` can only resolve a code you already know —
 * {{Rail-interchange}} is a 250 KB nested wikitext `#switch`, so there's nothing
 * to enumerate at runtime. `scripts/build-rint-catalog.mjs` harvests the code
 * vocabulary from the template and verifies each one expands to a real image.
 *
 * The catalog is for BROWSING, never for rendering: `expandRint` stays the source
 * of truth, so a diagram tracks the live template even when this snapshot is
 * stale. Where an instant thumbnail matters, `rintCatalogSeed` pre-fills a logo
 * resolver from the snapshot — the live API result still wins once it lands.
 *
 * Deliberately NOT in the package barrel: it's ~100 KB of data, and consumers
 * that only render diagrams shouldn't pay for it. Import
 * "@repo/routemap/rint-catalog".
 */
import type { RintEntry } from "./rint";

/** One pickable logo: its {{rint}} code plus what that code expanded to. */
export interface RintCatalogEntry {
  /** The rint code: positional args as {{rint}} takes them, `|`-joined. */
  code: string;
  /** Commons file name the code expands to (no `File:` prefix). */
  file: string;
  /** Article the logo links to — also the most human-readable name for it. */
  link?: string;
  /** Width in px that rint itself emits for this logo. */
  size?: number;
  /**
   * The file's licence, as the wiki states it ("Public domain", "CC BY-SA 4.0", …).
   *
   * These are other people's images, and a tool that shows them publicly has to say
   * so. Roughly a quarter of the catalog is CC BY-SA or CC BY, which obliges credit;
   * public domain and CC0 don't. `rintLicenceNeedsCredit` draws that line.
   */
  licence?: string;
}

/** The file's description page — where its author, licence and terms live. */
export function fileDescriptionUrl(file: string): string {
  return `https://en.wikipedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
}

/**
 * Whether a licence obliges us to credit the author.
 *
 * Public domain, PD-* and CC0 don't; every CC BY / CC BY-SA does, as does a bare
 * "Attribution" tag. Unknown counts as yes — the safe direction when the answer
 * decides whether someone's name gets left off.
 */
export function rintLicenceNeedsCredit(licence: string | undefined): boolean {
  if (licence == null || licence === "") return true;
  return !/^(public domain|pd\b|pd-|cc0)/i.test(licence.trim());
}

export { RINT_CATALOG } from "./rint-catalog.data";
import { RINT_CATALOG, RINT_REGION_COUNTRY } from "./rint-catalog.data";

/**
 * Canonical form of a rint code. The template lowercases each arg through `{{lc:}}`
 * (which also trims), so `"London | Underground"` and `"london|underground"` are
 * the same logo — catalog lookups have to agree with that or a perfectly good code
 * from a hand-written diagram misses.
 */
export function normalizeRintCode(code: string): string {
  return code
    .split("|")
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

let byCode: Map<string, RintCatalogEntry> | null = null;

/** Catalog indexed by normalized code (built once, on first lookup). */
function index(): Map<string, RintCatalogEntry> {
  if (!byCode) {
    byCode = new Map(RINT_CATALOG.map((e) => [normalizeRintCode(e.code), e]));
  }
  return byCode;
}

/** The catalog entry for a rint code, or undefined if it isn't in the snapshot. */
export function findRintCatalogEntry(code: string): RintCatalogEntry | undefined {
  return index().get(normalizeRintCode(code));
}

/** Capitalise each word, treating `_` as a space ("light rail" -> "Light Rail"). */
function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Generic codes whose article title makes a poor name for the symbol. */
const GENERIC_NAMES: Record<string, string> = {
  air: "Air travel",
  no_wheelchair: "No wheelchair access",
  wheelchair: "Wheelchair access",
};

/**
 * A logo's human-readable name.
 *
 * Normally the article it links to, which is how a reader would name the operator
 * or line. Generic mode/facility codes are the exception — their articles are
 * titled for the encyclopedia, not the symbol, so `air` links to "Lists of
 * airports", `tram` to a lowercase "tram", and `wheelchair` and `no_wheelchair`
 * BOTH to "Accessibility" despite meaning opposite things. For those the code is
 * the better name.
 */
export function rintCatalogLabel(entry: RintCatalogEntry): string {
  const override = GENERIC_NAMES[entry.code];
  if (override) return override;
  // Article titles carry disambiguators the picker doesn't need
  // ("Circle line (London Underground)"), and section anchors read as noise.
  const article = entry.link?.split("#")[0]?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // A few generic articles are titled in running prose ("tram", "light rail"), so
  // capitalise — but don't title-case, or "Air base" becomes "Air Base".
  if (article) return article.charAt(0).toUpperCase() + article.slice(1);
  // No article to borrow a name from. The place is the reliable part and the
  // remaining argument is a qualifier, so say both: five cities share one
  // "under construction" road sign, and naming those after the argument alone
  // would print "Uc" five times.
  const [region = entry.code, ...rest] = entry.code.split("|");
  if (!rest.length) return titleCase(region);
  const qualifier = rest.join(" ");
  return `${rintRegionLabel(region)} (${ARG_NAMES[qualifier] ?? qualifier})`;
}

/** Code arguments that are abbreviations rather than words. */
const ARG_NAMES: Record<string, string> = { uc: "under construction" };

/** Everything a text filter should match on: the display name AND the raw code. */
export function rintCatalogSearchText(entry: RintCatalogEntry): string {
  return `${rintCatalogLabel(entry)} ${entry.code.replace(/\|/g, " ")}`;
}

/* ------------------------------------------------------------------ grouping -- */

/**
 * Single-arg codes for a mode of transport or a facility rather than a place —
 * `{{rint|ferry}}`, `{{rint|parking}}`. They group together instead of each
 * becoming a category of one.
 *
 * Only single-arg codes are matched against this: `air` is a generic code AND a
 * region prefix (`air|...`), and the two aren't the same thing.
 */
const GENERIC_CODES = new Set([
  "air",
  "airbase",
  "airfield",
  "bicycle",
  "bike",
  "bus",
  "cable",
  "express",
  "ferry",
  "funicular",
  "heliport",
  "incline",
  "light rail",
  "metro",
  "mono",
  "monorail",
  "no_wheelchair",
  "park",
  "parking",
  "rail",
  "subway",
  "tram",
  "trolley",
  "trolleybus",
  "underground",
  "wheelchair",
]);

/**
 * Region args that don't read properly when simply title-cased — abbreviations and
 * initialisms. Anything absent is title-cased, which already handles the ordinary
 * cases ("bangkok", "kuala lumpur", "cádiz").
 */
const REGION_NAMES: Record<string, string> = {
  airtrainewr: "AirTrain Newark",
  at: "Austria",
  "au-act": "Canberra",
  "au-wa": "Western Australia",
  bc: "British Columbia",
  be: "Belgium",
  bg: "Bulgaria",
  "buenos aires": "Buenos Aires",
  buenosaires: "Buenos Aires",
  by: "Belarus",
  ca: "Canada",
  cadiz: "Cádiz",
  canberra: "Canberra",
  cdmx: "Mexico City",
  ch: "Switzerland",
  cn: "China",
  ctfastrak: "CTfastrak",
  de: "Germany",
  denver: "Denver",
  es: "Spain",
  esfahan: "Isfahan",
  eurosleep: "European Sleeper",
  fr: "France",
  gb: "Great Britain",
  got: "GO Transit",
  gotransit: "GO Transit",
  hannover: "Hanover",
  hanover: "Hanover",
  hk: "Hong Kong",
  hongkong: "Hong Kong",
  id: "Indonesia",
  ie: "Ireland",
  isfahan: "Isfahan",
  isleofwight: "Isle of Wight",
  jaen: "Jaén",
  kiev: "Kyiv",
  "kuala lumpur": "Kuala Lumpur",
  kualalumpur: "Kuala Lumpur",
  kyiv: "Kyiv",
  lisboa: "Lisbon",
  lisbon: "Lisbon",
  losangeles: "Los Angeles",
  malaga: "Málaga",
  mexicocity: "Mexico City",
  mitteldeutschland: "Mitteldeutschland",
  newtaipei: "New Taipei",
  newyork: "New York City",
  newyorkcity: "New York City",
  nizhny: "Nizhny Novgorod",
  nsw: "New South Wales",
  nycs: "New York City",
  "nycs-h": "New York City",
  okc: "Oklahoma City",
  orientexpress: "Orient Express",
  phoenix: "Phoenix",
  qld: "Queensland",
  riodejaneiro: "Rio de Janeiro",
  rtd: "Denver",
  saintlouis: "St. Louis",
  sanfrancisco: "San Francisco",
  santaclara: "Santa Clara",
  sevilla: "Seville",
  seville: "Seville",
  stlouis: "St. Louis",
  uta: "Utah Transit Authority",
  valleymetro: "Phoenix",
  westmidlands: "West Midlands",
};

/** A region arg as a heading, e.g. "gb" -> "Great Britain", "tokyo" -> "Tokyo". */
export function rintRegionLabel(region: string): string {
  return REGION_NAMES[region] ?? titleCase(region);
}

/**
 * Countries for regions the documentation doesn't file, plus the few it files
 * somewhere unhelpful. Takes precedence over the harvested map.
 *
 * Most are simply undocumented, and resolved by reading the system's own article
 * name (`bremen|tram` links to "Trams in Bremen"). Deliberately hand-written rather
 * than inferred: the tempting shortcut — copy the country from another region
 * sharing the same logo file — is wrong, because German, Austrian and Swiss S-Bahn
 * systems all draw the same "S" symbol, so it confidently filed Hanover under
 * Switzerland. A wrong country is worse than none.
 *
 * The overrides are cross-border operators, which the docs list under every country
 * they serve; the harvester takes whichever comes first alphabetically, which put
 * Eurostar under Belgium.
 */
const EXTRA_REGION_COUNTRY: Record<string, string> = {
  "au-act": "Australia",
  "buenos aires": "Argentina",
  eurostar: "United Kingdom", // override: docs list it under Belgium and the UK
  orientexpress: "United Kingdom", // override: listed under several
  bangladesh: "Bangladesh",
  bremen: "Germany",
  brisbane: "Australia",
  cadiz: "Spain",
  canberra: "Australia",
  cdmx: "Mexico",
  cincinnati: "United States",
  cádiz: "Spain",
  esfahan: "Iran",
  got: "Canada",
  greece: "Greece",
  hanover: "Germany",
  // The docs name this group with all three, so match it exactly or it splits.
  hongkong: "Mainland China, Hong Kong, and Macau",
  isfahan: "Iran",
  jaen: "Spain",
  jaén: "Spain",
  kiev: "Ukraine",
  "kuala lumpur": "Malaysia",
  kualalumpur: "Malaysia",
  lisbon: "Portugal",
  lombardy: "Italy",
  mashhad: "Iran",
  mitteldeutschland: "Germany",
  málaga: "Spain",
  newyorkcity: "United States",
  nizhny: "Russia",
  nycs: "United States",
  "nycs-h": "United States",
  qom: "Iran",
  rtd: "United States",
  saintlouis: "United States",
  seville: "Spain",
  tbilisi: "Georgia",
  valleymetro: "United States",
  virgin: "United States",
};

/** Regions that describe a MODE rather than a place, so they belong under General. */
const GENERIC_REGIONS = new Set(["air", "bus", "heritage"]);

/** The country a region's logos belong to, or undefined if we can't say. */
export function rintRegionCountry(region: string): string | undefined {
  // Hand-written first, so it can correct the harvested map as well as extend it.
  return EXTRA_REGION_COUNTRY[region] ?? RINT_REGION_COUNTRY[region];
}

/** One region's logos — a "system" within a country. */
export interface RintCatalogGroup {
  key: string;
  label: string;
  entries: RintCatalogEntry[];
  /**
   * Whether the group's own heading is worth showing. False for the pooled
   * one-logo systems and for a section's only group, where the heading would just
   * repeat the country. The label is still set either way, so a picker can keep it
   * for assistive tech while hiding it visually.
   */
  named: boolean;
}

/** One country's systems. `General` and `Other` use the same shape. */
export interface RintCatalogSection {
  key: string;
  label: string;
  groups: RintCatalogGroup[];
}

// Section keys that aren't countries. Order is explicit in the sort, so these carry
// no sort magic — they only need to be values no country name can collide with.
const GENERAL_SECTION = "__general";
const OTHER_SECTION = "__other";

/**
 * Group entries the way the template's own documentation does: a "General" section of
 * modes and facilities, then one section per country, each holding one group per
 * region (the "system" — London, Tokyo, Merseyrail).
 *
 * Two levels because one wasn't enough: the first arg of a rint code mixes countries
 * (`gb`), states (`nsw`) and cities (`london`), so a flat list of it is 240-odd
 * categories with no order a person would guess. The country layer is not invented —
 * `/doc/countries` maintains it alongside the template.
 *
 * Anything we can't place lands in a final "Other" section rather than being guessed
 * into the wrong country.
 */
export function groupRintCatalog(entries: RintCatalogEntry[]): RintCatalogSection[] {
  const byRegion = new Map<string, RintCatalogEntry[]>();
  for (const entry of entries) {
    const [region = ""] = entry.code.split("|");
    const list = byRegion.get(region);
    if (list) list.push(entry);
    else byRegion.set(region, [entry]);
  }

  const sections = new Map<string, Map<string, RintCatalogEntry[]>>();
  const sectionOf = (key: string) => {
    let s = sections.get(key);
    if (!s) sections.set(key, (s = new Map()));
    return s;
  };
  for (const [region, list] of byRegion) {
    const generic = GENERIC_REGIONS.has(region) || list.every((e) => !e.code.includes("|") && GENERIC_CODES.has(e.code));
    const country = generic ? undefined : rintRegionCountry(region);
    const sectionKey = generic ? GENERAL_SECTION : (country ?? OTHER_SECTION);
    // Generic codes all share one group. Otherwise the group is the region — keyed
    // by its LABEL, so alias regions that name the same place merge into one heading
    // (`buenos aires` and `buenosaires`, `saintlouis` and `stlouis`) instead of
    // appearing twice under the same country.
    const groupKey = generic ? GENERAL_SECTION : rintRegionLabel(region);
    const section = sectionOf(sectionKey);
    section.set(groupKey, [...(section.get(groupKey) ?? []), ...list]);
  }

  const built: RintCatalogSection[] = [];
  for (const [key, groupMap] of sections) {
    const label = key === GENERAL_SECTION ? "General" : key === OTHER_SECTION ? "Other" : key;
    const groups: RintCatalogGroup[] = [];
    const loners: RintCatalogEntry[] = [];
    for (const [groupKey, list] of groupMap) {
      const entries = oneTilePerImage(list);
      // A system with one logo doesn't earn a heading: a whole row of text above a
      // single tile turns a country into a tall sparse column instead of a grid, and
      // the tile already names itself on hover. Only multi-logo systems (London,
      // Tokyo, New South Wales) get one; the rest pool together below them.
      if (entries.length === 1 && groupKey !== GENERAL_SECTION) loners.push(...entries);
      else if (groupKey === GENERAL_SECTION) groups.push({ key: groupKey, label, entries, named: false });
      else groups.push({ key: groupKey, label: groupKey, entries, named: true });
    }
    groups.sort((a, b) => a.label.localeCompare(b.label));
    if (loners.length) {
      // Named after the country, so assistive tech has something to announce even
      // though the heading is hidden as a repeat.
      groups.push({ key: `${key}__rest`, label, entries: oneTilePerImage(loners), named: false });
    }
    built.push({ key, label, groups });
  }
  built.sort((a, b) => {
    // General leads, Other trails, countries alphabetical between them.
    const rank = (s: RintCatalogSection) => (s.key === GENERAL_SECTION ? -1 : s.key === OTHER_SECTION ? 1 : 0);
    return rank(a) - rank(b) || a.label.localeCompare(b.label);
  });
  return built;
}

/** Keep one entry per key, preferring the longest code. */
function dedupeBy(entries: RintCatalogEntry[], keyOf: (e: RintCatalogEntry) => string): RintCatalogEntry[] {
  const best = new Map<string, RintCatalogEntry>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const held = best.get(key);
    if (!held || entry.code.length > held.code.length) best.set(key, entry);
  }
  return best.size === entries.length ? entries : [...best.values()];
}

/**
 * Collapse entries that would render as indistinguishable tiles, keeping the longest
 * code as the most self-describing — it's what gets written into the diagram.
 *
 * The template gives many logos several alias codes (`| m | metro =`) and the catalog
 * keeps them all, because a code we can't resolve is worse than a spare one. In a
 * PICKER they're noise. Two passes, because "the same tile" happens two ways:
 *
 *   1. **Same image, same article** — a true alias. `metro`, `subway` and
 *      `underground` are one file and one article under three spellings.
 *   2. **Same image, same displayed name** — different articles that we render
 *      identically. The four San Francisco cable-car codes link to the same article
 *      with different `#section` anchors, and since the name drops the anchor they
 *      read the same. Collapsing costs the line-specific link targets; four identical
 *      tiles cost more.
 *
 * Neither pass alone is enough, and the obvious single key is wrong either way. Image
 * alone would merge `gb|rail` (National Rail) with `gb|brail` (British Rail) — one
 * file, two operators — and silently drop the current one. Image-plus-name alone
 * misses case 1 whenever the names are derived differently.
 */
function oneTilePerImage(entries: RintCatalogEntry[]): RintCatalogEntry[] {
  // With no article to compare, fall back to the region: `melbourne|reg bus` and
  // `melbourne|regional bus` are one logo, but `mashhad|uc` and `qom|uc` are two
  // cities that merely share the same road sign, and keying both on the bare file
  // dropped Mashhad and Qom entirely.
  const aliases = dedupeBy(entries, (e) =>
    e.link ? `${e.file} ${e.link}` : `${e.file} ${e.code.split("|")[0]}`,
  );
  return dedupeBy(aliases, (e) => `${e.file} ${rintCatalogLabel(e)}`);
}

/**
 * Pre-resolved `RintEntry`s for the given codes, to seed `createLogoResolver` so
 * known logos paint immediately instead of after a round-trip. Codes absent from
 * the snapshot are simply omitted — the API fills those in.
 */
export function rintCatalogSeed(codes: string[]): Record<string, RintEntry> {
  const out: Record<string, RintEntry> = {};
  for (const code of codes) {
    const entry = findRintCatalogEntry(code);
    // Keyed by the code AS WRITTEN: that's what the resolver will look up.
    if (entry) out[code] = { file: entry.file, size: entry.size, link: entry.link };
  }
  return out;
}
