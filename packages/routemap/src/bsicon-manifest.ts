/**
 * Which BSicon codes actually have a file — and what that means for the icon form.
 *
 * The form offers a control for anything the MODEL can represent, and the model is
 * generous: it encodes `curve: "wide"` on a track as `kSTR`, because that is what the
 * naming convention says a wide curve is called. No such file exists. Measured across the
 * 2,638 modellable cells in the real-diagram fixture, filtering to fields with at least one
 * option that resolves to a real file takes **15.6 offered fields per icon down to 8.4**,
 * and **51% of the options inside the surviving fields are dead too**. Half the form edits
 * nothing.
 *
 * "Representable" and "exists" are different questions and the form was answering the
 * wrong one. Answers here come from a baked Bloom filter (see `bloom.ts` for why bits
 * rather than the 172,005 codes themselves).
 *
 * THE SAFETY RULE, which every function here follows: **a value already in use is always
 * offered.** The filter is a snapshot, it has a few percent false positives by design, and
 * Commons is not the only place a diagram's icons can come from. Hiding a field the current
 * icon actually sets would make real content uneditable — far worse than showing one dead
 * option. So absence of evidence only ever removes a choice nobody has made.
 */
import { bloomFromBase64, bloomHas } from "./bloom";
import type { Bloom } from "./bloom";
import { fieldsFor, isFieldVisible, previewOptions, safeIconCode } from "./descriptor";
import type { FieldOption, FieldSpec } from "./descriptor";
import { iconToCode } from "./icon";
import type { IconObject } from "./icon";
import { codeToIcon } from "./parse";

/**
 * Loaded on demand, NOT imported.
 *
 * A static import put the whole 268 KB of base64 in the page's first-load chunk, and base64
 * of ~50%-dense bits doesn't compress — so it was 280 KB of an 834 KB gzipped first load,
 * a third of the payload, for something not needed until a cell is selected.
 *
 * Until it arrives `bsiconExists` answers TRUE, which is the same direction as the
 * staleness rule: an unknown code is offered rather than hidden, so a slow load shows the
 * unfiltered form for a moment instead of hiding controls that work.
 */
let filter: Bloom | undefined;
let loading: Promise<void> | undefined;

/** Start (or join) loading the filter. Resolves once `bsiconExists` is exact. */
export function loadBsiconFilter(): Promise<void> {
  loading ??= import("./bsicon-manifest.data").then((data) => {
    filter = bloomFromBase64(data.BSICON_BLOOM, data.BSICON_BLOOM_M, data.BSICON_BLOOM_K);
  });
  return loading;
}

/** Whether answers are exact yet. False means everything is offered. */
export function bsiconFilterLoaded(): boolean {
  return filter !== undefined;
}

/**
 * Whether Commons has a file for this code.
 *
 * `false` is certain (Bloom filters have no false negatives); `true` is ~99% reliable. A
 * code we can't even encode is `false`. Before `loadBsiconFilter()` resolves everything is
 * `true` — see above for why that's the safe direction.
 */
export function bsiconExists(code: string | null | undefined): boolean {
  if (!code) return false;
  if (!filter) return true; // not loaded yet — offer it rather than hide it
  return bloomHas(filter, code);
}

/**
 * Whether we can be SURE Commons has no file for this code.
 *
 * Not the same as `!bsiconExists(code)`, and the difference bit. The filter's keys are the
 * codes that exist AND our encoder can emit, so absence only means "missing" for a code the
 * encoder could have produced. `WASSERq` is a real file our encoder can't build, so it was
 * never a key — and reading its absence as "no such file" told users their perfectly good
 * code was broken.
 *
 * Outside the encoder's range this returns `false`: we have nothing to say, and saying
 * nothing is the only honest answer. Use this to validate a code a USER typed; `bsiconExists`
 * is for codes we generated ourselves and therefore know are in range.
 */
export function bsiconKnownMissing(code: string | null | undefined): boolean {
  if (!code) return false;
  let icon: IconObject;
  try {
    icon = codeToIcon(code);
  } catch {
    return false;
  }
  if (!("kind" in icon) || iconToCode(icon) !== code) return false; // outside our range
  return !bsiconExists(code);
}

/**
 * A field's options, minus the ones that would only ever produce a broken image.
 *
 * The currently selected value survives regardless — dropping it would leave the control
 * showing nothing selected while the icon plainly has that value set.
 */
export function existingOptions(icon: IconObject, field: keyof IconObject): FieldOption[] {
  const current = icon[field];
  return previewOptions(icon, field).filter((o) => o.value === current || bsiconExists(o.code));
}

/**
 * Whether the form should offer this field for this icon at all.
 *
 * A field earns its place when it's already set, or when at least one option leads
 * somewhere real. A toggle has just one option — the `sample` value that turns it on — so
 * for those the question is "does the on-state exist?". `requires` is applied alongside it
 * because some samples only take effect in company (`length` needs an enclosed tunnel), and
 * testing the sample alone would call a live field dead.
 */
export function fieldIsOffered(spec: FieldSpec, icon: IconObject): boolean {
  if (!isFieldVisible(spec, icon)) return false;
  if (icon[spec.field] !== undefined) return true; // in use: always editable
  if (spec.control === "toggle") {
    const on = spec.sample?.[spec.field] ?? true;
    return bsiconExists(safeIconCode({ ...icon, ...spec.requires, [spec.field]: on } as IconObject));
  }
  return existingOptions(icon, spec.field).some((o) => bsiconExists(o.code));
}

/** The fields the form should show for an icon, in descriptor order. */
export function offeredFields(icon: IconObject): FieldSpec[] {
  return fieldsFor(icon.kind).filter((spec) => fieldIsOffered(spec, icon));
}
