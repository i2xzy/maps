import { describe, expect, it } from "vitest";
import { parseRintExpansion } from "./rint-expansion";
import { logoUrl } from "./rint";

describe("parseRintExpansion", () => {
  it("reads the file, size, link and alt out of a rint expansion", () => {
    expect(
      parseRintExpansion("[[File:Underground no-text.svg|10px|link=London Underground|alt=Tube]]"),
    ).toEqual({
      file: "Underground no-text.svg",
      size: 10,
      link: "London Underground",
      alt: "Tube",
    });
  });

  it("normalizes `_` to a space, so one code can only ever yield one url", () => {
    // THE bug this module exists to prevent. MediaWiki treats `_` and ` ` as the
    // same character in a title, so both spellings resolve — which is why the two
    // copies of this parser could disagree for a long time without anything
    // breaking outright. What it cost was a silent re-fetch: the catalog seeded
    // "ACE arrows.svg", the live lookup returned "ACE_arrows.svg", and the logo
    // flickered exactly where seeding was supposed to make it instant.
    const parsed = parseRintExpansion("[[File:ACE_arrows.svg|22px|link=Altamont Corridor Express]]");
    expect(parsed?.file).toBe("ACE arrows.svg");
    // Same url from either spelling is the property that actually matters.
    expect(logoUrl(parsed!.file)).toBe(
      logoUrl(parseRintExpansion("[[File:ACE arrows.svg|22px]]")!.file),
    );
  });

  it("handles the `Nx Mpx` size form and a missing size", () => {
    expect(parseRintExpansion("[[File:X.svg|x16px|link=Y]]")?.size).toBeUndefined();
    expect(parseRintExpansion("[[File:X.svg|16x16px|link=Y]]")?.size).toBe(16);
    expect(parseRintExpansion("[[File:X.svg|link=Y]]")?.size).toBeUndefined();
  });

  it("tolerates the whitespace and casing the template actually emits", () => {
    expect(parseRintExpansion("[[ file : X.svg | 12px | link = Y ]]")).toMatchObject({
      file: "X.svg",
      size: 12,
      link: "Y",
    });
  });

  it("returns null when the code produced no image at all", () => {
    // Legitimate outcomes, not failures: a coloured {{RouteBox}}, plain text, or an
    // intentionally blank case. The catalog generator counts these and omits them.
    expect(parseRintExpansion("")).toBeNull();
    expect(parseRintExpansion("<span style=\"color:#fff\">■</span>")).toBeNull();
    expect(parseRintExpansion("'''Add→{{tl|rail-interchange}}'''")).toBeNull();
  });
});
