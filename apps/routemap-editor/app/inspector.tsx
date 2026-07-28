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
  Portal,
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
  codeToIcon,
  commonsUrl,
  fieldsFor,
  iconSubtypes,
  SLOT_NAMES,
  isColspanRow,
  isFieldVisible,
  previewOptions,
  safeIconCode,
  slotOf,
  withSlot,
  type Cell,
  type CellIcon,
  type ColspanRow,
  type DiagramRow,
  type FieldSpec,
  type GridRow,
  type IconKind,
  type IconObject,
  type RouteDiagram,
  type Selection,
  type SideLabel,
  type SideSlots,
  type SlotName,
} from "@repo/routemap";
import { LabelRichEditor } from "./label-editor";
import { useTextBuffer } from "./use-text-buffer";
import { labelIsRteEditable } from "./label-doc";
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

/** Sentence-case a field caption for display (e.g. "kind" → "Kind"). */
const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const kindSample = (k: IconKind): IconObject =>
  k === "symbol"
    ? { kind: "symbol", subtype: "ferry" }
    : k === "spacer"
      ? { kind: "spacer", width: "half" }
      : ({ kind: k } as IconObject);

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
/** A fresh overlay layer, as a CODE — a stack of codes shouldn't grow one object. */
const newLayer = (): CellIcon => safeIconCode(newIcon() as IconObject) ?? newIcon();
const newCell = (): Cell => newIcon();
const newRow = (): DiagramRow => ({ cells: [newCell()] });

// ── shared bits ────────────────────────────────────────────────────────────
function Thumb({ code, size = 16 }: { code: string | null; size?: number }): ReactNode {
  // A code can be well-formed and still have no file on Commons — the option
  // previews combine fields freely (`legend` + a junction, say), and plenty of those
  // combinations were never drawn. Remember which code failed rather than a bare
  // boolean, so the state clears itself the moment the code changes.
  const [failed, setFailed] = useState<string | null>(null);

  const blank = (
    <Box
      boxSize={`${size}px`}
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      borderRadius="xs"
      flexShrink="0"
    />
  );
  // null → no valid icon (red). "" → a valid full-width blank spacer (neutral,
  // dashed — there's no BSicon file for it). Otherwise the Commons thumbnail.
  if (code == null) return <Box boxSize={`${size}px`} bg="red.subtle" borderRadius="xs" flexShrink="0" />;
  if (code === "") return blank;
  // A broken-image glyph in a form reads as "this control is broken"; the dashed
  // placeholder reads as "no picture for this one", which is what it means.
  if (failed === code) return blank;
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

// ── enum field → Select with a preview per option ───────────────────────────
type EnumOpt = { value: string | number; code: string | null };

function EnumSelect({
  label,
  value,
  options,
  onPick,
  allowNone,
  disabled,
}: {
  label: string;
  value: string | number | undefined;
  options: EnumOpt[];
  onPick: (raw: string | number | undefined) => void;
  allowNone: boolean;
  disabled?: boolean;
}): ReactNode {
  const items = useMemo(
    () => [
      ...(allowNone ? [{ label: "—", value: NONE, code: null as string | null, raw: undefined as string | number | undefined }] : []),
      ...options.map((o) => ({ label: String(o.value), value: String(o.value), code: o.code, raw: o.value })),
    ],
    [options, allowNone],
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
                <HStack gap="1">
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
function IconFields({ icon, onChange }: { icon: IconObject; onChange: (icon: IconObject) => void }): ReactNode {
  const set = (patch: Partial<IconObject>) => {
    const next: IconObject = { ...icon, ...patch };
    for (const k of Object.keys(next) as (keyof IconObject)[]) {
      if (next[k] === undefined) delete next[k];
    }
    onChange(next);
  };
  const pickKind = (k: IconKind) => {
    const first = iconSubtypes(k)[0];
    onChange(first ? { kind: k, subtype: first } : ({ kind: k } as IconObject));
  };

  const code = safeIconCode(icon);
  const subtypes = iconSubtypes(icon.kind);
  const fields = fieldsFor(icon.kind).filter((f) => isFieldVisible(f, icon));
  // Keep the current kind selectable even if it's not in the standard list (e.g.
  // an unmodelled `bridge`/`water` cell from JSON), so switching kinds isn't lossy.
  const kindOptions = KINDS.includes(icon.kind) ? KINDS : [...KINDS, icon.kind];

  return (
    <Stack gap="1.5">
      <HStack gap="1">
        <Thumb code={code} size={20} />
        <Text fontFamily="mono" fontSize="xs" truncate>
          {code ?? "(No icon)"}
        </Text>
      </HStack>
      <EnumSelect
        label="kind"
        value={icon.kind}
        allowNone={false}
        options={kindOptions.map((k) => ({ value: k, code: safeIconCode(kindSample(k)) }))}
        onPick={(v) => v != null && pickKind(v as IconKind)}
      />
      {subtypes.length > 0 && (
        <EnumSelect
          label="subtype"
          value={icon.subtype}
          allowNone={false}
          options={subtypes.map((s) => ({ value: s, code: safeIconCode({ ...icon, subtype: s }) }))}
          onPick={(v) => v != null && set({ subtype: String(v) })}
        />
      )}
      {fields.map((f) =>
        f.control === "toggle" ? (
          <BoolCard key={String(f.field)} spec={f} icon={icon} set={set} />
        ) : (
          <EnumSelect
            key={String(f.field)}
            label={f.label ?? String(f.field)}
            value={icon[f.field] as string | number | undefined}
            allowNone
            disabled={f.disabledWhen?.(icon)}
            options={previewOptions(icon, f.field).map((o) => ({ value: o.value, code: o.code }))}
            onPick={(v) => set({ [f.field]: v } as Partial<IconObject>)}
          />
        ),
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
  if (typeof icon === "object" && "kind" in icon) {
    return <IconFields icon={icon} onChange={(next) => onChange(next)} />;
  }
  // A bare code, written back as a code so a terse row stays terse.
  if (typeof icon === "string") {
    const decoded = codeToIcon(icon);
    if ("kind" in decoded) {
      return <IconFields icon={decoded} onChange={(next) => onChange(safeIconCode(next) ?? next)} />;
    }
  }
  // An `{ code, title, href }` ref: edit the code semantically but keep the metadata,
  // which the icon controls know nothing about. The sample's `hKRZW` cell carries a
  // title, and losing it on the first edit would be worse than not editing at all.
  if (typeof icon === "object" && "code" in icon) {
    const decoded = codeToIcon(icon.code);
    if ("kind" in decoded) {
      return (
        <IconFields
          icon={decoded}
          onChange={(next) => {
            const code = safeIconCode(next);
            onChange(code == null ? icon : { ...icon, code });
          }}
        />
      );
    }
  }
  // Nothing semantic to edit: a code we don't model (`WASSERq`, `SKRZ-Bo`, a bare
  // width prefix like `d`). Show the thumbnail so the layer is still identifiable.
  const code = typeof icon === "string" ? icon : "code" in icon ? icon.code : null;
  return (
    <Stack gap="1">
      <Thumb code={code} size={20} />
      <Text fontSize="xs" color="fg.muted" truncate>
        {code ?? "(Raw cell — edit in JSON)"}
      </Text>
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
  // An empty column: offer to turn it into an icon.
  if (cell == null) {
    return (
      <Stack gap="2">
        <Text fontSize="xs" color="fg.muted">
          Empty column.
        </Text>
        <Button size="xs" variant="outline" alignSelf="flex-start" onClick={() => onChange(newCell())}>
          <Plus size={ICON} /> Add icon
        </Button>
      </Stack>
    );
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
      {labelIsRteEditable(value) ? (
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
        </>
      ) : (
        <Text fontSize="xs" color="fg.muted">
          (Rich label — edit in JSON)
        </Text>
      )}
    </Stack>
  );
}

function ColspanBody({ row, onChange }: { row: ColspanRow; onChange: (r: DiagramRow) => void }): ReactNode {
  const isRich = row.text != null && typeof row.text !== "string";
  const [text, setText] = useTextBuffer(typeof row.text === "string" ? row.text : "", (v) => onChange({ ...row, text: v }));
  if (isRich) {
    return (
      <Text fontSize="xs" color="fg.muted">
        (Rich colspan — edit in JSON)
      </Text>
    );
  }
  return <Input size="xs" value={text} placeholder="Colspan text" onChange={(e) => setText(e.target.value)} autoFocus />;
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
        <ColspanBody row={row} onChange={setRow} />
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
        <ColspanBody row={row} onChange={setRow} />
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
