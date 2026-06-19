/**
 * Pure helpers for the Videos tab's date filtering. Kept out of the component
 * so they're unit-testable. A video's "effective date" is its recorded date,
 * else its published date; here that's already resolved to a string (or null
 * for undated videos). ISO yyyy-mm-dd compares lexically = chronologically, so
 * a plain string compare is correct for date-only bounds.
 */

/**
 * Whether an effective date falls within the [from, to] range (inclusive on
 * both ends). An empty range (no from and no to) passes everything; once a
 * range is active, undated rows (null/empty eff) drop out. `eff` may be a full
 * timestamp — only its leading yyyy-mm-dd is compared. `from`/`to` are ISO
 * yyyy-mm-dd.
 */
export function dateInRange(
  eff: string | null | undefined,
  from?: string,
  to?: string
): boolean {
  if (!from && !to) return true;
  if (!eff) return false;
  const d = eff.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * Earliest date (ISO yyyy-mm-dd) across a list of effective-date strings, or
 * null if none are dated. Used for the date picker's min bound.
 */
export function earliestDate(
  effectiveDates: Array<string | null | undefined>
): string | null {
  let min: string | null = null;
  for (const e of effectiveDates) {
    const d = e?.slice(0, 10);
    if (d && (!min || d < min)) min = d;
  }
  return min;
}
