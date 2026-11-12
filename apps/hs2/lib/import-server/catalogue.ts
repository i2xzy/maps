import type { Client } from '@supabase/server';
import type { CatalogueRows } from '@/lib/import';

import { chunk, URL_BATCH } from './batch';

// PostgREST caps a single response (default 1000 rows), so the reference tables
// are read page by page until a short page — otherwise a growing feature set
// would silently truncate and its rows would resolve as "unmatched".
const PAGE = 1000;

async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

// Reads the reference data a layer resolves against, shaped into the plain
// CatalogueRows DTO buildCatalogue consumes. Existing media is scoped to the
// layer's own urls so the relink path sees current feature links.
export async function readCatalogueRows(supabase: Client, urls: string[]): Promise<CatalogueRows> {
  const [creators, features, aliases, existingMedia] = await Promise.all([
    readAll((f, t) => supabase.from('creators').select('id, display_name').range(f, t)),
    readAll((f, t) =>
      supabase.from('features').select('id, name, chainage, route_element_id').range(f, t),
    ),
    readAll((f, t) => supabase.from('feature_title_aliases').select('alias, feature_name').range(f, t)),
    readExistingMedia(supabase, urls),
  ]);

  return {
    creators: creators.map((c) => ({ id: c.id, displayName: c.display_name })),
    features: features.map((f) => ({
      id: f.id,
      name: f.name,
      chainage: f.chainage,
      routeElementId: f.route_element_id,
    })),
    aliases: aliases.map((a) => ({ alias: a.alias, featureName: a.feature_name })),
    existingMedia,
  };
}

async function readExistingMedia(supabase: Client, urls: string[]) {
  const rows: { url: string; id: string; featureIds: string[] }[] = [];
  for (const batch of chunk(urls, URL_BATCH)) {
    const { data, error } = await supabase
      .from('media')
      .select('id, url, media_features(feature_id)')
      .in('url', batch);
    if (error) throw error;
    for (const m of data ?? []) {
      rows.push({ url: m.url, id: m.id, featureIds: m.media_features.map((mf) => mf.feature_id) });
    }
  }
  return rows;
}
