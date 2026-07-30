import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  bsiconExists,
  bsiconKnownMissing,
  existingOptions,
  fieldIsOffered,
  loadBsiconFilter,
  offeredFields,
} from "./bsicon-manifest";
import { defaultOptionOf, fieldSpec, fieldsFor, isFieldVisible, safeIconCode } from "./descriptor";
import type { IconObject } from "./icon";

const spec = (field: string) => fieldSpec(field as keyof IconObject)!;

// The filter is fetched on demand so it stays out of the page's first-load chunk, so a
// test that wants exact answers has to ask for it.
beforeAll(() => loadBsiconFilter());

describe("before the filter loads", () => {
  it("offers everything rather than hiding it", async () => {
    // Deliberately the same direction as the staleness rule: a slow load shows an
    // unfiltered form for a moment, never a form missing controls that work. Asserted on a
    // fresh module so the shared `beforeAll` load doesn't mask it.
    vi.resetModules(); // a fresh module instance, with its own unloaded filter
    const fresh = await import("./bsicon-manifest");
    expect(fresh.bsiconFilterLoaded()).toBe(false);
    expect(fresh.bsiconExists("kSTR")).toBe(true); // absent, but not known absent yet
    expect(fresh.offeredFields({ kind: "track" }).length).toBe(
      fieldsFor("track").filter((f) => isFieldVisible(f, { kind: "track" })).length,
    );
    await fresh.loadBsiconFilter();
    expect(fresh.bsiconFilterLoaded()).toBe(true);
    expect(fresh.bsiconExists("kSTR")).toBe(false);
  });
});

describe("bsiconExists", () => {
  it("knows the icons real diagrams are built from", () => {
    for (const code of ["STR", "BHF", "ABZgl", "STRo", "KBHFa", "STR red", "tSTR"]) {
      expect(bsiconExists(code), code).toBe(true);
    }
  });

  it("rejects codes the naming convention allows but nobody drew", () => {
    // `kSTR` is what the model encodes for `curve: "wide"` on a plain track. It is exactly
    // the kind of plausible-but-absent code that made half the form useless.
    expect(bsiconExists("kSTR")).toBe(false);
    expect(bsiconExists("ZZZQQ")).toBe(false);
    expect(bsiconExists(null)).toBe(false);
    expect(bsiconExists(undefined)).toBe(false);
    expect(bsiconExists("")).toBe(false);
  });
});

describe("field filtering", () => {
  it("hides fields whose every option would produce a broken image", () => {
    const track: IconObject = { kind: "track" };
    const offered = offeredFields(track).map((f) => String(f.field));
    // `offset` moves a line onto a parallel axis; there is no `STR@F`. `lane` likewise.
    expect(offered).not.toContain("offset");
    expect(offered).not.toContain("lane");
    // The ones that do exist stay.
    expect(offered).toContain("system");
    expect(offered).toContain("width");
    expect(offered).toContain("level"); // STRo / STRu
  });

  it("prunes dead options inside a field that survives", () => {
    // Nine widths are representable; only four are drawn for a plain track.
    const widths = existingOptions({ kind: "track" }, "width").map((o) => String(o.value));
    expect(widths).toEqual(["quarter", "half", "double", "quad"]);
  });

  it("still offers a field the icon has SET, even when its code doesn't exist", () => {
    // The safety rule. `curve: "wide"` encodes to `kSTR`, which doesn't exist — but if a
    // diagram somehow holds that value, hiding the control makes real content uneditable.
    // The filter is a snapshot with a known false-positive rate; it must only ever remove
    // choices nobody has made.
    const odd: IconObject = { kind: "track", curve: "wide" };
    expect(bsiconExists("kSTR")).toBe(false); // the premise
    expect(fieldIsOffered(spec("curve"), odd)).toBe(true);
    expect(offeredFields(odd).map((f) => String(f.field))).toContain("curve");
  });

  it("keeps the selected option in the list even when absent", () => {
    const odd: IconObject = { kind: "track", curve: "wide" };
    expect(existingOptions(odd, "curve").map((o) => String(o.value))).toContain("wide");
  });

  it("never offers a field the descriptor already rules out", () => {
    // Existence filtering narrows; it must not widen. Anything hidden by `isFieldVisible`
    // (wrong kind, unmet `requires`) stays hidden regardless of what exists.
    for (const icon of [{ kind: "track" }, { kind: "station" }, { kind: "spacer" }] as IconObject[]) {
      for (const f of offeredFields(icon)) {
        expect(isFieldVisible(f, icon), `${icon.kind}.${String(f.field)}`).toBe(true);
      }
      expect(offeredFields(icon).length).toBeLessThanOrEqual(fieldsFor(icon.kind).length);
    }
  });

  it("cuts a real icon's form roughly in half", () => {
    // The whole point, asserted as a floor so it can't quietly regress to showing
    // everything. Measured across the fixture: 15.6 fields offered today, 8.6 filtered.
    const track: IconObject = { kind: "track" };
    const before = fieldsFor("track").filter((f) => isFieldVisible(f, track)).length;
    expect(offeredFields(track).length).toBeLessThan(before);
  });
});

describe("bsiconKnownMissing", () => {
  it("says nothing about a real code our encoder can't build", () => {
    // `WASSERq` is on Commons and is not encoder-reachable, so it was never a key in the
    // filter. Reading its absence as "no such file" told users their good code was broken.
    expect(bsiconExists("WASSERq")).toBe(false); // the filter genuinely lacks it
    expect(bsiconKnownMissing("WASSERq")).toBe(false); // but we must not claim it's missing
    expect(bsiconKnownMissing("SKRZ-Bo")).toBe(false);
  });

  it("is confident only inside the encoder's range", () => {
    expect(bsiconKnownMissing("kSTR")).toBe(true); // reachable and absent: certain
    expect(bsiconKnownMissing("STR")).toBe(false); // reachable and present
    expect(bsiconKnownMissing("")).toBe(false);
    expect(bsiconKnownMissing(null)).toBe(false);
  });
});

describe("defaultOptionOf", () => {
  it("finds the option that means the same as unset", () => {
    // `in-use` emits no affix, so plain `BHF` already IS in-use. Showing `—` for it claimed
    // nothing was chosen when something plainly was.
    expect(defaultOptionOf({ kind: "station" }, "state")?.value).toBe("in-use");
    expect(defaultOptionOf({ kind: "track" }, "system")?.value).toBe("rail");
  });

  it("returns nothing when the unset state has no option of its own", () => {
    // `width` is a set of fractions with no "full"; `formation` has no "at grade". Those need a
    // name for the unset state instead — `defaultLabel`.
    expect(defaultOptionOf({ kind: "track" }, "width")).toBeUndefined();
    expect(defaultOptionOf({ kind: "track" }, "formation")).toBeUndefined();
    expect(defaultOptionOf({ kind: "track" }, "level")).toBeUndefined();
    expect(fieldSpec("width")?.defaultLabel).toBe("Full");
    expect(fieldSpec("formation")?.defaultLabel).toBe("At grade");
  });

  it("asks whether CLEARING the field changes the icon, not what's selected", () => {
    // A junction's `to` has no default even though it always has one set: clearing it gives
    // `ABZg`, which isn't an icon — a junction must have a direction. Comparing each option to
    // the icon's CURRENT code instead would have called `left` the default here, which is a
    // different question and the wrong one.
    expect(safeIconCode({ kind: "junction", to: "left" })).toBe("ABZgl");
    expect(defaultOptionOf({ kind: "junction", to: "left" }, "to")).toBeUndefined();
    expect(defaultOptionOf({ kind: "track" }, "to")).toBeUndefined();
    // Whereas clearing `state` genuinely changes nothing, on either kind.
    expect(defaultOptionOf({ kind: "junction", to: "left" }, "state")?.value).toBe("in-use");
  });
});
