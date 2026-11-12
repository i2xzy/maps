// Supabase `.in('url', [...])` builds a GET query string, so a large url list can
// exceed proxy URI length limits (a 414). Query in batches and merge the rows.
export const URL_BATCH = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
