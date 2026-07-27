import { describe, expect, it } from "vitest";
import {
  RINT_CATALOG,
  findRintCatalogEntry,
  groupRintCatalog,
  normalizeRintCode,
  rintCatalogLabel,
  rintCatalogSearchText,
  rintCatalogSeed,
  rintCreditRequired,
  rintFileCredit,
  rintLicenceNeedsCredit,
  logoCredits,
  rintRegionLabel,
  fileDescriptionUrl,
} from "./rint-catalog";

describe("RINT_CATALOG", () => {
  it("is a non-trivial snapshot with every entry usable", () => {
    // A regenerate that silently guts the catalog is the failure mode to catch:
    // the wiki's own "does this file exist" answer is easy to read backwards
    // (Commons files report `missing` on en.wikipedia), which once cut 1,126
    // entries to 29 while every remaining one still looked perfectly valid.
    expect(RINT_CATALOG.length).toBeGreaterThan(900);
    // The catalog only earns its keep if every entry can actually be drawn, so
    // the generator's "omit non-image codes" rule is asserted here, not trusted.
    for (const e of RINT_CATALOG) {
      expect(e.code, JSON.stringify(e)).toMatch(/^[^|]+(\|[^|]+)?$/);
      expect(e.file, e.code).toMatch(/\.(svg|png|jpg|jpeg|gif)$/i);
      // Some template cases build the file name from an argument we didn't
      // supply, leaving `Spb metro line{{{2}}}.svg` — a name that ends in .svg
      // and 404s. Those are families, not logos, and can't be offered.
      expect(e.file, e.code).not.toMatch(/[{}]/);
    }
  });

  it("holds no duplicate codes (aliases must not collide)", () => {
    const codes = RINT_CATALOG.map((e) => normalizeRintCode(e.code));
    expect(codes.length).toBe(new Set(codes).size);
  });

  it("stores codes already normalized, so lookups can't miss", () => {
    for (const e of RINT_CATALOG) expect(e.code).toBe(normalizeRintCode(e.code));
  });

  it("contains the logos our sample diagram uses", () => {
    expect(findRintCatalogEntry("gb|rail")?.file).toBe("National Rail logo.svg");
    expect(findRintCatalogEntry("london|underground")?.file).toBe("Underground no-text.svg");
    expect(findRintCatalogEntry("london|thameslink")).toBeDefined();
  });
});

describe("normalizeRintCode", () => {
  it("lowercases and trims each arg, like the template's {{lc:}}", () => {
    expect(normalizeRintCode("London|Thameslink")).toBe("london|thameslink");
    expect(normalizeRintCode(" London | Underground ")).toBe("london|underground");
    expect(normalizeRintCode("Eurostar")).toBe("eurostar");
  });
});

describe("findRintCatalogEntry", () => {
  it("finds a code however it was cased or spaced in the diagram", () => {
    const canonical = findRintCatalogEntry("london|thameslink");
    expect(findRintCatalogEntry("London|thameslink")).toBe(canonical);
    expect(findRintCatalogEntry(" LONDON | Thameslink ")).toBe(canonical);
  });

  it("returns undefined for a code outside the snapshot", () => {
    expect(findRintCatalogEntry("not|areallogo")).toBeUndefined();
  });
});

describe("rintCatalogLabel", () => {
  it("uses the linked article, dropping disambiguators and anchors", () => {
    expect(rintCatalogLabel({ code: "x|y", file: "f.svg", link: "Circle line (London Underground)" })).toBe(
      "Circle line",
    );
    expect(rintCatalogLabel({ code: "x|y", file: "f.svg", link: "East London line#The era" })).toBe(
      "East London line",
    );
  });

  it("names an unlinked logo by place and qualifier, not by its raw code", () => {
    expect(rintCatalogLabel({ code: "melbourne|regional bus", file: "f.svg" })).toBe(
      "Melbourne (regional bus)",
    );
    expect(rintCatalogLabel({ code: "eurostar", file: "f.svg" })).toBe("Eurostar");
    // Five cities share an "under construction" sign; the abbreviation is spelled out
    // so they don't all read "Uc".
    expect(rintCatalogLabel({ code: "mashhad|uc", file: "f.svg" })).toBe("Mashhad (under construction)");
    // Abbreviated regions still get their proper name.
    expect(rintCatalogLabel({ code: "rtd|bus", file: "f.svg" })).toBe("Denver (bus)");
  });

  it("names a generic mode from its code, since its article is titled for prose", () => {
    // `air` links to "Lists of airports" and `tram` to a lowercase "tram".
    expect(rintCatalogLabel(findRintCatalogEntry("air")!)).toBe("Air travel");
    expect(rintCatalogLabel(findRintCatalogEntry("tram")!)).toBe("Tram");
    expect(rintCatalogLabel(findRintCatalogEntry("rail")!)).toBe("Rail");
  });

  it("distinguishes the two accessibility symbols, which share one article", () => {
    // Both link to "Accessibility#Transportation" but mean opposite things.
    expect(rintCatalogLabel(findRintCatalogEntry("wheelchair")!)).toBe("Wheelchair access");
    expect(rintCatalogLabel(findRintCatalogEntry("no_wheelchair")!)).toBe("No wheelchair access");
  });

  it("keeps the article name for an operator, generic-looking code or not", () => {
    // `london|rail` is not a bare generic code, so the article still wins.
    expect(rintCatalogLabel(findRintCatalogEntry("london|rail")!)).toBe("National Rail");
  });
});

describe("rintCatalogSearchText", () => {
  it("matches on the display name or the raw code args", () => {
    const text = rintCatalogSearchText({ code: "london|underground", file: "f.svg", link: "London Underground" });
    expect(text).toContain("London Underground");
    expect(text).toContain("london underground"); // code args, pipe-free
  });
});

describe("rintRegionLabel", () => {
  it("expands abbreviations that title-casing would mangle", () => {
    expect(rintRegionLabel("gb")).toBe("Great Britain");
    expect(rintRegionLabel("nsw")).toBe("New South Wales");
    expect(rintRegionLabel("au-wa")).toBe("Western Australia");
  });

  it("title-cases an ordinary place name, words and all", () => {
    expect(rintRegionLabel("tokyo")).toBe("Tokyo");
    expect(rintRegionLabel("kuala lumpur")).toBe("Kuala Lumpur");
    expect(rintRegionLabel("rhine-neckar")).toBe("Rhine-Neckar");
  });

  it("keeps accents intact when capitalising", () => {
    expect(rintRegionLabel("cádiz")).toBe("Cádiz");
    expect(rintRegionLabel("düsseldorf")).toBe("Düsseldorf");
  });
});

describe("groupRintCatalog", () => {
  const sections = groupRintCatalog(RINT_CATALOG);
  const labels = sections.map((s) => s.label);
  const allEntries = sections.flatMap((s) => s.groups.flatMap((g) => g.entries));

  it("is two levels: General, then countries alphabetically", () => {
    expect(labels[0]).toBe("General");
    const countries = labels.filter((l) => l !== "General" && l !== "Other");
    expect([...countries].sort((a, b) => a.localeCompare(b))).toEqual(countries);
    expect(labels).toContain("United Kingdom");
    expect(labels).toContain("Japan");
  });

  it("categorises every logo, leaving nothing in the catch-all", () => {
    // If a region can't be placed it lands in "Other" — which is honest, but it
    // should be empty, since the docs plus the hand-written extras cover everything.
    expect(labels).not.toContain("Other");
    expect(allEntries.length).toBeGreaterThan(1000);
  });

  it("names a country's systems, not raw region args", () => {
    const uk = sections.find((s) => s.label === "United Kingdom")!;
    const systems = uk.groups.map((g) => g.label);
    expect(systems).toContain("London");
    expect(systems).toContain("Great Britain");
    // Run-together args have to be spelled out; "Isleofwight" is not a place.
    expect(systems).toContain("Isle of Wight");
    expect(systems).toContain("West Midlands");
    expect(systems.every((l) => l === titleish(l))).toBe(true);
  });

  it("merges alias regions that name the same place into one system", () => {
    // `buenos aires` and `buenosaires` are the same city; `saintlouis` and
    // `stlouis` the same operator. Two headings reading the same would look broken.
    for (const section of sections) {
      const seen = section.groups.filter((g) => g.named).map((g) => g.label);
      expect(new Set(seen).size, section.label).toBe(seen.length);
    }
    // Merged, then deduped: `saintlouis` and `stlouis` are one logo, so one tile.
    const us = sections.find((s) => s.label === "United States")!;
    const codes = us.groups.flatMap((g) => g.entries).map((e) => e.code);
    expect(codes).toContain("saintlouis");
    expect(codes).not.toContain("stlouis");
  });

  it("keeps a mode region out of the country the docs filed it under", () => {
    // Australia's doc page lists `bus`, but `bus|…` is a generic mode, not a place.
    const australia = sections.find((s) => s.label === "Australia")!;
    expect(australia.groups.map((g) => g.label)).not.toContain("Bus");
    const general = sections[0]!.groups.flatMap((g) => g.entries).map((e) => e.code);
    expect(general.some((c) => c.startsWith("bus|"))).toBe(true);
  });

  it("sorts named systems within a country, pooled leftovers last", () => {
    for (const section of sections) {
      const named = section.groups.filter((g) => g.named).map((g) => g.label);
      expect([...named].sort((a, b) => a.localeCompare(b)), section.label).toEqual(named);
      // At most one unnamed group, and it comes after the named ones.
      const unnamed = section.groups.filter((g) => !g.named);
      expect(unnamed.length, section.label).toBeLessThanOrEqual(1);
      if (unnamed.length && named.length) expect(section.groups.at(-1)!.named).toBe(false);
    }
  });

  it("pools a country's one-logo systems instead of giving each a heading", () => {
    // A heading above a single tile turns a country into a tall sparse column; the
    // tile names itself on hover, so these ride together under the country.
    const uk = sections.find((s) => s.label === "United Kingdom")!;
    expect(uk.groups.filter((g) => g.named).every((g) => g.entries.length > 1)).toBe(true);
    const pooled = uk.groups.find((g) => !g.named)!;
    expect(pooled.entries.map((e) => e.code)).toContain("eurostar");
    // Still labelled, so a screen reader can announce the group.
    expect(pooled.label).toBe("United Kingdom");
  });

  it("lists no entry twice", () => {
    expect(new Set(allEntries.map((e) => e.code)).size).toBe(allEntries.length);
  });

  it("collapses alias codes that would render as identical tiles", () => {
    // Aliases are all kept in the catalog (a missing code is worse than a spare
    // one) but must not surface as duplicate tiles.
    for (const section of sections) {
      for (const group of section.groups) {
        const shown = group.entries.map((e) => `${e.file} ${rintCatalogLabel(e)}`);
        expect(new Set(shown).size, `${section.label}/${group.label}`).toBe(shown.length);
      }
    }
    const gb = systemOf("United Kingdom", "Great Britain");
    // `gb|manchester` and `gb|metrolink` are one logo; the longer code wins.
    expect(gb.filter((e) => /manchester|metrolink/.test(e.code)).map((e) => e.code)).toEqual([
      "gb|manchester",
    ]);
  });

  it("shows one tile per distinct logo, not one per spelling", () => {
    // `metro`, `subway` and `underground` are one image and one article under three
    // names, and read as three separate logos until the dedupe keyed on the article.
    const general = sections[0]!.groups.flatMap((g) => g.entries).map((e) => e.code);
    const rapid = ["metro", "subway", "underground"].filter((c) => general.includes(c));
    expect(rapid).toHaveLength(1);
    // Same for the other alias sets in the generic block.
    for (const pair of [
      ["bike", "bicycle"],
      ["mono", "monorail"],
      ["park", "parking"],
      ["funicular", "incline"],
      ["airbase", "air|base"],
      ["airfield", "air|field"],
      ["trolley", "bus|trolleybus"],
    ]) {
      expect(pair.filter((c) => general.includes(c)), pair.join("/")).toHaveLength(1);
    }
  });

  it("merges spelling variants of one place into a single system", () => {
    // The template accumulates variants — accents (`cadiz`/`cádiz`), transliterations
    // (`kiev`/`kyiv`, `lisboa`/`lisbon`), abbreviations (`hk`/`hongkong`,
    // `rtd`/`denver`). Left alone each becomes its own heading listing the same logos.
    for (const [country, system, codes] of [
      ["Spain", "Cádiz", ["cadiz", "cádiz"]],
      ["Ukraine", "Kyiv", ["kiev", "kyiv"]],
      ["Portugal", "Lisbon", ["lisboa", "lisbon"]],
      ["United States", "Denver", ["denver", "rtd"]],
    ] as const) {
      const section = sections.find((s) => s.label === country)!;
      expect(section.groups.filter((g) => g.label === system), `${country}/${system}`).toHaveLength(1);
      const present = section.groups
        .flatMap((g) => g.entries)
        .map((e) => e.code.split("|")[0]);
      expect(codes.some((c) => present.includes(c)), `${country}/${system}`).toBe(true);
    }
  });

  it("keeps different cities that merely share one symbol apart", () => {
    // Esfahan, Mashhad and Qom each have a single "under construction" logo, and it's
    // the same image — identical logo sets are not evidence of being the same place.
    const iran = sections.find((s) => s.label === "Iran")!;
    const systems = iran.groups.flatMap((g) => (g.named ? [g.label] : g.entries.map((e) => e.code)));
    expect(systems.join(" ")).toMatch(/mashhad/);
    expect(systems.join(" ")).toMatch(/qom/);
  });

  it("shows no two tiles with the same image and the same name, anywhere", () => {
    // The user-visible invariant: a tile is an image plus a name, so two that match
    // on both are indistinguishable and one of them is noise.
    for (const section of sections) {
      for (const group of section.groups) {
        const shown = group.entries.map((e) => `${e.file}|${rintCatalogLabel(e)}`);
        expect(new Set(shown).size, `${section.label}/${group.label}`).toBe(shown.length);
      }
    }
  });

  it("keeps two logos that share an image but mean different things", () => {
    const codes = systemOf("United Kingdom", "Great Britain")
      .filter((e) => e.file === "National Rail logo.svg")
      .map((e) => e.code);
    // Same file, different operators — National Rail and British Rail. Deduping on
    // the image alone dropped the current one in favour of the historic one.
    expect(codes).toContain("gb|rail");
    expect(codes).toContain("gb|brail");
  });

  it("files a single-operator region under its country, not a global bucket", () => {
    // `eurostar` has one logo and no city; the country layer gives it a home, even
    // though the docs list it under Belgium as well.
    const uk = sections.find((s) => s.label === "United Kingdom")!;
    expect(uk.groups.flatMap((g) => g.entries).map((e) => e.code)).toContain("eurostar");
    const belgium = sections.find((s) => s.label === "Belgium")!;
    expect(belgium.groups.flatMap((g) => g.entries).map((e) => e.code)).not.toContain("eurostar");
  });

  it("puts mode and facility codes in General, wherever they are keyed", () => {
    const general = sections[0]!.groups.flatMap((g) => g.entries).map((e) => e.code);
    expect(general).toContain("ferry");
    expect(general).toContain("parking");
    // `air` is both a bare code and a prefix (`air|base`); all of it is generic.
    expect(general).toContain("air");
    expect(general).toContain("air|base");
    // …and a mode-shaped region belongs here too, not under a country.
    expect(general).toContain("heritage|rail");
  });

  const titleish = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  function systemOf(country: string, system: string) {
    const section = sections.find((s) => s.label === country);
    return section?.groups.find((g) => g.label === system)?.entries ?? [];
  }
});

describe("rintCatalogSeed", () => {
  it("pre-resolves known codes, keyed exactly as written", () => {
    const seed = rintCatalogSeed(["London|thameslink", "gb|rail"]);
    // Keyed as-written so a resolver built from `collectRintCodes` output hits.
    expect(seed["London|thameslink"]?.file).toBeTruthy();
    expect(seed["gb|rail"]).toEqual({
      file: "National Rail logo.svg",
      size: 12,
      link: "National Rail",
    });
  });

  it("omits unknown codes so the API can fill them in", () => {
    expect(rintCatalogSeed(["not|areallogo"])).toEqual({});
  });
});

describe("licence handling", () => {
  it("knows which licences oblige a credit", () => {
    for (const free of ["Public domain", "PD", "PD-shape", "CC0"]) {
      expect(rintLicenceNeedsCredit(free), free).toBe(false);
    }
    for (const attrib of ["CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY 4.0", "Attribution", "LGACDMX"]) {
      expect(rintLicenceNeedsCredit(attrib), attrib).toBe(true);
    }
  });

  it("treats an unknown licence as needing credit", () => {
    // The safe direction when the answer decides whether a name gets left off.
    expect(rintLicenceNeedsCredit(undefined)).toBe(true);
    expect(rintLicenceNeedsCredit("")).toBe(true);
  });

  it("records a licence for every file the catalog references", () => {
    // A missing record means `rintCreditRequired` falls back to "yes" for a file we do
    // know about — a credit demanded with no author to name.
    const missing = [...new Set(RINT_CATALOG.map((e) => e.file))].filter(
      (f) => !rintFileCredit(f)?.licence,
    );
    expect(missing).toEqual([]);
  });

  it("takes Commons' own flag as the answer where it has one", () => {
    // As generated, the flag and the licence-name guess agree on all 1,155 files, so
    // this is a guard rather than a live check: it's the flag that must win if a future
    // regeneration turns up a file where they diverge. Asserting agreement on every
    // flagged file is what would catch the fallback quietly taking over.
    const flagged = [...new Set(RINT_CATALOG.map((e) => e.file))].filter(
      (f) => rintFileCredit(f)?.creditRequired != null,
    );
    expect(flagged.length).toBeGreaterThan(1000);
    for (const file of flagged) {
      expect(rintCreditRequired(file), file).toBe(rintFileCredit(file)!.creditRequired);
    }
  });

  it("can name an author for every credit it says is owed", () => {
    // The point of the whole exercise: a credit with no name to put in it isn't a
    // credit. Public-domain files without an author are fine — nothing is owed there.
    const owedWithNoName = [...new Set(RINT_CATALOG.map((e) => e.file))]
      .filter((f) => rintCreditRequired(f))
      .filter((f) => !rintFileCredit(f)?.author);
    expect(owedWithNoName).toEqual([]);
  });

  it("treats a file it has never heard of as needing credit", () => {
    expect(rintCreditRequired("Not a real file at all.svg")).toBe(true);
  });

  it("lists only the logos that oblige a credit", () => {
    const owed = RINT_CATALOG.find((e) => rintCreditRequired(e.file))!.file;
    const free = RINT_CATALOG.find((e) => !rintCreditRequired(e.file))!.file;

    expect(logoCredits([owed, free]).map((c) => c.file)).toEqual([owed]);
  });

  it("deduplicates files and sorts them, so a credit appears once", () => {
    const owed = [...new Set(RINT_CATALOG.map((e) => e.file))]
      .filter((f) => rintCreditRequired(f))
      .slice(0, 3)
      .sort();

    expect(logoCredits([...owed].reverse().concat(owed)).map((c) => c.file)).toEqual(owed);
  });

  it("gives each credit somewhere to link for the full terms", () => {
    const owed = RINT_CATALOG.find((e) => rintCreditRequired(e.file))!.file;
    const [credit] = logoCredits([owed]);

    expect(credit!.fileUrl).toBe(fileDescriptionUrl(owed));
    expect(credit!.licence).toBeTruthy();
  });

  it("still credits an unknown file, naming no author it can't vouch for", () => {
    const [credit] = logoCredits(["Not a real file at all.svg"]);

    expect(credit!.licence).toBe("Unknown");
    expect(credit!.author).toBeUndefined();
  });

  it("trims zero-width characters off the EDGES of an author's name", () => {
    // One file's author arrives from Commons with a leading zero-width joiner, which
    // renders as an artifact and compares unequal to the same author on sibling files.
    //
    // Edges only, deliberately: ZWNJ and ZWJ are meaningful INSIDE Indic and Persian
    // names, and several of these authors write in those scripts. Asserting that no
    // author contains one anywhere would pass today and then fail on a legitimate name,
    // inviting a "fix" that corrupts it.
    const odd = [...new Set(RINT_CATALOG.map((e) => e.file))]
      .map((f) => rintFileCredit(f)?.author)
      .filter((a): a is string => !!a && /^[\u200b-\u200d\ufeff]|[\u200b-\u200d\ufeff]$/.test(a));
    expect(odd).toEqual([]);
  });

  it("links a file to its description page, where author and terms live", () => {
    expect(fileDescriptionUrl("Underground no-text.svg")).toBe(
      "https://en.wikipedia.org/wiki/File:Underground_no-text.svg",
    );
    // Titles with characters that need escaping still resolve.
    expect(fileDescriptionUrl("Cercanías C3 (Azul oscuro).svg")).toContain("Cercan%C3%ADas");
  });
});
