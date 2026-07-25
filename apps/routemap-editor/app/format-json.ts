/**
 * Pretty-print JSON, but keep an object/array on ONE line when its inline form
 * fits within `maxWidth` (plain JSON.stringify with an indent always fully
 * expands). Objects render with inner spaces — `{ "k": v }` — arrays without —
 * `[a, b]`. Things that don't fit expand, and their children are re-tried inline,
 * so e.g. a long row wraps while its `{ "kind": "station" }` cells stay compact.
 */

const inline = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return entries.length
    ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`
    : "{}";
};

export function formatJson(value: unknown, indent = 2, maxWidth = 80): string {
  // `col` is the column the value starts at — indentation PLUS any key prefix
  // (`"cells": `) — so the inline/expand decision reflects the real line width.
  const pretty = (v: unknown, level: number, col: number): string => {
    const oneLine = inline(v);
    if (v === null || typeof v !== "object" || col + oneLine.length <= maxWidth) {
      return oneLine;
    }
    const pad = " ".repeat(level * indent);
    const childPad = " ".repeat((level + 1) * indent);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      const items = v.map((x) => childPad + pretty(x, level + 1, childPad.length));
      return `[\n${items.join(",\n")}\n${pad}]`;
    }
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return "{}";
    const items = entries.map(([k, x]) => {
      const key = `${JSON.stringify(k)}: `;
      return `${childPad}${key}${pretty(x, level + 1, childPad.length + key.length)}`;
    });
    return `{\n${items.join(",\n")}\n${pad}}`;
  };
  return pretty(value, 0, 0);
}
