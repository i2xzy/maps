/**
 * Field descriptor — the metadata that drives the visual editor's controls.
 *
 * For each editable field of an `IconObject` it records: the control type, the
 * kinds it applies to, the enum values (sourced from the const maps / unions so
 * they never drift), any mutual-exclusion constraint, and a `sample`/`requires`
 * pair used by the differential drift test in `descriptor.test.ts`.
 *
 * Source-of-truth note: field *applicability* is not derivable from `ROOTS`
 * (which only knows roots/subtypes) — it lives in `iconToCode`'s branches. So
 * this table is hand-authored and GUARDED behaviourally: the differential test
 * asserts that every (field, kind) marked applicable actually changes the code,
 * and that every kind-`gated` field is a no-op on the kinds it doesn't apply to.
 * That catches drift the moment `iconToCode` and this table disagree.
 */
import {
  ICON_FORMATIONS,
  ICON_STATES,
  ICON_SYSTEMS,
  ICON_WIDTHS,
  iconSubtypes,
  iconToCode,
  type IconKind,
  type IconObject,
} from "./icon";

/** How the GUI renders a field. */
export type FieldControl = "enum" | "toggle" | "number" | "end" | "corner";

export interface FieldSpec {
  /** The `IconObject` key this controls. */
  field: keyof IconObject;
  /** How to render it. */
  control: FieldControl;
  /** Kinds the field is offered for (semantic applicability). */
  kinds: readonly IconKind[];
  /** Enum options (for `control: "enum"`), or `1|2|4`-style for numbers. */
  values?: readonly (string | number)[];
  /** Human label for the control. */
  label?: string;
  /** `true` when the field is only emitted for its `kinds` (a kind-gated branch
   *  in `iconToCode`) — the differential test then also asserts it's a no-op on
   *  every other kind. `false`/absent for prefixes that emit regardless of kind
   *  (we only assert applies-changes for those). */
  gated?: boolean;
  /** Organizational only — the serializer ignores it (e.g. `category`). Excluded
   *  from the differential output test. */
  organizational?: boolean;
  /** A value that must change the code when applied to an applicable kind — the
   *  differential test's toggle. Omitted for `subtype`/`code` (handled apart). */
  sample?: Partial<IconObject>;
  /** Companion fields the `sample` needs to take effect (applied to both sides
   *  of the differential comparison), e.g. `length` needs an enclosed tunnel. */
  requires?: Partial<IconObject>;
  /** Mutual-exclusion for the GUI: disable this control when it returns true. */
  disabledWhen?: (icon: IconObject) => boolean;
  /** Contextual visibility: only offer the field when this returns true. Defaults
   *  to "`requires` are satisfied" (or always, if no `requires`). */
  showWhen?: (icon: IconObject) => boolean;
  /**
   * The value the unset option should sit AFTER in the list.
   *
   * For an ordered scale, the unset state has a position rather than being "first". The widths
   * run eighth -> octuple and full is 1, so "Full" belongs between three-quarter and double;
   * at the head of the list it reads as another extreme instead of the middle of the scale.
   */
  defaultAfter?: string;
  /**
   * What to call the UNSET state, when no option means the same thing.
   *
   * `width` has no "full" among its fractions and `formation` no "at grade", so leaving those
   * unset is a real choice with no name in the value list. Only set where the domain gives a
   * clear word; anything else falls back to "None", which is accurate — the affix is absent —
   * without inventing a claim about what the icon then is.
   */
  defaultLabel?: string;
}

/** Whether the GUI should offer a field given the icon's current other values. */
export function isFieldVisible(spec: FieldSpec, icon: IconObject): boolean {
  if (spec.showWhen) return spec.showWhen(icon);
  if (!spec.requires) return true;
  return Object.entries(spec.requires).every(
    ([k, v]) => icon[k as keyof IconObject] === v,
  );
}

const LINE_KINDS: readonly IconKind[] = [
  "track",
  "station",
  "junction",
  "crossing",
  "crossover",
  "end",
];

/**
 * The editable fields. `kind`, `subtype` and `code` are handled outside this
 * table (kind is the primary selector; subtype comes from `iconSubtypes(kind)`;
 * code is the raw escape hatch).
 */
export const FIELDS: readonly FieldSpec[] = [
  // ── prefixes (colour / state / line-type / width) ────────────────────
  {
    field: "system",
    control: "enum",
    values: ICON_SYSTEMS,
    kinds: [...LINE_KINDS, "shift"],
    sample: { system: "metro" },
  },
  {
    field: "state",
    control: "enum",
    values: ICON_STATES,
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift", "symbol", "hub", "end"],
    sample: { state: "disused" },
  },
  {
    field: "formation",
    control: "enum",
    // A line with no formation affix runs on the surface.
    defaultLabel: "At grade",
    values: ICON_FORMATIONS,
    kinds: LINE_KINDS,
    sample: { formation: "tunnel" },
  },
  {
    field: "legend",
    control: "toggle",
    kinds: LINE_KINDS,
    sample: { legend: true },
  },
  {
    field: "width",
    control: "enum",
    values: ICON_WIDTHS,
    // The widths are fractions OF full, and there is no "full" among them.
    defaultLabel: "Full",
    defaultAfter: "three-quarter", // full is 1: after 3/4, before double
    kinds: [...LINE_KINDS, "shift", "symbol", "spacer"],
    sample: { width: "half" },
  },
  // ── root-adjacent line-form modifiers ────────────────────────────────
  {
    field: "stub",
    control: "toggle",
    kinds: ["track", "station"],
    sample: { stub: true },
  },
  {
    field: "continuation",
    control: "toggle",
    kinds: ["track"],
    gated: true,
    sample: { continuation: true },
  },
  {
    field: "interrupted",
    control: "toggle",
    kinds: ["track"],
    sample: { interrupted: true },
  },
  {
    field: "interruptedCorners",
    control: "toggle",
    kinds: ["track"],
    sample: { interruptedCorners: true },
  },
  {
    field: "curve",
    control: "enum",
    values: ["wide", "sBend"],
    kinds: ["track"],
    sample: { curve: "wide" },
  },
  {
    field: "length",
    control: "enum",
    values: ["long", "short"],
    kinds: ["track"],
    gated: true,
    requires: { formation: "tunnel", entry: "both" }, // enclosed tunnel
    sample: { length: "short" },
  },
  // ── parallel double track ────────────────────────────────────────────
  {
    field: "parallel",
    control: "toggle",
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift"],
    sample: { parallel: true },
  },
  {
    field: "lane",
    control: "enum",
    values: ["left", "right"],
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift"],
    sample: { lane: "left" },
  },
  // ── geometry ─────────────────────────────────────────────────────────
  {
    field: "to",
    control: "end",
    // IconEnd = "left" | "right" | 1–4 (a single end; arrays like KRZlr stay JSON-only).
    values: ["left", "right", 1, 2, 3, 4],
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift", "end"],
    sample: { to: "left" },
  },
  {
    field: "from",
    control: "end",
    values: ["left", "right", 1, 2, 3, 4],
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift", "end"],
    sample: { from: "left" },
  },
  {
    field: "direction",
    control: "enum",
    values: ["forward", "back"],
    kinds: ["track", "shift"],
    sample: { direction: "back" },
  },
  {
    field: "corner",
    control: "corner",
    // A single corner 1–4 (pairs like SHI2c14 stay JSON-only).
    values: [1, 2, 3, 4],
    kinds: ["track", "junction", "shift"],
    sample: { corner: 2 },
  },
  {
    field: "cornerAdd",
    control: "toggle",
    kinds: ["track", "junction", "shift"],
    requires: { corner: 2 },
    sample: { cornerAdd: true },
  },
  {
    field: "entry",
    control: "enum",
    values: ["start", "end", "both"],
    kinds: ["track", "station", "crossing", "crossover", "hub", "symbol", "end"],
    sample: { entry: "start" },
  },
  {
    field: "transverse",
    control: "toggle",
    kinds: ["track", "station", "junction", "crossing", "crossover", "hub", "symbol", "shift", "end"],
    sample: { transverse: true },
  },
  {
    field: "through",
    control: "toggle",
    // Checking it emits `through: false` (drops the straight leg, ABZg -> ABZ), so
    // the box reads as "branch only" — the field name "through" would be backwards.
    label: "branch only (no through line)",
    kinds: ["junction"],
    gated: true,
    sample: { through: false }, // ABZg -> ABZ
  },
  // ── connectors / positioning ─────────────────────────────────────────
  {
    field: "connect",
    control: "enum",
    values: ["left", "right", "both"],
    kinds: ["station"],
    sample: { connect: "left" },
  },
  {
    field: "offset",
    control: "enum",
    values: ["forward", "back"],
    kinds: ["track", "station", "symbol", "junction", "crossing", "crossover"],
    sample: { offset: "forward" },
  },
  {
    field: "offsetTarget",
    control: "enum",
    values: ["secondary", "auxiliary"],
    kinds: ["track", "station", "symbol", "junction", "crossing", "crossover"],
    requires: { offset: "forward" },
    sample: { offsetTarget: "auxiliary" }, // @F -> @f
  },
  {
    // A coloured variant is a different FILE (`BSicon STRq green.svg`), so it applies to
    // whatever has one — not gated, since `iconToCode` appends it whatever the kind.
    //
    // The values are the ones real diagrams use, commonest first. The FIELD is an open
    // string, so a colour outside this list still round-trips; it just isn't offered in the
    // dropdown, and picking from the list is the only way the form changes it.
    field: "colour",
    control: "enum",
    values: ["red", "blue", "maroon", "yellow", "saffron", "green", "grey", "brown", "cerulean", "white"],
    kinds: ["track", "station", "junction", "crossing", "crossover", "shift", "symbol", "hub", "end"],
    sample: { colour: "red" },
  },
  // ── crossing / crossover ─────────────────────────────────────────────
  {
    field: "level",
    control: "enum",
    values: ["over", "under"],
    kinds: ["track", "crossing", "crossover"],
    gated: true,
    sample: { level: "over" },
    disabledWhen: (i) => i.formation === "elevated", // an elevated line is already over
  },
  {
    field: "crosses",
    control: "enum",
    values: ["water"],
    kinds: ["crossing"],
    gated: true,
    sample: { crosses: "water" },
  },
  {
    field: "roadClass",
    control: "enum",
    values: ["generic", "dirt", "minor", "major", "motorway", "autobahn", "white"],
    kinds: ["crossing"],
    gated: true,
    sample: { roadClass: "motorway" },
  },
  {
    field: "roadLanes",
    control: "number",
    values: [1, 2, 4],
    kinds: ["crossing"],
    gated: true,
    requires: { roadClass: "generic" }, // test companion
    showWhen: (i) => i.roadClass === "generic" || i.roadClass === "major", // lane-bearing classes
    sample: { roadLanes: 2 },
  },
  {
    field: "region",
    control: "enum",
    values: ["uk", "gb"],
    kinds: ["crossing"],
    gated: true,
    requires: { roadClass: "motorway" },
    sample: { region: "uk" }, // SKRZ-M -> SKRZ-B
  },
  // ── shift ────────────────────────────────────────────────────────────
  {
    field: "by",
    control: "number",
    values: [1, 2, 3, 4, 5, 6, 8],
    kinds: ["shift"],
    gated: true,
    sample: { by: 1 }, // SHI2 -> SHI1
  },
  {
    field: "doubleRow",
    control: "toggle",
    kinds: ["shift"],
    sample: { doubleRow: true },
  },
  // ── station / symbol ─────────────────────────────────────────────────
  {
    field: "accessible",
    control: "toggle",
    kinds: ["station"],
    gated: true,
    sample: { accessible: true },
  },
  {
    field: "variant",
    control: "number",
    values: [1, 2, 3], // LOCK1 / LOCK2 / LOCK3
    kinds: ["track"],
    gated: true,
    requires: { subtype: "lock" }, // canal lock
    sample: { variant: 2 }, // LOCK -> LOCK2
  },
  {
    field: "category",
    control: "enum",
    values: ["transport", "building", "scenic", "infrastructure"],
    kinds: ["symbol"],
    organizational: true, // serializer ignores it; picker grouping only
  },
];

/** The fields the GUI should offer for a given kind (in table order). */
export function fieldsFor(kind: IconKind): FieldSpec[] {
  return FIELDS.filter((f) => f.kinds.includes(kind));
}

/** The descriptor entry for a field, if it has one. */
export function fieldSpec(field: keyof IconObject): FieldSpec | undefined {
  return FIELDS.find((f) => f.field === field);
}

/** Serialize an icon, returning `null` instead of throwing on an unmodelled
 *  kind / bad combo — so a GUI can render a "no icon" state, not crash. */
export function safeIconCode(icon: IconObject): string | null {
  try {
    return iconToCode(icon);
  } catch {
    return null;
  }
}

/** One option for an enum/number field: the value, and the code the current
 *  icon would produce if that value were chosen (for a per-option preview). */
export interface FieldOption {
  value: string | number;
  code: string | null;
}

/**
 * How the form groups fields, so ~14 controls read as a few named sections.
 *
 * The single "n more fields" disclosure it replaces was honest but opaque: you couldn't tell
 * whether the 11 hidden things were worth opening. These names come from what the fields
 * DESCRIBE, not from their control type — `interrupted` is a toggle and `curve` a dropdown, and
 * both are about the shape of the line.
 *
 * Grouped here rather than in the editor because it's a statement about the icon model, and
 * because a test can then assert every field has a home — a field with no group would silently
 * vanish from the form.
 */
export type FieldGroup = "appearance" | "direction" | "shape" | "features";

/** Display names for the groups, in the order the form shows them. */
export const FIELD_GROUPS: readonly { id: FieldGroup; label: string }[] = [
  // What the line or station IS — the five that apply to nearly every kind.
  { id: "appearance", label: "Appearance" },
  // Where it points and what it meets.
  { id: "direction", label: "Direction" },
  // How the line itself is drawn.
  { id: "shape", label: "Shape" },
  // Extras that don't fit the geometry: legend-only icons, accessibility, double rows.
  { id: "features", label: "Features" },
];

const GROUP_OF: Record<string, FieldGroup> = {
  system: "appearance",
  state: "appearance",
  formation: "appearance",
  width: "appearance",
  colour: "appearance",
  variant: "appearance",
  category: "appearance",

  to: "direction",
  from: "direction",
  direction: "direction",
  corner: "direction",
  cornerAdd: "direction",
  entry: "direction",
  connect: "direction",
  level: "direction",
  lane: "direction",
  by: "direction",
  offset: "direction",
  offsetTarget: "direction",
  crosses: "direction",
  region: "direction",
  roadClass: "direction",
  roadLanes: "direction",

  curve: "shape",
  length: "shape",
  parallel: "shape",
  transverse: "shape",
  interrupted: "shape",
  interruptedCorners: "shape",
  stub: "shape",
  continuation: "shape",
  through: "shape",

  legend: "features",
  accessible: "features",
  doubleRow: "features",
};

/**
 * Whether a field has an EXPLICIT group, as opposed to falling back.
 *
 * Exported so the exhaustiveness test can ask a question `fieldGroup` can't answer: it returns
 * "appearance" for anything unlisted, so a test built on it would report every field as grouped
 * and pass vacuously.
 */
export const fieldHasGroup = (field: keyof IconObject): boolean =>
  Object.hasOwn(GROUP_OF, String(field));

/** Which section of the form a field belongs in. */
export function fieldGroup(field: keyof IconObject): FieldGroup {
  // "appearance" rather than a throw: a field with no entry should be visible and slightly
  // misfiled, never missing. The exhaustiveness test is what keeps that from happening.
  return GROUP_OF[String(field)] ?? "appearance";
}

/**
 * The option that means the same as leaving the field unset, if there is one.
 *
 * Several fields have a value that emits NO affix, so choosing it and clearing the field
 * produce the same icon: a `state` of `in-use` is plain `BHF`, exactly as an unset `state` is.
 * The form showed those as `—`, which is wrong twice over — it implies nothing is chosen when
 * `in-use` plainly is, and it puts a punctuation mark where a name belongs.
 *
 * DERIVED by comparing codes rather than declared per field, so it can't drift from what the
 * encoder does. A field with no such value (`width` has no "full", `formation` no "at grade")
 * returns undefined, and its unset state needs a name of its own — see `defaultLabel`.
 */
export function defaultOptionOf(icon: IconObject, field: keyof IconObject): FieldOption | undefined {
  const cleared = safeIconCode({ ...icon, [field]: undefined } as IconObject);
  if (cleared == null) return undefined;
  return previewOptions(icon, field).find((o) => o.code === cleared);
}

/** The options for a field on the given icon, each with the code it would yield
 *  (so the GUI can show a preview per option). Empty for non-enum fields. */
export function previewOptions(icon: IconObject, field: keyof IconObject): FieldOption[] {
  const spec = fieldSpec(field);
  if (!spec?.values) return [];
  return spec.values.map((value) => ({ value, code: safeIconCode({ ...icon, [field]: value }) }));
}

/**
 * The minimal icon for a kind — one that exists as a real BSicon file.
 *
 * Not derivable, and that's the point. Two things go wrong if you try:
 *
 *   - taking the first SUBTYPE gives the wrong thing. `track`'s first subtype is `walkway`
 *     (BL) and `junction`'s is `loop` (WSL), so a picker previewing `STR` handed you a
 *     footpath instead. What you saw wasn't what you got.
 *   - taking the bare kind gives a code that ENCODES but doesn't exist. `{ kind: "junction" }`
 *     is `ABZg` and `{ kind: "shift" }` is `SHI2`, and neither file is on Commons — a
 *     junction has to branch somewhere, so it needs a `to`. `safeIconCode` can't catch that;
 *     it checks that a code can be built, not that anyone drew it.
 *
 * So these are curated, and each was checked against Commons.
 */
export function defaultIcon(kind: IconKind): IconObject {
  switch (kind) {
    // A junction must branch somewhere and a shift must shift somewhere: ABZg and SHI2
    // don't exist, ABZgl and SHI2l do.
    case "junction":
    case "shift":
      return { kind, to: "left" } as IconObject;
    // The only kind with no usable bare form — `{ kind: "symbol" }` won't even encode.
    case "symbol":
      return { kind, subtype: iconSubtypes(kind)[0] } as IconObject;
    // STR, BHF, KRZ, ÜST, HUB, ENDE all exist, and a bare spacer is a blank cell.
    default:
      return { kind } as IconObject;
  }
}

/**
 * Change an icon's kind, keeping every field the NEW kind still accepts.
 *
 * A form that rebuilt `{ kind }` from nothing threw away state, formation, width and
 * colour on every kind change — quietly undoing work that was visible on screen. The
 * field descriptor already knows which fields a kind takes, so the carry-over is exactly
 * that set.
 *
 * `subtype` is never carried: the old kind's subtypes don't exist on the new one, so the
 * new kind's `defaultIcon` decides. `code` isn't either — it's the passthrough escape hatch
 * and would override everything.
 *
 * `encode` lets the caller reject a combination that doesn't produce a valid code, in
 * which case the bare kind is returned rather than a cell that renders as nothing.
 */
export function retargetKind(
  icon: IconObject,
  kind: IconKind,
  encode?: (icon: IconObject) => string | null,
): IconObject {
  const base = defaultIcon(kind);
  const keep = new Set(fieldsFor(kind).map((f) => String(f.field)));
  const carried = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(icon)) {
    if (key === "kind" || key === "subtype" || key === "code") continue;
    if (value !== undefined && keep.has(key)) carried[key] = value;
  }
  const candidate = carried as unknown as IconObject;
  if (encode && encode(candidate) == null) return base;
  return candidate;
}
