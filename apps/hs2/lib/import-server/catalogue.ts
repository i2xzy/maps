import type { Client } from '@supabase/server';
import type { CatalogueRows } from '@/lib/import';

// Reads the reference data a layer resolves against, shaped into the plain
// CatalogueRows DTO buildCatalogue consumes. Existing media is scoped to the
// layer's own urls so the relink path sees current feature links.
export async function readCatalogueRows(supabase: Client, urls: string[]): Promise<CatalogueRows> {
  const [creatorsRes, featuresRes, aliasesRes] = await Promise.all([
    supabase.from('creators').select('id, display_name'),
    supabase.from('features').select('id, name, chainage'),
    supabase.from('feature_title_aliases').select('alias, feature_name'),
  ]);
  if (creatorsRes.error) throw creatorsRes.error;
  if (featuresRes.error) throw featuresRes.error;
  if (aliasesRes.error) throw aliasesRes.error;

  return {
    creators: (creatorsRes.data ?? []).map((c) => ({ id: c.id, displayName: c.display_name })),
    features: (featuresRes.data ?? []).map((f) => ({ id: f.id, name: f.name, chainage: f.chainage })),
    aliases: (aliasesRes.data ?? []).map((a) => ({ alias: a.alias, featureName: a.feature_name })),
    existingMedia: await readExistingMedia(supabase, urls),
  };
}

async function readExistingMedia(supabase: Client, urls: string[]) {
  if (urls.length === 0) return [];
  const { data, error } = await supabase
    .from('media')
    .select('id, url, media_features(feature_id)')
    .in('url', urls);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    url: m.url,
    id: m.id,
    featureIds: m.media_features.map((mf) => mf.feature_id),
  }));
}
