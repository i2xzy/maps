import { describe, expect, it } from "vitest";
import {
  ICON_FORMATIONS,
  ICON_STATES,
  ICON_SYSTEMS,
  ICON_WIDTHS,
  iconToCode,
  type IconKind,
  type IconObject,
} from "./icon";
import { FIELDS, fieldSpec, fieldsFor, isFieldVisible, previewOptions, safeIconCode } from "./descriptor";

// A minimal valid icon per modelled kind (the differential test's baseline).
const BASE: Record<string, IconObject> = {
  track: { kind: "track" },
  station: { kind: "station" },
  spacer: { kind: "spacer" },
  symbol: { kind: "symbol", subtype: "ferry" },
  junction: { kind: "junction" },
  crossing: { kind: "crossing" },
  crossover: { kind: "crossover" },
  hub: { kind: "hub" },
  shift: { kind: "shift" },
  end: { kind: "end" },
};
const MODELLED = Object.keys(BASE) as IconKind[];

const code = (o: IconObject): string => iconToCode(o);

describe("descriptor: enum values are sourced from the const maps (no drift)", () => {
  it("system / state / formation / width match the maps", () => {
    expect(fieldSpec("system")?.values).toEqual(ICON_SYSTEMS);
    expect(fieldSpec("state")?.values).toEqual(ICON_STATES);
    expect(fieldSpec("formation")?.values).toEqual(ICON_FORMATIONS);
    expect(fieldSpec("width")?.values).toEqual(ICON_WIDTHS);
  });
});

describe("descriptor: fieldsFor filters by kind", () => {
  it("offers kind-specific fields only for their kind", () => {
    const track = fieldsFor("track").map((f) => f.field);
    expect(track).toContain("continuation");
    expect(track).not.toContain("by"); // shift-only
    expect(fieldsFor("shift").map((f) => f.field)).toContain("by");
    expect(fieldsFor("crossing").map((f) => f.field)).toContain("roadClass");
    expect(fieldsFor("hub").map((f) => f.field)).not.toContain("formation");
  });
});

describe("descriptor: contextual visibility (isFieldVisible)", () => {
  const spec = (field: string) => fieldSpec(field as never)!;
  it("hides fields until their prerequisites are met", () => {
    // length only for an enclosed tunnel
    expect(isFieldVisible(spec("length"), { kind: "track" })).toBe(false);
    expect(isFieldVisible(spec("length"), { kind: "track", formation: "tunnel", entry: "both" })).toBe(true);
    // roadLanes only for a lane-bearing road class
    expect(isFieldVisible(spec("roadLanes"), { kind: "crossing" })).toBe(false);
    expect(isFieldVisible(spec("roadLanes"), { kind: "crossing", roadClass: "generic" })).toBe(true);
    expect(isFieldVisible(spec("roadLanes"), { kind: "crossing", roadClass: "major" })).toBe(true);
    expect(isFieldVisible(spec("roadLanes"), { kind: "crossing", roadClass: "dirt" })).toBe(false);
    // region only once motorway is chosen
    expect(isFieldVisible(spec("region"), { kind: "crossing", roadClass: "motorway" })).toBe(true);
    expect(isFieldVisible(spec("region"), { kind: "crossing", roadClass: "major" })).toBe(false);
    // a field with no prerequisites is always visible
    expect(isFieldVisible(spec("width"), { kind: "track" })).toBe(true);
  });
});

describe("descriptor: GUI helpers", () => {
  it("safeIconCode returns the code, or null instead of throwing", () => {
    expect(safeIconCode({ kind: "track", state: "disused" })).toBe("exSTR");
    expect(safeIconCode({ kind: "water" })).toBeNull(); // unmodelled kind would throw
  });

  it("offers concrete options for the geometry / variant fields (not empty dropdowns)", () => {
    // to / from ends: l / r / 1–4.
    expect(previewOptions({ kind: "track" }, "to").map((o) => o.value)).toEqual(["left", "right", 1, 2, 3, 4]);
    expect(previewOptions({ kind: "track" }, "to").find((o) => o.value === "left")?.code).toBe("STRl");
    // corner triangles.
    expect(previewOptions({ kind: "track" }, "corner").map((o) => o.value)).toEqual([1, 2, 3, 4]);
    // canal-lock track variant (LOCK1/2/3).
    const lock = { kind: "track", subtype: "lock" } as const;
    expect(previewOptions(lock, "variant").map((o) => o.value)).toEqual([1, 2, 3]);
    expect(previewOptions(lock, "variant").find((o) => o.value === 2)?.code).toBe("LOCK2");
  });

  it("previewOptions gives the code each option would produce", () => {
    const opts = previewOptions({ kind: "track" }, "width");
    expect(opts.find((o) => o.value === "half")?.code).toBe("dSTR");
    expect(opts.find((o) => o.value === "quarter")?.code).toBe("cSTR");
    // reflects the rest of the icon's state (contextual)
    const disused = previewOptions({ kind: "track", state: "disused" }, "width");
    expect(disused.find((o) => o.value === "half")?.code).toBe("exdSTR");
    // non-enum field -> no options
    expect(previewOptions({ kind: "track" }, "legend")).toEqual([]);
  });
});

// The differential drift guard: this is what keeps the hand-authored
// applicability table honest against iconToCode's actual branching.
describe("descriptor: differential drift vs iconToCode", () => {
  for (const spec of FIELDS) {
    if (spec.organizational || spec.sample == null) continue; // category / subtype / code
    const base = (kind: IconKind): IconObject => ({ ...BASE[kind]!, ...spec.requires });

    // Applicable kinds: toggling the field MUST change the emitted code.
    for (const kind of spec.kinds) {
      it(`${String(spec.field)} changes the code on ${kind}`, () => {
        expect(code({ ...base(kind), ...spec.sample })).not.toBe(code(base(kind)));
      });
    }

    // Kind-gated fields: toggling MUST be a no-op on every other modelled kind.
    if (spec.gated) {
      for (const kind of MODELLED) {
        if (spec.kinds.includes(kind)) continue;
        // `requires` can be an invalid combo on a non-applicable kind (e.g.
        // `subtype: "lock"` on `symbol`, which has no default root). A no-op
        // assertion is meaningless when the base itself doesn't serialize, so skip.
        if (safeIconCode(base(kind)) == null) continue;
        it(`${String(spec.field)} is a no-op on ${kind}`, () => {
          expect(code({ ...base(kind), ...spec.sample })).toBe(code(base(kind)));
        });
      }
    }
  }
});
