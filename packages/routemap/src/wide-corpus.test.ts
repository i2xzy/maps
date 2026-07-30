import { describe, expect, it } from "vitest";
import { fromWikitext, template } from "./from-wikitext";
import { toWikitext } from "./serialize";
import { expandableCall } from "./rint";
import wide from "./__fixtures__/wide-corpus.json";

/**
 * A second corpus, sampled ACROSS Wikipedia rather than gathered from one network.
 *
 * The 21-diagram fixture reports 100% round-trip and no placeholders, and both are true of those
 * diagrams. **28,012 pages transclude `{{Routemap}}`**, so 21 was 0.075% of it and heavily one
 * region's conventions. This is 68 diagrams / 1,725 rows sampled evenly across the transclusion
 * list (`scripts/build-diagram-corpus.mjs`), which is what makes it able to disagree.
 *
 * It exists to hold the numbers HONEST, so the floors here are lower than the narrow corpus's and
 * that is the point. Raise them as families are added; never lower them to make a change pass.
 */
const SLOTS = ["dist", "main", "remark", "outer"] as const;
const assign = (fields: string[], backwards: boolean): Record<string, unknown> => {
  const f = fields.map((x) => x.trim());
  while (f.length && f[f.length - 1] === "") f.pop();
  if (f.length === 0) return {};
  const ordered = backwards ? [...f].reverse() : f;
  if (ordered.length === 1) return ordered[0] ? { main: ordered[0]! } : {};
  const out: Record<string, unknown> = {};
  const extra = ordered.slice(SLOTS.length).filter(Boolean);
  if (extra.length) out.extra = extra;
  ordered.slice(0, SLOTS.length).forEach((v, i) => {
    if (v) out[SLOTS[i]!] = v;
  });
  return out;
};
/** A template name's first letter is case-insensitive to MediaWiki, so `{{Rint}}` is `{{rint}}`.
 *  We emit the lower-case form; comparing verbatim called 17 rows failures for it. */
const nameCase = (s: string) => s.replace(/\{\{\s*(\w)/g, (_m, c) => `{{${String(c).toLowerCase()}`);
const canon = (line0: string): string => {
  const line = nameCase(line0);
  const at = line.indexOf("! !");
  const rf = (at >= 0 ? line.slice(at + 3) : line).split("~~");
  const icons = (rf.shift() ?? "").trim();
  return JSON.stringify({
    left: assign((at >= 0 ? line.slice(0, at) : "").split("~~"), true),
    icons,
    right: assign(rf, false),
  });
};
const roundTrip = (line: string): string => {
  const d = fromWikitext(line);
  return toWikitext({ ...d, rows: d.rows.map((r) => ({ ...r, src: undefined })) });
};

const rows = Object.entries(wide as Record<string, string>).flatMap(([title, body]) =>
  body.split("\n").filter((l) => l.trim()).map((line) => ({ title, line })),
);

describe("wide corpus", () => {
  it("never throws on a real row", () => {
    // A parser that crashes makes a whole diagram unopenable; misreading one row is survivable.
    for (const { title, line } of rows) {
      expect(() => roundTrip(line), `${title}: ${line}`).not.toThrow();
    }
  });

  it("preserves at least 99% of rows, semantically", () => {
    // 1,722 of 1,725 at the time of writing. The three that don't are self-closing `<br/>` in a
    // label and a `-colspan-2` directive.
    const kept = rows.filter(({ line }) => canon(roundTrip(line)) === canon(line));
    expect(kept.length / rows.length).toBeGreaterThan(0.99);
  });

  it("resolves at least 75% of the templates real diagrams use", () => {
    // 79% at the time of writing, up from 59% before this corpus existed — widening it found five
    // station-link families (njts, lrts, bmts, mrts, sta) and {{BSflag}} that the narrow corpus
    // simply didn't contain. The narrow corpus reports 100%, which was only ever true of itself.
    const WRAP = new Set(["left", "right", "small", "float", "center", "bs1/2"]);
    const SPACE = new Set(["0", "pad"]);
    const handled = (raw: string): boolean => {
      let t = raw.trim();
      const marked = /^('{2,5})([\s\S]+)\1$/.exec(t);
      if (marked) t = (marked[2] ?? "").trim();
      if (expandableCall(t) != null) return true;
      if (/^\[\[\s*(File|Image)\s*:/i.test(t)) return true;
      const f = template(t);
      const tpl = f?.name.includes("{{!}}") ? template(t.replace(/\{\{!\}\}/g, "|")) : f;
      const n = tpl?.name.trim().toLowerCase();
      if (!n) return false;
      if (n === "bsto" || n === "bssplit" || SPACE.has(n)) return true;
      const pos = (tpl?.args ?? []).filter((a) => !/^\s*[a-z][\w-]*\s*=/i.test(a));
      return WRAP.has(n) && pos.length > 0;
    };
    let total = 0;
    let ok = 0;
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (typeof o.raw === "string") {
          total++;
          if (handled(o.raw)) ok++;
        } else Object.values(o).forEach(walk);
      }
    };
    for (const body of Object.values(wide as Record<string, string>)) fromWikitext(body).rows.forEach(walk);
    expect(total).toBeGreaterThan(400); // the corpus really does contain them
    expect(ok / total).toBeGreaterThan(0.75);
  });
});
