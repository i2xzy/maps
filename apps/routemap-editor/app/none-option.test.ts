import { describe, expect, it } from "vitest";
import { withNoneOption } from "./inspector";

/** Just the values, for readable expectations. */
const order = (opts: { value: string | number }[]) => opts.map((o) => String(o.value));
const opt = (value: string) => ({ value });
const NONE = opt("__none__");

// The full width scale, as the descriptor holds it.
const WIDTHS = ["eighth", "quarter", "three-eighth", "half", "three-quarter", "double", "quad"];

describe("withNoneOption", () => {
  it("puts the unset option at its place on the scale", () => {
    // Full is 1: after three-quarter, before double. At the head of the list it reads as another
    // extreme rather than the middle of the scale.
    const shown = ["eighth", "quarter", "three-eighth", "half", "three-quarter", "double", "quad"].map(opt);
    expect(order(withNoneOption(shown, NONE, "three-quarter", WIDTHS))).toEqual([
      "eighth",
      "quarter",
      "three-eighth",
      "half",
      "three-quarter",
      "__none__",
      "double",
      "quad",
    ]);
  });

  it("still places it correctly when the anchor itself was filtered out", () => {
    // The bug this exists for. A track offers only quarter, half, double, quad — `three-quarter`
    // has no icon — so matching the anchor among the SHOWN options found nothing and fell back
    // to the head. Position comes from the full scale instead.
    const shown = ["quarter", "half", "double", "quad"].map(opt);
    expect(order(withNoneOption(shown, NONE, "three-quarter", WIDTHS))).toEqual([
      "quarter",
      "half",
      "__none__",
      "double",
      "quad",
    ]);
  });

  it("leads with the unset option when the values aren't a scale", () => {
    // `state` and `formation` are unordered sets, so there's no position to respect.
    const shown = ["tunnel", "elevated"].map(opt);
    expect(order(withNoneOption(shown, NONE))).toEqual(["__none__", "tunnel", "elevated"]);
  });

  it("leads with it when every shown option sits after the anchor", () => {
    const shown = ["double", "quad"].map(opt);
    expect(order(withNoneOption(shown, NONE, "three-quarter", WIDTHS))).toEqual([
      "__none__",
      "double",
      "quad",
    ]);
  });

  it("changes nothing when there is no unset option", () => {
    const shown = ["quarter", "half"].map(opt);
    expect(order(withNoneOption(shown, null, "three-quarter", WIDTHS))).toEqual(["quarter", "half"]);
  });
});
