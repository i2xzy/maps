import { describe, expect, it } from "vitest";
import { formatJson } from "./format-json";

describe("formatJson", () => {
  it("keeps a value inline when it fits within maxWidth", () => {
    expect(formatJson({ a: 1, b: 2 }, 2, 80)).toBe(`{ "a": 1, "b": 2 }`);
    expect(formatJson([1, 2, 3], 2, 80)).toBe(`[1, 2, 3]`);
  });

  it("renders objects with inner spaces and arrays without", () => {
    expect(formatJson({ k: "v" })).toBe(`{ "k": "v" }`);
    expect(formatJson(["a", "b"])).toBe(`["a", "b"]`);
  });

  it("expands when the inline form exceeds maxWidth", () => {
    const out = formatJson({ alpha: 1, beta: 2, gamma: 3 }, 2, 10);
    expect(out).toBe(`{\n  "alpha": 1,\n  "beta": 2,\n  "gamma": 3\n}`);
  });

  it("expands the parent but re-tries children inline (compact cells in a wrapped row)", () => {
    const row = { cells: [{ kind: "station" }, { kind: "track" }], left: "a long-ish label here" };
    const out = formatJson(row, 2, 40);
    // parent wrapped …
    expect(out).toContain(`{\n  "cells":`);
    // … but each cell stayed on one line
    expect(out).toContain(`{ "kind": "station" }`);
    expect(out).toContain(`{ "kind": "track" }`);
  });

  it("drops undefined-valued keys", () => {
    expect(formatJson({ a: 1, b: undefined, c: 3 }, 2, 80)).toBe(`{ "a": 1, "c": 3 }`);
  });

  it("handles empty containers and primitives", () => {
    expect(formatJson({})).toBe("{}");
    expect(formatJson([])).toBe("[]");
    expect(formatJson("hi")).toBe(`"hi"`);
    expect(formatJson(42)).toBe("42");
    expect(formatJson(null)).toBe("null");
  });

  it("accounts for the key prefix column when deciding to expand", () => {
    // The array fits at column 0 but not once nested under a long key + indent.
    const value = { aReasonablyLongKeyName: [111, 222, 333, 444] };
    const out = formatJson(value, 2, 30);
    expect(out).toContain("[\n");
  });

  it("round-trips back to the same structure via JSON.parse", () => {
    const value = { rows: [{ cells: ["STR", { kind: "station" }], left: "x" }] };
    expect(JSON.parse(formatJson(value, 2, 20))).toEqual(value);
  });
});
