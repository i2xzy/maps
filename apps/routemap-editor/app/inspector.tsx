"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  CheckboxCard,
  Flex,
  HStack,
  IconButton,
  Image,
  Menu,
  Input,
  Accordion,
  Portal,
  RadioCard,
  Select,
  Stack,
  Text,
  createListCollection,
} from "@chakra-ui/react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import {
  bsiconKnownMissing,
  codeToIcon,
  defaultOptionOf,
  FIELD_GROUPS,
  fieldGroup,
  commonsUrl,
  existingOptions,
  iconSubtypes,
  SLOT_NAMES,
  isColspanRow,
  offeredFields,
  retargetKind,
  safeIconCode,
  slotOf,
  withSlot,
  type Cell,
  type CellIcon,
  type ColspanRow,
  type DiagramRow,
  type FieldGroup,
  type FieldSpec,
  type GridRow,
  type IconKind,
  type IconObject,
  type RouteDiagram,
  type Selection,
  type SideLabel,
  type TextRun,
  type SideSlots,
  type SlotName,
} from "@repo/routemap";
import { LabelRichEditor } from "./label-editor";
import { useTextBuffer } from "./use-text-buffer";
import { labelIsRteEditable, splitLinesOf, splitsIn } from "./label-doc";
import type { LogoResolver } from "./rint-node";
import type { RwsResolver } from "./rws-node";

const KINDS: IconKind[] = [
  "track",
  "station",
  "junction",
  "crossing",
  "crossover",
  "shift",
  "hub",
  "end",
  "symbol",
  "spacer",
];
const NONE = "__none__";

/**
 * Below this many controls, the form skips sections and lists the fields.
 *
 * Five, from the corpus: 53 of its distinct icons offer five or fewer fields — a `spacer` offers
 * one — and grouping those costs a click per section without giving anything to navigate. Above
 * it, the common case is 10–11 fields across three sections, where the headers are the point.
 */
const FLAT_FIELD_LIMIT = 5;

/** Sentence-case a field caption for display (e.g. "kind" → "Kind"). */
const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Proper nouns and acronyms the rule below would get wrong.
 *
 * Everything else derives: hyphens become spaces and the first letter is capitalised, so
 * `in-use` reads "In use" and `disused-primary` "Disused primary". These four don't follow
 * that — an S-Bahn is a proper noun, and `gb`/`uk` are country codes, not words.
 */
const VALUE_NAMES: Record<string, string> = {
  sbahn: "S-Bahn",
  sBend: "S-bend",
  gb: "GB",
  uk: "UK",
};

/**
 * An enum value as the form should show it.
 *
 * Raw values are wire format — `in-use`, `disused-primary`, `three-quarter` — and showing them
 * as-is made the form read like a config file. Numbers stay numbers: `corner` is 1–4 and
 * "1" is already how you'd say it.
 */
const valueName = (value: string | number): string => {
  if (typeof value === "number") return String(value);
  return VALUE_NAMES[value] ?? capitalize(value.replace(/-/g, " "));
};



// ── immutable list helpers ────────────────────────────────────────────────
const replaceAt = <T,>(a: T[], i: number, v: T): T[] => a.map((x, j) => (j === i ? v : x));
const removeAt = <T,>(a: T[], i: number): T[] => a.filter((_, j) => j !== i);
const insertAt = <T,>(a: T[], i: number, v: T): T[] => [...a.slice(0, i), v, ...a.slice(i)];
const moveAt = <T,>(a: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= a.length) return a;
  const c = [...a];
  [c[i], c[j]] = [c[j] as T, c[i] as T];
  return c;
};

const newIcon = (): CellIcon => ({ kind: "track" });
/**
 * A fresh layer, in the semantic object form.
 *
 * This used to emit a CODE, on the reasoning that a stack of codes shouldn't grow one
 * object. That reasoning expired when Format started canonicalizing cells to objects: the
 * document's own convention is objects now, so a code here made the new layer the odd one
 * out among its neighbours.
 */
const newLayer = (): CellIcon => newIcon();
const newCell = (): Cell => newIcon();
const newRow = (): DiagramRow => ({ cells: [newCell()] });

// ── shared bits ────────────────────────────────────────────────────────────
function Thumb({ code, size = 16 }: { code: string | null; size?: number }): ReactNode {
  // A code can be well-formed and still have no file on Commons — the option
  // previews combine fields freely (`legend` + a junction, say), and plenty of those
  // combinations were never drawn. Remember which code failed rather than a bare
  // boolean, so the state clears itself the moment the code changes.
  const [failed, setFailed] = useState<string | null>(null);

  // A square for the states with no image of their own; there's no width to convey.
  const slot = { boxSize: `${size}px`, flexShrink: "0" } as const;

  /*
   * Two different nothings, which used to look identical.
   *
   * `missing` is dashed: we asked for a file and didn't get one. `empty` is blank space, because
   * a full-width spacer draws nothing — there is no file to ask for. Sharing the dashed style
   * made the legitimate case read as an error, visible in the Width dropdown for a spacer where
   * every fraction has a file and only "Full" cannot.
   */
  const missing = (
    <Box {...slot} borderWidth="1px" borderStyle="dashed" borderColor="border" borderRadius="xs" />
  );
  // Nothing drawn, because a full-width spacer draws nothing. It still occupies the thumbnail's
  // size so the labels beside it stay aligned with every other option's.
  const empty = <Box {...slot} />;
  // null → no valid icon (red). "" → a valid full-width blank spacer (neutral,
  // dashed — there's no BSicon file for it). Otherwise the Commons thumbnail.
  if (code == null) return <Box {...slot} bg="red.subtle" borderRadius="xs" />;
  if (code === "") return empty;
  // A broken-image glyph in a form reads as "this control is broken"; the dashed
  // placeholder reads as "no picture for this one", which is what it means.
  if (failed === code) return missing;
  /*
   * At its TRUE width, not fitted into a slot.
   *
   * Fitting these into a fixed box aligned the labels and destroyed the only thing the preview
   * says: an eighth-width spacer against an octuple one IS the width. Alignment is solved where
   * it belongs — the option lists put the label in the leading column and the preview after it,
   * so labels line up while the pictures stay comparable.
   */
  return (
    <Image
      src={commonsUrl(code)}
      alt={code}
      h={`${size}px`}
      w="auto"
      maxW="none"
      flexShrink="0"
      onError={() => setFailed(code)}
    />
  );
}

// Icon size (px) for the toolbar MiniBtn glyphs — tuned to the "2xs" button.
const ICON = 14;

function MiniBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <IconButton size="2xs" variant="ghost" onClick={onClick} disabled={disabled} aria-label={title} title={title}>
      {children}
    </IconButton>
  );
}

/**
 * The options with the unset entry inserted where it belongs.
 *
 * Not always first: for an ordered scale its position is part of the meaning — "Full" sits
 * between three-quarter and double, and at the head of the list it read as another extreme.
 *
 * Positioned against the FULL scale (`order`), not against the options actually shown. The
 * existence filter removes values that have no icon: a track offers quarter, half, double, quad
 * with `three-quarter` gone, so matching the anchor among the visible options found nothing and
 * fell back to the head — which is exactly the bug this was meant to fix.
 */
export function withNoneOption<T extends { value: string | number }>(
  options: T[],
  none: T | null,
  after?: string,
  order: readonly (string | number)[] = [],
): T[] {
  if (!none) return options;
  const rank = (v: string | number) => order.findIndex((o) => String(o) === String(v));
  const anchor = after ? rank(after) : -1;
  if (anchor < 0) return [none, ...options];
  // After the last shown option that precedes the unset state on the scale.
  const at = options.reduce((last, o, i) => {
    const r = rank(o.value);
    return r >= 0 && r <= anchor ? i : last;
  }, -1);
  return [...options.slice(0, at + 1), none, ...options.slice(at + 1)];
}

// ── enum field → Select with a preview per option ───────────────────────────
type EnumOpt = { value: string | number; code: string | null };

function EnumSelect({
  label,
  value,
  options,
  onPick,
  allowNone,
  noneLabel,
  noneCode,
  noneAfter,
  noneOrder,
  disabled,
}: {
  label: string;
  value: string | number | undefined;
  options: EnumOpt[];
  onPick: (raw: string | number | undefined) => void;
  allowNone: boolean;
  /** What to call the unset option. Never a dash — see `valueName`. */
  noneLabel?: string;
  /** Preview for the unset option: the icon with this field cleared. */
  noneCode?: string | null;
  /** The value the unset option sits after, for an ordered scale. */
  noneAfter?: string;
  /** The full scale, so the position survives options being filtered out. */
  noneOrder?: readonly (string | number)[];
  disabled?: boolean;
}): ReactNode {
  const items = useMemo(
    () =>
      withNoneOption(
        options.map((o) => ({ label: valueName(o.value), value: String(o.value), code: o.code, raw: o.value })),
        allowNone
          ? {
              label: noneLabel ?? "None",
              value: NONE,
              code: noneCode ?? null,
              raw: undefined as string | number | undefined,
            }
          : null,
        noneAfter,
        noneOrder,
      ),
    [options, allowNone, noneLabel, noneCode, noneAfter, noneOrder],
  );
  const collection = useMemo(() => createListCollection({ items }), [items]);
  const cur = value == null ? NONE : String(value);
  return (
    <Select.Root
      collection={collection}
      size="sm"
      value={[cur]}
      disabled={disabled}
      onValueChange={(e) => onPick(items.find((i) => i.value === e.value[0])?.raw)}
    >
      <Select.HiddenSelect />
      <Select.Label fontSize="xs" color="fg.muted">
        {capitalize(label)}
      </Select.Label>
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="—" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {collection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                {/* Label FIRST, preview after. The previews are true-width — that's the whole
                    point of them for a field like Width — so leading with them started every
                    label at a different x and the list read as a staircase. This way the labels
                    line up in a column and the pictures stay side by side and comparable. */}
                {/*
                  Icon FIRST, at its true width, with the label after it.

                  The labels then don't line up — and that stagger IS the information. These
                  canvases are transparent, so nothing about an eighth-width icon looks different
                  from an octuple one except how far it pushes what follows. I "fixed" that
                  stagger twice (fitting the icons into a slot, then leading with the label) and
                  both times removed the only cue there was. A full-width blank draws nothing but
                  still occupies its width, so it keeps its place in the progression.
                */}
                <HStack gap="2" flex="1" minW="0">
                  <Thumb code={item.code} />
                  <Select.ItemText>{item.label}</Select.ItemText>
                </HStack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}

/**
 * A small enum as radio CARDS rather than a dropdown.
 *
 * Seven fields have only 2–3 options (`connect`, `curve`, `direction`, `entry`, `lane`,
 * `level`, `offset`), and a dropdown makes you click twice to see two choices. Cards, not
 * plain radios, because each option carries a THUMBNAIL — the option names are `l`, `r`,
 * `1`–`4`, which mean nothing without the picture. Matches the CheckboxCard used for
 * booleans, so the two read as one family.
 */
function EnumCards({
  label,
  value,
  options,
  clearedCode,
  noneLabel,
  noneAfter,
  noneOrder,
  onPick,
  disabled,
}: {
  label: string;
  value: string | number | undefined;
  options: EnumOpt[];
  /** Preview for the "unset" card: the icon this field cleared. */
  clearedCode: string | null;
  /** What to call the unset card, and whether to show one at all. */
  noneLabel?: string;
  /** The value the unset card sits after, for an ordered scale. */
  noneAfter?: string;
  /** The full scale, so the position survives options being filtered out. */
  noneOrder?: readonly (string | number)[];
  onPick: (raw: string | number | undefined) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <RadioCard.Root
      size="sm"
      orientation="horizontal"
      disabled={disabled}
      value={value == null ? NONE : String(value)}
      onValueChange={(e) =>
        onPick(e.value === NONE ? undefined : options.find((o) => String(o.value) === e.value)?.value)
      }
    >
      {/* `RadioCard.Label`, not a bare caption — Ark wires it to the group, so the field
          name is announced instead of an anonymous set of radios. */}
      <RadioCard.Label fontSize="xs" color="fg.muted" fontWeight="normal">
        {capitalize(label)}
      </RadioCard.Label>
      <HStack gap="1" flexWrap="wrap">
        {/*
          The unset card, shown only when no option already means "unset". Ark fires no change
          event when you click the ALREADY-SELECTED item, so without it there'd be no way back
          — but where a real option IS the default (a `state` of `in-use`), that option is the
          way back and a second entry for it would be a lie. It previews the icon with the
          field cleared, so every card answers the same question: what do I get if I pick this?
        */}
        {withNoneOption(
          options,
          noneLabel ? { value: NONE, code: clearedCode } : null,
          noneAfter,
          noneOrder,
        ).map((o) => (
          <RadioCard.Item key={String(o.value)} value={String(o.value)} flex="0 0 auto">
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl px="1.5" py="1">
              <HStack gap="1">
                <Thumb code={o.code} />
                <RadioCard.ItemText fontSize="xs">
                  {o.value === NONE ? noneLabel : valueName(o.value)}
                </RadioCard.ItemText>
              </HStack>
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </HStack>
    </RadioCard.Root>
  );
}

// ── boolean field → CheckboxCard with the on-state preview ───────────────────
function BoolCard({
  spec,
  icon,
  set,
}: {
  spec: FieldSpec;
  icon: IconObject;
  set: (patch: Partial<IconObject>) => void;
}): ReactNode {
  const field = spec.field;
  const onValue = spec.sample?.[field] ?? true; // true, or false for `through`
  const on = icon[field] === onValue;
  const disabled = spec.disabledWhen?.(icon) ?? false;
  return (
    <CheckboxCard.Root
      size="sm"
      checked={on}
      disabled={disabled}
      onCheckedChange={(e) => set({ [field]: e.checked === true ? onValue : undefined } as Partial<IconObject>)}
    >
      <CheckboxCard.HiddenInput />
      <CheckboxCard.Control>
        <HStack gap="1" flex="1">
          <Thumb code={safeIconCode({ ...icon, [field]: onValue } as IconObject)} />
          <CheckboxCard.Label fontSize="xs">{capitalize(spec.label ?? String(field))}</CheckboxCard.Label>
        </HStack>
        <CheckboxCard.Indicator />
      </CheckboxCard.Control>
    </CheckboxCard.Root>
  );
}

// ── one icon's controls (kind → subtype → contextual fields) ─────────────────
/**
 * The BSicon code, editable.
 *
 * The only way into the ~200,000 real BSicons our encoder can't produce. They render and
 * round-trip perfectly as a raw `{ code }` cell — there was simply no way to type one, so
 * "Replace" could take you AWAY from an unmodelled code but nothing could take you to one.
 * The wikitext pane was the only route in, which isn't the GUI covering everything.
 *
 * Typed codes go through `codeToIcon`, so a code the model understands becomes the semantic
 * object (and the controls below light up) while anything else stays a code. That is the same
 * rule the paste path already uses, so a typed cell and a pasted one are indistinguishable.
 *
 * Existence is a HINT, never a block. The filter has a known false-positive rate, is a
 * snapshot, and answers `true` for everything until it loads — and a user typing a code we've
 * never heard of is more likely to be right about Commons than we are.
 */
function CodeField({
  code,
  onChange,
}: {
  code: string | null;
  onChange: (code: string) => void;
}): ReactNode {
  const [text, setText] = useTextBuffer(code ?? "", (v) => {
    const next = v.trim();
    if (next && next !== code) onChange(next);
  });
  const trimmed = text.trim();
  // `bsiconKnownMissing`, not `!bsiconExists`. The filter only holds codes our encoder can
  // emit, so for anything outside that range it has nothing to say — and reading its silence
  // as "no such file" told users that `WASSERq`, a perfectly real icon, was broken.
  const unknown = bsiconKnownMissing(trimmed);
  return (
    <Stack gap="0.5">
      <HStack gap="1">
        {/* `|| code`, not `|| null`: an EMPTY code is a valid full-width blank (a spacer), and
            `null` is Thumb's "no valid icon" red. `"" || null` made every spacer look broken. */}
        <Thumb code={trimmed || code} size={20} />
        <Input
          size="xs"
          fontFamily="mono"
          value={text}
          placeholder="BSicon code"
          aria-label="BSicon code"
          onChange={(e) => setText(e.target.value)}
        />
      </HStack>
      {unknown ? (
        <Text fontSize="xs" color="fg.muted">
          No file on Commons for this code — check the spelling, or carry on if you know better.
        </Text>
      ) : null}
    </Stack>
  );
}

function IconFields({ icon, onChange }: { icon: IconObject; onChange: (icon: IconObject) => void }): ReactNode {
  const set = (patch: Partial<IconObject>) => {
    const next: IconObject = { ...icon, ...patch };
    for (const k of Object.keys(next) as (keyof IconObject)[]) {
      if (next[k] === undefined) delete next[k];
    }
    onChange(next);
  };
  // Keeping the fields the new kind still accepts is model knowledge, so it lives beside
  // `fieldsFor` in the package rather than inline here — and is unit-tested there.
  const pickKind = (k: IconKind) => onChange(retargetKind(icon, k, safeIconCode));

  const subtypes = iconSubtypes(icon.kind);
  // The subtype that means the same as having none, derived the way `defaultOptionOf` derives
  // an enum's default: by asking whether clearing it changes the code.
  const bareCode = safeIconCode({ ...icon, subtype: undefined } as IconObject);
  const defaultSubtype = subtypes.find(
    (sub) => bareCode != null && safeIconCode({ ...icon, subtype: sub } as IconObject) === bareCode,
  );
  // Only the fields that can actually produce a real icon. `fieldsFor` says what the MODEL
  // can represent, which is far more than exists: a plain track has 21 representable fields
  // and 6 of them have no option that resolves to a file on Commons. Measured over the
  // fixture, this drops 45% of the controls and half the options inside the survivors.
  const fields = offeredFields(icon);
  // Grouped into named sections, in descriptor order within each. A field keeps its section
  // whether or not it's set, so a control never moves under you — the in-use/unset split this
  // replaced made `state` jump out of its group the moment you touched it.
  const grouped = new Map<FieldGroup, FieldSpec[]>();
  for (const f of fields) {
    const g = fieldGroup(f.field);
    grouped.set(g, [...(grouped.get(g) ?? []), f]);
  }
  // Sections the icon actually uses start open. Derived from the icon rather than held in
  // state, so selecting a different cell opens the sections for THAT icon instead of keeping
  // the last one's.
  const usedGroups = FIELD_GROUPS.filter((g) =>
    (grouped.get(g.id) ?? []).some((f) => icon[f.field] !== undefined),
  ).map((g) => g.id);
  // A freshly placed icon has nothing set, so no section would open and the panel would be
  // four headers and nothing else — worse than the disclosure it replaced. Appearance is the
  // fallback because it holds the fields that apply to nearly every kind (system, state,
  // formation, width, colour), so it's the one most likely to be wanted.
  const openGroups = usedGroups.length ? usedGroups : ["appearance"];
  const control = (f: FieldSpec) => {
    if (f.control === "toggle") return <BoolCard key={String(f.field)} spec={f} icon={icon} set={set} />;
    // `existingOptions`, not `previewOptions` — the dead half of the choices is dropped,
    // except any value the icon currently holds, which stays so it can be seen and changed.
    const opts = existingOptions(icon, f.field).map((o) => ({ value: o.value, code: o.code }));

    /*
     * The default, and how it is shown.
     *
     * When one option means the same as leaving the field unset — `state` of `in-use` is plain
     * `BHF`, exactly as an unset state is — that option IS the default. So it is shown as
     * selected and there is no separate unset entry: a `—` there claimed nothing was chosen
     * when `in-use` plainly was.
     *
     * Picking it still CLEARS the field rather than writing it, which keeps the model terse and
     * means the wikitext is unchanged by selecting what was already true.
     */
    const dflt = defaultOptionOf(icon, f.field);
    const current = icon[f.field] as string | number | undefined;
    const shown = current ?? dflt?.value;
    const pick = (v: string | number | undefined) =>
      set({ [f.field]: v === dflt?.value ? undefined : v } as Partial<IconObject>);
    // No unset entry when the default has a name of its own among the options.
    const noneLabel = dflt ? undefined : (f.defaultLabel ?? "None");
    // Two or three choices don't need a dropdown you have to open to read.
    if (opts.length <= 3) {
      return (
        <EnumCards
          key={String(f.field)}
          label={f.label ?? String(f.field)}
          value={shown}
          options={opts}
          clearedCode={safeIconCode({ ...icon, [f.field]: undefined } as IconObject)}
          noneLabel={noneLabel}
          noneAfter={f.defaultAfter}
          noneOrder={f.values}
          disabled={f.disabledWhen?.(icon)}
          onPick={pick}
        />
      );
    }
    return (
      <EnumSelect
        key={String(f.field)}
        label={f.label ?? String(f.field)}
        value={shown}
        allowNone={noneLabel != null}
        noneLabel={noneLabel}
        noneAfter={f.defaultAfter}
        noneOrder={f.values}
        noneCode={safeIconCode({ ...icon, [f.field]: undefined } as IconObject)}
        disabled={f.disabledWhen?.(icon)}
        options={opts}
        onPick={pick}
      />
    );
  };
  // Keep the current kind selectable even if it's not in the standard list (e.g.
  // an unmodelled `bridge`/`water` cell from JSON), so switching kinds isn't lossy.
  const kindOptions = KINDS.includes(icon.kind) ? KINDS : [...KINDS, icon.kind];

  return (
    <Stack gap="1.5">
      <EnumSelect
        label="kind"
        value={icon.kind}
        allowNone={false}
        // Each option previews the icon PICKING IT WOULD PRODUCE, which depends on the
        // current one: the kind change carries over the fields the new kind still accepts,
        // so a track that inherits `to: left` is STRl, not STR. Previewing `defaultIcon`
        // instead was accurate only for an icon with nothing set — and previewing the first
        // SUBTYPE, as this used to, showed STR and produced BL, a footpath.
        options={kindOptions.map((k) => ({
          value: k,
          code: safeIconCode(retargetKind(icon, k, safeIconCode)),
        }))}
        onPick={(v) => v != null && pickKind(v as IconKind)}
      />
      {subtypes.length > 0 && (
        /*
         * Subtype gets the same default rule as the other enums: if one subtype produces the
         * same code as no subtype at all, it IS what the icon currently is, so it shows as
         * selected. Otherwise the unset state is named rather than left as the trigger's
         * placeholder — which was the last `—` shown as a value anywhere in the form.
         */
        <EnumSelect
          label="subtype"
          value={icon.subtype ?? defaultSubtype}
          allowNone={defaultSubtype == null}
          noneLabel="None"
          noneCode={safeIconCode({ ...icon, subtype: undefined })}
          options={subtypes.map((s) => ({ value: s, code: safeIconCode({ ...icon, subtype: s }) }))}
          onPick={(v) => set({ subtype: v == null || v === defaultSubtype ? undefined : String(v) })}
        />
      )}
      {/*
        Too few fields to bother grouping: show them flat.

        A `spacer` offers exactly one control (`width`), so a section header there is a click you
        have to make to reveal a single field. Measured over the corpus's distinct icons, 53 of
        them offer five or fewer — including cases with THREE sections holding three fields — and
        for those the headers cost navigation instead of providing it. The bulk sit at 10–11,
        where sections earn their place.
      */}
      {fields.length <= FLAT_FIELD_LIMIT ? (
        fields.map(control)
      ) : (
        <>
      {/*
        Named sections, not one "n more fields" disclosure.

        The disclosure was honest but opaque: you couldn't tell whether the eleven things behind
        it were worth opening, so the answer was always "click and scan". Named sections say
        what's inside, and a plain track's 14 controls read as 5 + 6 + 3.

        I argued against grouping when the form had 23 fields and a menu of 20 names would have
        been no better than a flat list. Existence filtering took it to 14, which is few enough
        for four sections to be a map rather than another maze.
      */}
      {/* Keyed by kind so `defaultValue` is re-applied when the sections themselves change.
          `defaultValue` is only read on mount, so without this, selecting a junction after a
          track kept the track's open sections — the comment above claimed otherwise and the
          browser said no. Keying on the KIND rather than the whole code means the user's own
          open/close choices survive while they edit one icon. */}
      <Accordion.Root key={icon.kind} multiple defaultValue={openGroups} size="sm" variant="plain">
        {FIELD_GROUPS.filter((g) => grouped.get(g.id)?.length).map((g) => {
          const inGroup = grouped.get(g.id) ?? [];
          const setCount = inGroup.filter((f) => icon[f.field] !== undefined).length;
          return (
            <Accordion.Item key={g.id} value={g.id}>
              <Accordion.ItemTrigger py="1" cursor="pointer">
                <Text fontSize="xs" fontWeight="medium" flex="1" textAlign="left">
                  {g.label}
                </Text>
                {/* How many of the section's controls the icon uses — the one thing the old
                    counter got right, kept per section. */}
                <Text fontSize="xs" color="fg.muted">
                  {setCount > 0 ? `${setCount} of ${inGroup.length}` : inGroup.length}
                </Text>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody pb="2">
                  <Stack gap="1.5">{inGroup.map(control)}</Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          );
        })}
          </Accordion.Root>
        </>
      )}
    </Stack>
  );
}

// ── one cell (object-with-kind cells are visually editable in v1) ────────────
/**
 * One icon in a cell — a bare code, an `{ code, title }` ref, or a semantic object.
 *
 * Shared by the single-icon cell and by every layer of an overlay stack, which is
 * the same editing problem: get to an `IconObject` the controls understand, then
 * write back in whatever shape the cell was already using.
 */
function IconLayerEditor({ icon, onChange }: { icon: CellIcon; onChange: (icon: CellIcon) => void }): ReactNode {
  const code =
    (typeof icon === "string" ? icon : "code" in icon ? icon.code : safeIconCode(icon)) ?? null;

  /**
   * A typed code always writes a BARE code, so a terse row stays terse and typing the same
   * code twice can't produce two different JSON shapes depending on what was there before.
   * A `{ code, title, href }` ref keeps its metadata, which the controls know nothing about
   * — the sample's `hKRZW` cell carries a title and losing it on the first keystroke would
   * be worse than not editing at all.
   */
  const setCode = (next: string) =>
    onChange(typeof icon === "object" && "code" in icon ? { ...icon, code: next } : next);

  const controls = (): ReactNode => {
    if (typeof icon === "object" && "kind" in icon) {
      return <IconFields icon={icon} onChange={(next) => onChange(next)} />;
    }
    const decoded = codeToIcon(typeof icon === "string" ? icon : icon.code);
    if ("kind" in decoded) {
      // Write back in whatever shape the cell was already using.
      return (
        <IconFields
          icon={decoded}
          onChange={(next) => {
            const encoded = safeIconCode(next);
            if (typeof icon === "string") onChange(encoded ?? next);
            else onChange(encoded == null ? icon : { ...icon, code: encoded });
          }}
        />
      );
    }
    // A code we don't model (`WASSERq`, `SKRZ-Bo`, a parenthesised or oddly-suffixed
    // variant). The code field above is the way in and out; Replace is the shortcut to a
    // modelled icon.
    return (
      <>
        <Text fontSize="xs" color="fg.muted">
          This icon isn’t one the controls understand. It renders and exports correctly — edit
          the code above, or replace it.
        </Text>
        <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => onChange(newLayer())}>
          Replace
        </Button>
      </>
    );
  };

  return (
    <Stack gap="1.5">
      <CodeField code={code} onChange={setCode} />
      {controls()}
    </Stack>
  );
}

/**
 * An overlay stack (Routemap `!~`): icons composited in one column slot, first in
 * flow and the rest layered over it. Over half the rows of a real diagram use one.
 *
 * Collapses back to a plain single cell at one layer, so removing an overlay leaves
 * the JSON as terse as it started rather than a one-element array.
 */
function StackEditor({
  stack,
  onChange,
}: {
  stack: CellIcon[];
  onChange: (cell: Cell) => void;
}): ReactNode {
  const set = (next: CellIcon[]) => onChange(next.length === 1 ? (next[0] as Cell) : next);
  return (
    <Stack gap="2">
      {stack.map((layer, i) => (
        <Box key={i} borderWidth="1px" borderColor="border" borderRadius="sm" p="1.5">
          <Flex align="center" justify="space-between" mb="1">
            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
              {i === 0 ? "Base" : `Overlay ${i}`}
            </Text>
            <HStack gap="0">
              {/* The list is in model order — base first, then each overlay on top,
                  matching both the JSON and the wikitext `a!~b!~c`. So the arrows
                  move a layer within that list, and the Base/Overlay captions
                  renumber to show what ended up on top. */}
              <MiniBtn title="Move layer up" disabled={i === 0} onClick={() => set(moveAt(stack, i, -1))}>
                <ArrowUp size={ICON} />
              </MiniBtn>
              <MiniBtn
                title="Move layer down"
                disabled={i === stack.length - 1}
                onClick={() => set(moveAt(stack, i, 1))}
              >
                <ArrowDown size={ICON} />
              </MiniBtn>
              <MiniBtn title="Remove layer" disabled={stack.length <= 1} onClick={() => set(removeAt(stack, i))}>
                <Trash2 size={ICON} />
              </MiniBtn>
            </HStack>
          </Flex>
          <IconLayerEditor icon={layer} onChange={(next) => set(replaceAt(stack, i, next))} />
        </Box>
      ))}
      <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => set([...stack, newLayer()])}>
        <Plus size={ICON} /> Overlay
      </Button>
    </Stack>
  );
}

// ── one cell: empty, a single icon, or an overlay stack ───────────────────────
function CellEditor({ cell, onChange }: { cell: Cell; onChange: (cell: Cell) => void }): ReactNode {
  // An absent cell IS a full-width spacer — that's how it renders and what it serializes
  // to — so it edits as one. It used to get a different panel entirely ("Empty column /
  // Add icon"), which meant the same thing in the diagram had two unrelated forms
  // depending on whether Format had been pressed. Changing Kind here is "add icon", so
  // the button is redundant.
  //
  // Nothing is written until something changes: selecting an empty cell must not rewrite
  // it into an object.
  if (cell == null) {
    return <IconFields icon={{ kind: "spacer" }} onChange={(next) => onChange(next)} />;
  }
  if (Array.isArray(cell)) return <StackEditor stack={cell} onChange={onChange} />;
  if (typeof cell === "object" && "stack" in cell) {
    return <StackEditor stack={cell.stack} onChange={(next) => onChange({ ...cell, stack: Array.isArray(next) ? next : [next as CellIcon] })} />;
  }
  return (
    <Stack gap="2">
      <IconLayerEditor icon={cell} onChange={(next) => onChange(next)} />
      <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => onChange([cell, newLayer()])}>
        <Plus size={ICON} /> Overlay
      </Button>
    </Stack>
  );
}

// ── labels: an "Add …" button until there's something to edit; then a rich-text
//    editor (text/bold/italic/link/logos) with a remove button, plus the strip for
//    outer-edge logos. Labels carrying `title` stay JSON-only — the RTE has no
//    representation for it, so editing one would silently drop it. ───────────────
function LabelSlot({
  side,
  caption,
  value,
  onChange,
  resolveRws,
  resolveLogo,
}: {
  side: "left" | "right";
  /** What this slot is called in the form — the slot's name, not the side's. */
  caption: string;
  value: SideLabel | null | undefined;
  onChange: (v: SideLabel | undefined) => void;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  // A `{{BSsplit}}` that is the WHOLE label gets one editor per line — see below.
  const splitLines = splitLinesOf(value);
  // A split that SHARES the label: the RTE handles the surrounding text with the split as an
  // atom chip, and its lines get the same per-line editors underneath. Only reached when this
  // isn't a whole-label split, which the branch order below guarantees.
  const splitsHere = splitsIn(value);
  return (
    <Stack gap="1">
      <Flex align="center" justify="space-between">
        <Text fontSize="xs" color="fg.muted">
          {caption}
        </Text>
        <MiniBtn
          title={`Remove ${side} ${caption.toLowerCase()}`}
          onClick={() => onChange(undefined)}
        >
          <Trash2 size={ICON} />
        </MiniBtn>
      </Flex>
      {/* A whole-label split is checked FIRST. Splits became RTE-editable (as an atom
          chip), so testing `labelIsRteEditable` first sent every split to the RTE and the
          per-line editor was never reached. */}
      {splitLines ? (
        /*
         * A `{{BSsplit}}` that IS the whole label. 30 of the 39 splits in the fixture are
         * shaped this way; the rest share their label and are handled above, with the RTE.
         */
        <SplitLines
          lines={splitLines}
          label={`${capitalize(side)} ${caption.toLowerCase()}`}
          onChange={(next) =>
            onChange(next == null ? undefined : next.length > 1 ? [{ split: next }] : next[0])
          }
          resolveRws={resolveRws}
          resolveLogo={resolveLogo}
        />
      ) : labelIsRteEditable(value) ? (
        <>
          {/* No separate logo strip any more. A logo is an `{ icon }` run, so the
              toolbar's logo button puts it in the document like any other content —
              there is no second place for icons to live and no second control. */}
          <LabelRichEditor
            value={value}
            onChange={onChange}
            ariaLabel={`${capitalize(side)} ${caption.toLowerCase()}`}
            resolveRws={resolveRws}
            resolveLogo={resolveLogo}
          />
          {/* A split sharing this label is an atom chip in the editor above — the caret can
              reach the words either side of it, but not into it. Its lines are edited here. */}
          {splitsHere.map((sp, n) => (
            <SplitLines
              key={n}
              lines={sp.lines}
              label={`${capitalize(side)} ${caption.toLowerCase()}${splitsHere.length > 1 ? ` split ${n + 1}` : ""}`}
              onChange={(next) => onChange(sp.replace(next))}
              resolveRws={resolveRws}
              resolveLogo={resolveLogo}
            />
          ))}
        </>
      ) : (
        <Text fontSize="xs" color="fg.muted">
          {/* Say WHY. "Rich label" told the user nothing about what to do next, and with no
              JSON pane in production it named a place they can't go. */}
          Contains wikitext this form can’t model — edit it in the wikitext panel.
        </Text>
      )}
    </Stack>
  );
}

/**
 * One editor per line of a `{{BSsplit}}`.
 *
 * Used for both split cases: a split that IS the whole label (30 of the 39 in the fixture) and
 * one that shares its label with text, where the RTE above handles the surrounding words with
 * the split as an atom chip. Either way the lines are edited here, which avoids a ProseMirror
 * node-with-content and everything that comes with it — caret entry, Enter/Backspace at line
 * boundaries, whole-node selection, none of it testable under jsdom.
 *
 * `onChange(null)` removes the split; dropping to one line collapses it, since a stack of one
 * is a split nobody can see.
 */
function SplitLines({
  lines,
  label,
  onChange,
  resolveRws,
  resolveLogo,
}: {
  lines: TextRun[][];
  label: string;
  onChange: (lines: TextRun[][] | null) => void;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  return (
    <Stack gap="1">
      {lines.map((line, i) => (
        <HStack key={i} gap="1" align="start">
          <Box flex="1">
            <LabelRichEditor
              value={line}
              onChange={(next) => onChange(lines.map((l, j) => (j === i ? asLine(next) : l)))}
              ariaLabel={`${label} line ${i + 1}`}
              resolveRws={resolveRws}
              resolveLogo={resolveLogo}
            />
          </Box>
          <MiniBtn
            title={`Remove line ${i + 1}`}
            onClick={() => {
              const kept = lines.filter((_, j) => j !== i);
              onChange(kept.length ? kept : null);
            }}
          >
            <Trash2 size={ICON} />
          </MiniBtn>
        </HStack>
      ))}
      <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => onChange([...lines, [""]])}>
        <Plus size={ICON} /> Line
      </Button>
    </Stack>
  );
}

/**
 * A line the RTE handed back, as the run array a split holds.
 *
 * The RTE collapses simple content to a plain string and rich content to runs, but returns the
 * OBJECT form when the line carries label-level marks. A split line has nowhere to put those,
 * so they're pushed down onto the text runs they cover — dropping them would silently
 * un-italicise a line the moment its neighbour was edited.
 */
function asLine(value: SideLabel | undefined): TextRun[] {
  if (value == null) return [""];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  const { text, ...marks } = value;
  const runs: TextRun[] = typeof text === "string" ? [text] : (text ?? []);
  return runs.map((run) => {
    if (typeof run === "string") return { text: run, ...marks };
    // Only text runs can carry marks; an icon, break, raw or nested split can't.
    return "text" in run || "rws" in run ? { ...run, ...marks } : run;
  });
}

/**
 * A colspan row's text.
 *
 * Rich text here IS a label — `string | TextRun[]`, the same shape a side label carries — so
 * it goes through the same editor. It used to say "(Rich colspan — edit in JSON)", which was
 * the other half of the dead end the side labels had: with no JSON pane in production it named
 * a place the user can't go. Only 1 of the 2 colspan rows in the fixture is rich, but a dead
 * end is a dead end.
 */
function ColspanBody({
  row,
  onChange,
  resolveRws,
  resolveLogo,
}: {
  row: ColspanRow;
  onChange: (r: DiagramRow) => void;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  const text = row.text;
  const [plain, setPlain] = useTextBuffer(typeof text === "string" ? text : "", (v) =>
    onChange({ ...row, text: v }),
  );
  const splitLines = splitLinesOf(text as SideLabel | undefined);
  const setText = (next: SideLabel | undefined) => onChange({ ...row, text: next as ColspanRow["text"] });

  // Same branch order as a side label: a whole-label split first, or making splits
  // RTE-editable would leave the per-line editor unreachable.
  if (splitLines) {
    return (
      <SplitLines
        lines={splitLines}
        label="Colspan text"
        onChange={(next) =>
          setText(next == null ? undefined : next.length > 1 ? [{ split: next }] : next[0])
        }
        resolveRws={resolveRws}
        resolveLogo={resolveLogo}
      />
    );
  }
  if (text != null && typeof text !== "string") {
    if (!labelIsRteEditable(text as SideLabel)) {
      return (
        <Text fontSize="xs" color="fg.muted">
          Contains wikitext this form can’t model — edit it in the wikitext panel.
        </Text>
      );
    }
    return (
      <Stack gap="1">
        <LabelRichEditor
          value={text as SideLabel}
          onChange={setText}
          ariaLabel="Colspan text"
          resolveRws={resolveRws}
          resolveLogo={resolveLogo}
        />
        {splitsIn(text as SideLabel).map((sp, n) => (
          <SplitLines
            key={n}
            lines={sp.lines}
            label={`Colspan text${n > 0 ? ` split ${n + 1}` : ""}`}
            onChange={(next) => setText(sp.replace(next))}
            resolveRws={resolveRws}
            resolveLogo={resolveLogo}
          />
        ))}
      </Stack>
    );
  }
  return (
    <Input
      size="xs"
      value={plain}
      placeholder="Colspan text"
      aria-label="Colspan text"
      onChange={(e) => setPlain(e.target.value)}
      autoFocus
    />
  );
}

// ── panel section header ─────────────────────────────────────────────────────
// `actions` (a toolbar) sits inline with the title on the same line; body below.
/**
 * The slots of one side, in the order they appear on the page.
 *
 * Outermost-first on the left and innermost-first on the right, so the form reads in
 * the same direction as the row it's editing — the same reason the serializer orders
 * its `~~` fields that way.
 */
const SLOT_ORDER: Record<"left" | "right", SlotName[]> = {
  left: ["outer", "remark", "main", "dist"],
  right: ["dist", "main", "remark", "outer"],
};

/** The template's own words for each slot; nothing here says `linfo1`. */
const SLOT_LABEL: Record<SlotName, string> = {
  dist: "Distance or time",
  main: "Main text",
  remark: "Remark",
  outer: "Outer remark",
};

/**
 * One side's labels: `main` plus whichever other slots are in use, and a single menu
 * to add the rest.
 *
 * `main` is always offered because nearly every row uses only that — it's the wiki's
 * own positional default. Rendering a `LabelSlot` for all four would put four "Add"
 * buttons on each side and bury the common case behind the rare one.
 */
function SideLabels({
  side,
  value,
  onChange,
  resolveRws,
  resolveLogo,
}: {
  side: "left" | "right";
  value: SideLabel | SideSlots | null | undefined;
  onChange: (v: SideLabel | SideSlots | null | undefined) => void;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  // Slots the user has asked for but not yet typed into. Nothing is written to the
  // model until there's content — an empty slot would be dropped by `withSlot` the
  // moment it was added, so it has to be revealed here rather than stored there.
  // Remounted per row by the parent's `key`, so this can't leak across rows.
  const [revealed, setRevealed] = useState<ReadonlySet<SlotName>>(new Set());
  const reveal = (name: SlotName, on: boolean) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  const order = SLOT_ORDER[side];
  const shown = order.filter((name) => slotOf(value, name) != null || revealed.has(name));
  // Offered innermost-out, so the slot nearly every row uses comes first. That's a
  // list of choices rather than a spatial layout, so it doesn't follow SLOT_ORDER.
  const addable = SLOT_NAMES.filter((name) => !shown.includes(name));

  return (
    <Stack gap="3">
      {shown.map((name) => (
        <LabelSlot
          key={name}
          side={side}
          caption={SLOT_LABEL[name]}
          value={slotOf(value, name) ?? null}
          onChange={(v) => {
            if (v == null) reveal(name, false); // removed: let it go back to the menu
            onChange(withSlot(value, name, v));
          }}
          resolveRws={resolveRws}
          resolveLogo={resolveLogo}
        />
      ))}
      {addable.length ? (
        <Menu.Root
          onSelect={(d) => reveal(d.value as SlotName, true)}
          positioning={{ placement: "bottom-start" }}
        >
          <Menu.Trigger asChild>
            <Button size="xs" variant="outline" alignSelf="flex-start">
              <Plus size={ICON} /> Add label
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {addable.map((name) => (
                  <Menu.Item key={name} value={name}>
                    {SLOT_LABEL[name]}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : null}
    </Stack>
  );
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children?: ReactNode }): ReactNode {
  return (
    <Stack gap="1.5">
      <Flex align="center" justify="space-between" gap="2" minH="6">
        <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide" whiteSpace="nowrap">
          {title}
        </Text>
        {actions}
      </Flex>
      {children}
    </Stack>
  );
}

/**
 * Contextual editor for whatever is clicked in the preview. Given the parsed
 * diagram and the current `selection`, it renders:
 *   - a `row` selection → the row's actions plus its label(s): both side labels
 *     for a grid row, or the text for a colspan row.
 *   - a `cell` selection → the row actions, cell actions (move within the row,
 *     move up/down to an adjacent row, duplicate, add, delete), and the icon's
 *     descriptor-driven controls.
 * It emits a new diagram on every edit. Selection is lifted to the page so clicks
 * in the preview and edits here stay in sync; this component nudges it
 * (`onSelect`) when an edit shifts indices so the highlight keeps tracking.
 */
export function Inspector({
  diagram,
  selection,
  onChange,
  onSelect,
  resolveRws,
  resolveLogo,
}: {
  diagram: RouteDiagram;
  selection: Selection | null;
  onChange: (d: RouteDiagram) => void;
  onSelect: (selection: Selection | null) => void;
  resolveRws?: RwsResolver;
  resolveLogo?: LogoResolver;
}): ReactNode {
  const rows = diagram.rows ?? [];
  const setRows = (r: DiagramRow[]) => onChange({ ...diagram, rows: r });
  const addRow = () => {
    setRows([...rows, newRow()]);
    onSelect({ kind: "row", row: rows.length });
  };

  const empty = (
    <Stack gap="3" p="4">
      <Text fontSize="sm" color="fg.muted">
        Click a cell or a row in the preview to edit it here.
      </Text>
      <Button size="xs" colorPalette="blue" alignSelf="flex-start" onClick={addRow}>
        <Plus size={ICON} /> Row
      </Button>
    </Stack>
  );

  if (!selection) return empty;
  const row = rows[selection.row];
  if (!row) return empty; // stale selection (row was deleted) — show the hint

  const setRow = (r: DiagramRow) => setRows(replaceAt(rows, selection.row, r));
  const i = selection.row;

  // Insert a blank / duplicate row at `at`, then select it. `at === i` lands the
  // new row above the current one (pushing it down); `at === i + 1`, below it.
  const insertRow = (at: number) => { setRows(insertAt(rows, at, newRow())); onSelect({ kind: "row", row: at }); };
  const duplicateRow = (at: number) => { setRows(insertAt(rows, at, structuredClone(row))); onSelect({ kind: "row", row: at }); };

  // Header keeps just the row's identity + delete; everything positional (move /
  // insert / duplicate) lives in the two icon bars around the labels below.
  const rowToolbar = (
    <Section
      title={isColspanRow(row) ? `Colspan row ${i + 1}` : `Row ${i + 1}`}
      actions={
        <MiniBtn title="Delete row" onClick={() => { setRows(removeAt(rows, i)); onSelect(null); }}><Trash2 size={ICON} /></MiniBtn>
      }
    />
  );

  // A compact icon bar hugging the labels: its position carries the direction, so
  // the top bar moves/inserts/duplicates ABOVE and the bottom bar BELOW — no text,
  // just tooltips. `at` is where a new row lands; `dir` picks the move arrow.
  const RowBar = ({ dir }: { dir: "above" | "below" }): ReactNode => {
    const at = dir === "above" ? i : i + 1;
    const step: -1 | 1 = dir === "above" ? -1 : 1;
    const canMove = dir === "above" ? i > 0 : i < rows.length - 1;
    return (
      <HStack gap="0.5">
        <MiniBtn title={`Move row ${dir === "above" ? "up" : "down"}`} disabled={!canMove} onClick={() => { setRows(moveAt(rows, i, step)); onSelect({ ...selection, row: i + step }); }}>
          {dir === "above" ? <ArrowUp size={ICON} /> : <ArrowDown size={ICON} />}
        </MiniBtn>
        <MiniBtn title={`Insert row ${dir}`} onClick={() => insertRow(at)}><Plus size={ICON} /></MiniBtn>
        <MiniBtn title={`Duplicate row ${dir}`} onClick={() => duplicateRow(at)}><Copy size={ICON} /></MiniBtn>
      </HStack>
    );
  };

  let body: ReactNode = null;

  if (selection.kind === "row" && isColspanRow(row)) {
    body = (
      <Section title="Text">
        <ColspanBody row={row} onChange={setRow} resolveRws={resolveRws} resolveLogo={resolveLogo} />
      </Section>
    );
  } else if (selection.kind === "row") {
    const grid = row as GridRow;
    body = (
      <>
        <Section title="Left label">
          <SideLabels
            key={`left-${i}`}
            side="left"
            value={grid.left}
            onChange={(v) => setRow({ ...grid, left: v })}
            resolveRws={resolveRws}
            resolveLogo={resolveLogo}
          />
        </Section>
        <Section title="Right label">
          <SideLabels
            key={`right-${i}`}
            side="right"
            value={grid.right}
            onChange={(v) => setRow({ ...grid, right: v })}
            resolveRws={resolveRws}
            resolveLogo={resolveLogo}
          />
        </Section>
      </>
    );
  } else if (isColspanRow(row)) {
    // A cell selection landed on a colspan row (e.g. the row type changed under a
    // JSON edit) — there are no cells to edit; fall back to the text.
    body = (
      <Section title="Text">
        <ColspanBody row={row} onChange={setRow} resolveRws={resolveRws} resolveLogo={resolveLogo} />
      </Section>
    );
  } else {
    const grid = row as GridRow;
    const cells = grid.cells ?? [];
    const j = selection.col;
    const cell = cells[j];
    const setCells = (c: Cell[]) => setRow({ ...grid, cells: c });
    // A grid row directly above/below to move the cell into (colspan rows can't
    // hold cells, so they're not valid targets).
    const canMoveTo = (dir: -1 | 1): boolean => {
      const t = i + dir;
      return t >= 0 && t < rows.length && !isColspanRow(rows[t]!);
    };
    const moveToRow = (dir: -1 | 1) => {
      const t = i + dir;
      const target = rows[t] as GridRow;
      const targetCells = target.cells ?? [];
      const at = Math.min(j, targetCells.length); // keep the column where possible
      let next = replaceAt(rows, i, { ...grid, cells: removeAt(cells, j) });
      next = replaceAt(next, t, { ...target, cells: insertAt(targetCells, at, cell ?? null) });
      setRows(next);
      onSelect({ kind: "cell", row: t, col: at });
    };
    body = (
      <Section
        title={`Cell ${j + 1} of ${cells.length}`}
        actions={
          <HStack gap="0.5">
            <MiniBtn title="Move left" disabled={j === 0} onClick={() => { setCells(moveAt(cells, j, -1)); onSelect({ ...selection, col: j - 1 }); }}><ArrowLeft size={ICON} /></MiniBtn>
            <MiniBtn title="Move right" disabled={j === cells.length - 1} onClick={() => { setCells(moveAt(cells, j, 1)); onSelect({ ...selection, col: j + 1 }); }}><ArrowRight size={ICON} /></MiniBtn>
            <MiniBtn title="Move to row above" disabled={!canMoveTo(-1)} onClick={() => moveToRow(-1)}><ArrowUpToLine size={ICON} /></MiniBtn>
            <MiniBtn title="Move to row below" disabled={!canMoveTo(1)} onClick={() => moveToRow(1)}><ArrowDownToLine size={ICON} /></MiniBtn>
            <MiniBtn title="Duplicate cell" onClick={() => { setCells(insertAt(cells, j + 1, structuredClone(cell ?? null))); onSelect({ ...selection, col: j + 1 }); }}><Copy size={ICON} /></MiniBtn>
            <MiniBtn title="Add cell" onClick={() => { setCells(insertAt(cells, j + 1, newCell())); onSelect({ ...selection, col: j + 1 }); }}><Plus size={ICON} /></MiniBtn>
            <MiniBtn title="Delete cell" onClick={() => { const next = removeAt(cells, j); setCells(next); onSelect(next.length ? { ...selection, col: Math.min(j, next.length - 1) } : { kind: "row", row: i }); }}><Trash2 size={ICON} /></MiniBtn>
          </HStack>
        }
      >
        <CellEditor cell={cell ?? null} onChange={(c) => setCells(replaceAt(cells, j, c))} />
      </Section>
    );
  }

  // Cell panel: just the cell's own tools + editor, no row-level chrome.
  if (selection.kind === "cell") {
    return (
      <Stack gap="4" p="3">
        {body}
      </Stack>
    );
  }

  // Row panel: header (title + delete), then a compact icon bar ABOVE the labels,
  // the labels, and a mirrored bar BELOW — each bar acts in its own direction.
  return (
    <Stack gap="2" p="3">
      {rowToolbar}
      <RowBar dir="above" />
      {body}
      <RowBar dir="below" />
    </Stack>
  );
}
