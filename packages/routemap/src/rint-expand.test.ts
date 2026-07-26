import { describe, expect, it, vi, afterEach } from "vitest";
import { expandRint, expandRws } from "./rint";

/**
 * The API-facing half of rint/rws: how often we hit the wiki, and what we keep.
 *
 * These matter beyond correctness. The editor is a public tool pointed at Wikipedia's
 * servers from every visitor's browser, so a redundant request isn't just waste —
 * the API rate-limits by answering with an error page, which would make logos
 * silently vanish. Each test below pins one request we promised not to make.
 *
 * The caches are module-level and deliberately not resettable, so every test uses
 * codes of its own rather than trying to clear them.
 */

const fileWikitext = (name: string) => `[[File:${name}|16x16px|link=Foo|alt=Bar]]`;

/** A fetch stub that counts calls and answers with `wikitext`. */
function stubFetch(wikitext: (url: string) => string | null) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", (url: string) => {
    calls.push(url);
    const text = wikitext(url);
    if (text === null) return Promise.reject(new Error("network down"));
    return Promise.resolve({ json: () => Promise.resolve({ expandtemplates: { wikitext: text } }) });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("expandRint", () => {
  it("makes one request when the same uncached code is asked for concurrently", async () => {
    const calls = stubFetch(() => fileWikitext("Concurrent.svg"));

    // What React's dev-mode double-invoke of effects does on every mount. Before the
    // in-flight cache this fetched twice, because nothing was cached until the first
    // response landed.
    const [a, b] = await Promise.all([
      expandRint(["test|concurrent"]),
      expandRint(["test|concurrent"]),
    ]);

    expect(calls).toHaveLength(1);
    expect(a["test|concurrent"]?.file).toBe("Concurrent.svg");
    // Both callers get the identical entry, which is how the editor detects a repeat
    // by reference and skips re-rendering every logo on screen.
    expect(b["test|concurrent"]).toBe(a["test|concurrent"]);
  });

  it("makes one request for a code repeated within a single call", async () => {
    const calls = stubFetch(() => fileWikitext("Repeated.svg"));

    const out = await expandRint(["test|repeated", "test|repeated"]);

    expect(calls).toHaveLength(1);
    expect(out["test|repeated"]?.file).toBe("Repeated.svg");
  });

  it("makes no request at all for an already-resolved code", async () => {
    const first = stubFetch(() => fileWikitext("Cached.svg"));
    const a = await expandRint(["test|cached"]);
    expect(first).toHaveLength(1);

    const second = stubFetch(() => fileWikitext("Different.svg"));
    const b = await expandRint(["test|cached"]);

    expect(second).toHaveLength(0);
    expect(b["test|cached"]).toBe(a["test|cached"]);
  });

  it("keeps a failed lookup retryable rather than caching the failure", async () => {
    stubFetch(() => null); // network down
    const failed = await expandRint(["test|flaky"]);
    expect(failed["test|flaky"]).toBeUndefined();

    // A transient error must not be remembered as "no such logo" — otherwise one
    // blip means the logo stays missing until the page is reloaded.
    const retry = stubFetch(() => fileWikitext("Flaky.svg"));
    const ok = await expandRint(["test|flaky"]);

    expect(retry).toHaveLength(1);
    expect(ok["test|flaky"]?.file).toBe("Flaky.svg");
  });

  it("omits a code whose expansion produced no File, and retries it later", async () => {
    // An unknown code expands to the args echoed back, not a File.
    const calls = stubFetch(() => "test|nonesuch");
    const out = await expandRint(["test|nonesuch"]);

    expect(calls).toHaveLength(1);
    expect(out).toEqual({});
  });

  it("asks for the code as positional rint args", async () => {
    const calls = stubFetch(() => fileWikitext("Args.svg"));
    await expandRint(["test|london|underground"]);

    expect(decodeURIComponent(calls[0]!)).toContain("text={{rint|test|london|underground}}");
    expect(calls[0]).toContain("origin=*"); // CORS, so it works from the browser
  });

  it("honours an apiBase override", async () => {
    const calls = stubFetch(() => fileWikitext("Base.svg"));
    await expandRint(["test|base"], { apiBase: "https://example.test/w/api.php" });

    expect(calls[0]!.startsWith("https://example.test/w/api.php")).toBe(true);
  });
});

describe("expandRws", () => {
  it("reads the target and display text out of [[target|display]]", async () => {
    stubFetch(() => "[[Liverpool Lime Street station|Liverpool Lime Street]]");
    const out = await expandRws(["RwsA|Lime Street"]);

    expect(out["RwsA|Lime Street"]).toEqual({
      target: "Liverpool Lime Street station",
      display: "Liverpool Lime Street",
    });
  });

  it("falls back to the target as display text for a bare [[target]]", async () => {
    stubFetch(() => "[[Waverley]]");
    const out = await expandRws(["RwsB"]);

    expect(out["RwsB"]).toEqual({ target: "Waverley", display: "Waverley" });
  });

  it("shares one request between concurrent callers", async () => {
    const calls = stubFetch(() => "[[Shared station|Shared]]");
    const [a, b] = await Promise.all([expandRws(["RwsC"]), expandRws(["RwsC"])]);

    expect(calls).toHaveLength(1);
    expect(b["RwsC"]).toBe(a["RwsC"]);
  });

  it("omits args that expanded to no link", async () => {
    stubFetch(() => "Nonesuch");
    expect(await expandRws(["RwsD"])).toEqual({});
  });
});
