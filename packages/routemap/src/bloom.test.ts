import { describe, expect, it } from "vitest";
import { bloomBuild, bloomFromBase64, bloomHas, bloomSize, bloomToBase64 } from "./bloom";

/** Enough keys, and varied enough, to exercise both hashes across the whole bit range. */
const keys = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `STR${i}-${(i * 7919).toString(36)} red`);

describe("bloom", () => {
  it("never reports a false negative", () => {
    // The defining property, and the one that makes this safe to filter a UI with: if the
    // filter says a code is absent, it IS absent, so we can never hide a real icon.
    //
    // This is a regression test as much as a property test. The first build had 71,926
    // false negatives out of 172,005 keys: `fnv1a(...) | 1` yields a SIGNED int32, so a
    // hash above 2^31 gave a negative step, `at` went negative, and `bit >>> 3` wrapped
    // past the end of the array — where a typed-array write is silently dropped and a read
    // is `undefined`. 5,000 keys is enough that some cross 2^31; 10 would not be.
    const all = keys(5000);
    const { m, k } = bloomSize(all.length, 0.01);
    const filter = bloomBuild(all, m, k);
    expect(all.filter((key) => !bloomHas(filter, key))).toEqual([]);
  });

  it("keeps the false-positive rate near the target it was sized for", () => {
    const present = keys(2000);
    const { m, k } = bloomSize(present.length, 0.05);
    const filter = bloomBuild(present, m, k);
    const absent = Array.from({ length: 20000 }, (_, i) => `ABSENT${i}`);
    const rate = absent.filter((key) => bloomHas(filter, key)).length / absent.length;
    // Generous bounds: this asserts the sizing maths is applied, not a precise rate.
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.12);
  });

  it("survives a base64 round trip byte for byte", () => {
    // How the filter actually reaches the browser, so a mismatch here would mean every
    // answer is wrong — with nothing to indicate it.
    const all = keys(1000);
    const { m, k } = bloomSize(all.length, 0.01);
    const filter = bloomBuild(all, m, k);
    const revived = bloomFromBase64(bloomToBase64(filter), m, k);
    expect(revived.bits).toEqual(filter.bits);
    expect(all.every((key) => bloomHas(revived, key))).toBe(true);
  });

  it("sizes itself by the standard optimum", () => {
    // ~9.6 bits per key for 1%, ~6.2 for 5% — the numbers the payload budget was set from.
    expect(bloomSize(100000, 0.01).m / 100000).toBeCloseTo(9.59, 1);
    expect(bloomSize(100000, 0.05).m / 100000).toBeCloseTo(6.24, 1);
    expect(bloomSize(100000, 0.01).k).toBe(7);
  });

  it("handles the space in a coloured code", () => {
    // `STR red` is one code with a space, not two. If the hash treated it as a separator
    // every coloured variant would collide with its base.
    const { m, k } = bloomSize(10, 0.01);
    const filter = bloomBuild(["STR red"], m, k);
    expect(bloomHas(filter, "STR red")).toBe(true);
    expect(bloomHas(filter, "STRred")).toBe(false);
  });
});
