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
import { BSICON_BLOOM, BSICON_BLOOM_K, BSICON_BLOOM_M } from "./bsicon-manifest.data";
import { bloomFromBase64, bloomHas } from "./bloom";
import type { Bloom } from "./bloom";
import { fieldsFor, isFieldVisible, previewOptions, safeIconCode } from "./descriptor";
import type { FieldOption, FieldSpec } from "./descriptor";
import type { IconObject } from "./icon";

/** Decoded on first ask — 175 KB of base64 needn't be unpacked to import this module. */
let filter: Bloom | undefined;

/**
 * Whether Commons has a file for this code.
 *
 * `false` is certain (Bloom filters have no false negatives); `true` is ~95% reliable. A
 * code we can't even encode is `false`.
 */
export function bsiconExists(code: string | null | undefined): boolean {
  if (!code) return false;
  filter ??= bloomFromBase64(BSICON_BLOOM, BSICON_BLOOM_M, BSICON_BLOOM_K);
  return bloomHas(filter, code);
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
