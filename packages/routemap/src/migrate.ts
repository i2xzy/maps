/**
 * Bring a diagram written against the old label shape up to date.
 *
 * Logos used to live in an `icons` array in three places — on a side label, on a text
 * run, and on a colspan row — and they are now `{ icon }` runs. Nothing throws when an
 * old diagram is loaded: the field is simply unread, so the logos vanish from the
 * render AND from the emitted wikitext with no error at all. That silence is why this
 * exists.
 *
 * The conversion reproduces exactly where the old serializer put those logos, so a
 * migrated diagram emits the same wikitext it always did:
 *
 *   - a LEFT label led with its logos, then a space, then the text
 *   - a RIGHT label ended with them, after a space
 *   - a colspan row was treated as a left label
 *   - a RUN's logos trailed its own text, after a space — and a run with no text of its
 *     own contributed no space, because the neighbouring text carried it
 *   - several logos in one array were separated by single spaces
 *
 * Idempotent, and it leaves a diagram that is already current untouched.
 */
import type {
  ColspanRow,
  DiagramRow,
  GridRow,
  LabelIcon,
  RouteDiagram,
  SideLabel,
  SideSlots,
  TextRun,
} from "./types";
import { SLOT_NAMES } from "./normalize";

/** The old shapes, as they appear in a document written before the change. */
type LegacyIcons = { icons?: LabelIcon | LabelIcon[] };
type LegacyRun = Extract<TextRun, { text?: string }> & LegacyIcons;
type LegacySide = Extract<SideLabel, { text?: unknown }> & LegacyIcons;

const iconList = (v: LabelIcon | LabelIcon[] | undefined): LabelIcon[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

/** `[a, b]` -> `[{icon:a}, " ", {icon:b}]` — the single spaces the old code joined with. */
const iconRuns = (icons: LabelIcon[]): TextRun[] =>
  icons.flatMap((icon, i) => (i ? [" ", { icon }] : [{ icon }]));

/** Whether anything in this value still carries an `icons` field. */
export function needsMigration(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(needsMigration);
  if ("icons" in value) return true;
  return Object.values(value).some(needsMigration);
}

/** One run -> runs: its own text first, then its logos, matching the old order. */
function migrateRun(run: TextRun): TextRun[] {
  if (typeof run !== "object" || run == null) return [run];
  if ("split" in run) {
    return [{ split: run.split.map((line) => (typeof line === "string" ? line : migrateRuns(line))) }];
  }
  if ("br" in run || "icon" in run) return [run];

  const { icons, ...rest } = run as LegacyRun;
  const list = iconList(icons);
  if (list.length === 0) return [run];

  // A run with no text contributed no space of its own; one with text got exactly one
  // between the text and the first logo.
  const hasBody = !!rest.text || !!rest.rws;
  const body: TextRun[] = hasBody ? [rest as TextRun] : [];
  return [...body, ...(hasBody ? [" " as TextRun] : []), ...iconRuns(list)];
}

/**
 * Tidy a run list: drop object wrappers that carry nothing, then merge adjacent text.
 *
 * `{ text: " Hello" }` with no marks IS the string `" Hello"`, and two plain strings
 * side by side are one string — so migration output reads the way a person would have
 * written it rather than showing the seams of the conversion.
 *
 * Collapsing to a STRING rather than to a single object also matters: an object run's
 * `text` and a bare string are handled slightly differently downstream, and the string
 * is the form with no surprises.
 */
function tidyRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    // An object whose only meaningful field is `text` is just that text.
    const bare =
      run != null &&
      typeof run === "object" &&
      !("split" in run) &&
      !("br" in run) &&
      !("icon" in run) &&
      typeof run.text === "string" &&
      Object.keys(run).filter((k) => run[k as keyof typeof run] !== undefined).length === 1
        ? run.text
        : run;

    const prev = out[out.length - 1];
    if (typeof bare === "string" && typeof prev === "string") out[out.length - 1] = prev + bare;
    else out.push(bare);
  }
  return out.filter((r) => r !== "");
}

const migrateRuns = (runs: TextRun[]): TextRun[] => tidyRuns(runs.flatMap(migrateRun));

/** Text (string or runs) as runs, with any run-level logos moved out. */
function textAsRuns(text: string | TextRun[] | undefined): TextRun[] {
  if (text == null || text === "") return [];
  return typeof text === "string" ? [text] : migrateRuns(text);
}

/**
 * One side (or a colspan row's body) -> the current shape.
 *
 * `edge` is where the old code placed whole-label logos. A colspan row used the left
 * rule, because that is the direction the old serializer passed for one.
 */
function migrateSide(side: SideLabel | SideSlots | null | undefined, edge: "left" | "right"): SideLabel | SideSlots | null | undefined {
  if (side == null || typeof side === "string") return side;
  if (Array.isArray(side)) {
    const runs = migrateRuns(side);
    return runs.length === side.length && runs.every((r, i) => r === side[i]) ? side : runs;
  }
  if (SLOT_NAMES.some((n) => n in side)) {
    const slots = side as SideSlots;
    const out: SideSlots = {};
    for (const name of SLOT_NAMES) {
      if (name in slots) out[name] = migrateSide(slots[name], edge) as SideLabel | null;
    }
    return out;
  }

  const { icons, ...rest } = side as LegacySide;
  const list = iconList(icons);
  const inner = textAsRuns(rest.text as string | TextRun[] | undefined);

  // Whole-label `link`/`rws` moved onto the text run. Left where they were, they would
  // apply to a label whose `text` is now an ARRAY — and the serializer only honours a
  // label-level link when `text` is a plain string, so the link would be dropped.
  let runs = inner;
  if (typeof rest.text === "string" && rest.link != null) {
    runs = [{ text: rest.text, link: rest.link }];
    delete (rest as { link?: unknown }).link;
  } else if (inner.length === 0 && rest.rws) {
    runs = [{ rws: rest.rws }];
    delete (rest as { rws?: unknown }).rws;
  }

  if (list.length === 0) {
    // Nothing to move, but a nested run may still have needed it.
    return runs === inner && !needsMigration(side) ? side : collapse({ ...rest, text: runs });
  }

  const logos = iconRuns(list);
  const gap: TextRun[] = runs.length ? [" "] : [];
  const text = edge === "left" ? [...logos, ...gap, ...runs] : [...runs, ...gap, ...logos];
  return collapse({ ...rest, text });
}

/**
 * `{ text: [...] }` with nothing else on it is just `[...]`.
 *
 * The wrapper carried `icons` and the whole-label fields; once those are gone or moved
 * onto runs there is usually nothing left to wrap, and the bare array is the shape a
 * person would have written.
 */
function collapse(side: Extract<SideLabel, { text?: unknown }>): SideLabel {
  const keys = Object.keys(side).filter((k) => side[k as keyof typeof side] !== undefined);
  return keys.length === 1 && keys[0] === "text" && Array.isArray(side.text) ? side.text : side;
}

function migrateRow(row: DiagramRow): DiagramRow {
  if ((row as ColspanRow).type === "colspan") {
    const colspan = row as ColspanRow & LegacyIcons;
    const migrated = migrateSide(
      { text: colspan.text, rws: colspan.rws, link: colspan.link, icons: colspan.icons } as SideLabel,
      "left", // the old serializer passed "left" for a colspan row
    );
    const rest = { ...colspan };
    delete rest.icons; // consumed into the text runs above
    // `collapse` may have handed back a bare run array — that IS the text. Treating an
    // array as "not migrated" here silently dropped the row's logos.
    if (Array.isArray(migrated)) return { ...rest, text: migrated } as ColspanRow;
    if (migrated == null || typeof migrated !== "object") return row;
    const body = migrated as Extract<SideLabel, { text?: unknown }>;
    return { ...rest, text: body.text, rws: body.rws, link: body.link } as ColspanRow;
  }
  const grid = row as GridRow;
  return { ...grid, left: migrateSide(grid.left, "left"), right: migrateSide(grid.right, "right") };
}

/** Migrate a whole diagram. Safe to call on one that is already current. */
export function migrateDiagram(diagram: RouteDiagram): RouteDiagram {
  if (!needsMigration(diagram)) return diagram;
  return { ...diagram, rows: (diagram.rows ?? []).map(migrateRow) };
}
