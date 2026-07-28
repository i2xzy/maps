/**
 * Read a `{{Routemap}}` `map=` body into a `RouteDiagram`.
 *
 * Ported from `Module:Routemap`, which is the reference parser — its own grammar
 * comment is the shape below, and the field ORDER and COUNT rules come from its code
 * rather than from the prose documentation, which glosses over both:
 *
 *   rowProps~~linfo4~~linfo3~~linfo2~~linfo1! !(icons)~~rinfo1~~rinfo2~~rinfo3~~rinfo4~~rowProps
 *
 * The left part is read BACKWARDS from `! !` and the right part forwards from the
 * icons, so a field's meaning depends on how many there are. One field is always
 * `main` ("assume only linfo2 was provided"), never `dist`.
 *
 * LOSSLESSNESS IS THE POINT. Once a user can edit wikitext, anything this drops is
 * destroyed on the next serialize. So anything not understood is preserved verbatim
 * rather than discarded — an unrecognised BSicon code stays a code string, and text
 * this can't decompose stays one raw run. `roundTripReport` in the test suite is what
 * proves it, by diffing real diagrams.
 */
import type {
  Cell,
  CellIcon,
  DiagramRow,
  MapParam,
  RouteDiagram,
  SideSlots,
  SideLabel,
  TextRun,
} from "./types";
import { SLOT_NAMES, type SlotName } from "./normalize";

/** Split on a separator, ignoring any that fall inside `{{…}}` or `[[…]]`. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith("{{", i) || s.startsWith("[[", i)) {
      depth++;
      i++;
      continue;
    }
    if (s.startsWith("}}", i) || s.startsWith("]]", i)) {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (depth === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(start, i));
      i += sep.length - 1;
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/** One `{{name|args}}` at the very start of `s`, or null. */
function template(s: string): { name: string; args: string[]; length: number } | null {
  if (!s.startsWith("{{")) return null;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith("{{", i) || s.startsWith("[[", i)) {
      depth++;
      i++;
      continue;
    }
    if (s.startsWith("}}", i) || s.startsWith("]]", i)) {
      depth--;
      i++;
      if (depth === 0) {
        const inner = s.slice(2, i - 1);
        const parts = splitTop(inner, "|");
        return { name: parts[0] ?? "", args: parts.slice(1), length: i + 1 };
      }
      continue;
    }
  }
  return null;
}

/** One `[[target|display]]` at the start of `s`, or null. */
function wikilink(s: string): { target: string; display?: string; length: number } | null {
  if (!s.startsWith("[[")) return null;
  const end = s.indexOf("]]");
  if (end < 0) return null;
  const parts = splitTop(s.slice(2, end), "|");
  return {
    target: (parts[0] ?? "").trim(),
    display: parts.length > 1 ? parts.slice(1).join("|") : undefined,
    length: end + 2,
  };
}

/**
 * Label text -> runs.
 *
 * Emits the smallest thing that round-trips: a plain stretch stays a bare string, and
 * marks/links/templates become object runs. `{{!}}` comes back as the `\|` escape the
 * model uses for a literal pipe, since a bare `|` here would mean a line break.
 */
export function parseLabelText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let plain = "";
  const flush = () => {
    if (plain) runs.push(plain);
    plain = "";
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    if (rest.startsWith("<br")) {
      const end = rest.indexOf(">");
      if (end >= 0) {
        flush();
        runs.push({ br: true });
        i += end + 1;
        continue;
      }
    }

    const tpl = template(rest);
    if (tpl) {
      const name = tpl.name.trim().toLowerCase();
      if (name === "!") {
        // A literal pipe. The model escapes it so it isn't read as a line break.
        plain += "\\|";
        i += tpl.length;
        continue;
      }
      if (name === "rint" || name === "rail-interchange") {
        flush();
        runs.push({ icon: tpl.args.map((a) => a.trim()).join("|") });
        i += tpl.length;
        continue;
      }
      if (name === "rws" || name === "rail-interchange-station") {
        flush();
        runs.push({ rws: tpl.args.join("|").trim() });
        i += tpl.length;
        continue;
      }
      if (name === "bssplit") {
        flush();
        runs.push({ split: tpl.args.map((a) => parseLabelText(a)) });
        i += tpl.length;
        continue;
      }
      // Any other template — {{BSto}}, {{tram}}, hundreds more — kept whole. Its pipes
      // are arguments; left as plain text the serializer would read them as line breaks
      // and wrap the whole thing in a {{BSsplit}}.
      flush();
      runs.push({ raw: rest.slice(0, tpl.length) });
      i += tpl.length;
      continue;
    }

    const link = wikilink(rest);
    if (link && /^(file|image):/i.test(link.target)) {
      // `[[File:X|20px|link=|alt=|X]]` is an image with parameters. Those pipes are
      // parameters, so it goes through verbatim rather than as a link with a display.
      flush();
      runs.push({ raw: rest.slice(0, link.length) });
      i += link.length;
      continue;
    }
    if (link) {
      flush();
      runs.push(
        link.display != null && link.display !== link.target
          ? { text: link.display, link: link.target }
          : { text: link.target, link: true },
      );
      i += link.length;
      continue;
    }

    // `'''bold'''` / `''italic''`. Bold is tested FIRST because `'''` also starts with
    // `''`, and the match must `break` out — running both arms wrapped the same text
    // twice, turning `'''Stations'''` into `'''Stations''''''Stations''`.
    let marked = false;
    for (const [mark, key] of [
      ["'''", "bold"],
      ["''", "italic"],
    ] as const) {
      if (!rest.startsWith(mark)) continue;
      const end = rest.indexOf(mark, mark.length);
      if (end < 0) continue;
      flush();
      const inner = parseLabelText(rest.slice(mark.length, end));
      // Marks go on a run, but the source wrote ONE pair of quotes around the whole
      // span — so a span of several runs would come back with a pair around each, which
      // is a different string. Hence: a single run that can carry a mark (text, a link,
      // or `{ rws }`, all of which the serializer wraps after building their body) is
      // marked; anything else goes through whole.
      const only = inner.length === 1 ? inner[0] : undefined;
      const markable =
        only !== undefined &&
        (typeof only === "string" ||
          !("icon" in only || "raw" in only || "split" in only || "br" in only));
      if (markable) {
        runs.push(
          typeof only === "string"
            ? ({ text: only, [key]: true } as TextRun)
            : ({ ...only, [key]: true } as TextRun),
        );
      } else {
        runs.push({ raw: rest.slice(0, end + mark.length) });
      }
      i += end + mark.length;
      marked = true;
      break;
    }
    if (marked) continue;

    plain += text[i];
    i++;
  }
  flush();
  return runs;
}

/** A label field -> the simplest value that round-trips it: a string, or runs. */
function parseLabel(field: string): string | TextRun[] | undefined {
  const text = field.trim();
  if (!text) return undefined;
  const runs = parseLabelText(text);
  if (runs.length === 1 && typeof runs[0] === "string") return runs[0];
  return runs;
}

/** One icon-strip field -> cells, overlays kept as a stack. */
function parseCells(strip: string): Cell[] {
  return splitTop(strip, "\\").map((cell) => {
    // Empty layers are KEPT once there's more than one: `!~vHST` is an empty base with
    // an overlay on top, and dropping the blank turns it into a plain cell.
    const layers = splitTop(cell, "!~").map((c) => c.trim());
    if (layers.every((c) => c === "")) return null;
    if (layers.length === 1) return layers[0] as CellIcon;
    return layers as CellIcon[];
  });
}

/** Assign the LEFT fields, which the module reads backwards from `! !`. */
function leftSlots(part: string): SideSlots {
  const f = splitTop(part, "~~");
  const out: SideSlots = {};
  const set = (name: SlotName, raw: string | undefined) => {
    const v = raw == null ? undefined : parseLabel(raw);
    if (v !== undefined) out[name] = v;
  };
  if (f.length <= 1) {
    // "assume only linfo2 was provided" — one field is main, never dist.
    set("main", f[0]);
    return out;
  }
  set("dist", f[f.length - 1]);
  set("main", f[f.length - 2]);
  if (f.length > 2) set("remark", f[f.length - 3]);
  if (f.length > 3) set("outer", f[f.length - 4]);
  return out;
}

/** Assign the RIGHT fields, which run forwards from the icon strip. */
function rightSlots(fields: string[]): SideSlots {
  const out: SideSlots = {};
  const set = (name: SlotName, raw: string | undefined) => {
    const v = raw == null ? undefined : parseLabel(raw);
    if (v !== undefined) out[name] = v;
  };
  if (fields.length <= 1) {
    set("main", fields[0]);
    return out;
  }
  set("dist", fields[0]);
  set("main", fields[1]);
  if (fields.length > 2) set("remark", fields[2]);
  if (fields.length > 3) set("outer", fields[3]);
  return out;
}

/** A side with only `main` is written as that label; otherwise as slots. */
function sideValue(slots: SideSlots): SideLabel | SideSlots | undefined {
  const filled = SLOT_NAMES.filter((n) => slots[n] !== undefined);
  if (filled.length === 0) return undefined;
  if (filled.length === 1 && filled[0] === "main") return slots.main ?? undefined;
  return slots;
}

/** Parse one map line into a row. */
function parseRow(line: string): DiagramRow | null {
  const colspan = /^-colspan(?:-(\d+))?/.exec(line.trim());
  if (colspan) return { type: "colspan" };

  const parts = splitTop(line, "! !");
  const hasLeft = parts.length > 1;
  const left = hasLeft ? (parts[0] as string) : "";
  const right = hasLeft ? parts.slice(1).join("! !") : line;

  const rightFields = splitTop(right, "~~");
  const cells = parseCells(rightFields[0] ?? "");

  const row: DiagramRow = { cells };
  const l = sideValue(leftSlots(left));
  const r = sideValue(rightSlots(rightFields.slice(1)));
  if (l !== undefined) row.left = l;
  if (r !== undefined) row.right = r;
  return row;
}

/**
 * Parse a `{{Routemap}}` `map=` body (the row lines, no template wrapper).
 *
 * Blank lines are dropped; a `-colspan-` marker starts a full-width row whose text is
 * the line that follows it, which is how the template writes one.
 */
export function fromWikitext(body: string): RouteDiagram {
  const rows: DiagramRow[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim() === "") continue;
    if (/^-colspan/.test(line.trim())) {
      const text = parseLabel(lines[++i] ?? "");
      rows.push({ type: "colspan", ...(text !== undefined ? { text } : {}) });
      continue;
    }
    const row = parseRow(line);
    if (row) rows.push(row);
  }
  return { rows };
}

/* ------------------------------------------------------------------ */
/* the {{Routemap}} call around the body                               */
/* ------------------------------------------------------------------ */

/**
 * Parse a whole `{{Routemap|…|map=…}}` call.
 *
 * Every param is kept verbatim and in order, `map` included as the marker for where the
 * rows belong. Nothing is interpreted — a `title` this "understood" would be a `title`
 * it could silently reformat, and the params it has never heard of (`legend`, `top`,
 * `navbar`, per-page styling) are the ones a wikitext editor would otherwise destroy.
 */
export function fromRoutemap(src: string): RouteDiagram {
  const tpl = template(src.trim());
  if (!tpl) return fromWikitext(src);

  const params: MapParam[] = [];
  let body = "";
  for (const arg of tpl.args) {
    // The FIRST `=` at bracket depth 0 splits name from value; a value may contain more
    // (`top=<div style="text-align: center;">`), and a positional param contains none.
    const eq = splitTop(arg, "=");
    if (eq.length < 2) {
      params.push({ name: "", value: arg });
      continue;
    }
    // Name kept VERBATIM: real diagrams write `|navbar = X`, and normalising the space
    // round the `=` is a diff across every line of every wrapper. Use `mapParam` to look
    // one up rather than comparing `name` directly.
    const name = eq[0] as string;
    const value = arg.slice(name.length + 1);
    if (name.trim() === "map") body = value;
    // The map value is stored VERBATIM rather than blanked, so its surrounding newlines
    // survive — `map=\n<rows>\n}}` is how every real diagram is laid out, and the rows
    // get spliced between that leading and trailing whitespace on the way out.
    //
    // Only `map` is parsed into rows. `{{Routemap}}` also takes `map2`, `map3`… and
    // those keep their text verbatim here: lossless, but not editable as rows yet.
    params.push({ name, value });
  }
  // `template` keeps whatever followed `{{` verbatim, newline included, because that is
  // how real diagrams are laid out and a rebuild has to reproduce it.
  return { ...fromWikitext(body), map: { template: tpl.name, params } };
}

/** Rebuild the `{{Routemap}}` call. Body-only diagrams come back as bare rows. */
export function toRoutemap(diagram: RouteDiagram, body: string): string {
  const meta = diagram.map;
  if (!meta?.params?.length) return body;
  const args = meta.params.map((p) => {
    if (p.name.trim() === "map") {
      const lead = /^\s*/.exec(p.value)?.[0] ?? "";
      const trail = /\s*$/.exec(p.value)?.[0] ?? "";
      return `${p.name}=${lead}${body}${trail}`;
    }
    return p.name === "" ? p.value : `${p.name}=${p.value}`;
  });
  return `{{${meta.template ?? "Routemap"}${args.map((a) => `|${a}`).join("")}}}`;
}

/** Look up a wrapper param by name, ignoring the whitespace authors put round the `=`. */
export function mapParam(diagram: RouteDiagram, name: string): string | undefined {
  return diagram.map?.params?.find((p) => p.name.trim() === name)?.value;
}
