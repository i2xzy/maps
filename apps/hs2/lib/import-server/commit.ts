import type { Client } from '@supabase/server';
import type { Database } from '@supabase/types/database';
import type { ImportDraft } from '@/lib/import';

import { deriveServerPlan } from './plan';
import { geometryToEwkt } from './geometry';

type MediaInsert = Database['public']['Tables']['media']['Insert'];
type LinkInsert = Database['public']['Tables']['media_features']['Insert'];

export type ApplyResult = {
  inserted: number;
  reused: number;
  linksAdded: number;
  skipped: number;
};

// Writes the re-derived plan. Every write is an idempotent upsert that ignores
// duplicates, so re-running the same import converges without overwriting: new
// media are inserted, existing rows keep their data, and both insert and relink
// pins only gain the feature links they lack. Blocked and skipped pins write
// nothing. The returned counts are the plan's intent, truthful under idempotency.
export async function commitImport(supabase: Client, draft: ImportDraft): Promise<ApplyResult> {
  const plan = await deriveServerPlan(supabase, draft);

  const mediaRows: MediaInsert[] = [];
  const insertUrls: string[] = [];
  for (const p of plan.pins) {
    if (p.kind !== 'insert') continue;
    insertUrls.push(p.draft.url);
    mediaRows.push({
      url: p.draft.url,
      title: p.draft.title,
      description: p.draft.description,
      youtube_id: p.draft.youtubeId,
      type: p.draft.type,
      shot_type: p.draft.shotType,
      creator_id: p.creator.id,
      location: geometryToEwkt(p.draft.geometry),
      published_at: p.draft.publishedAt,
      recorded_date: p.draft.recordedDate,
    });
  }

  if (mediaRows.length > 0) {
    const { error } = await supabase
      .from('media')
      .upsert(mediaRows, { onConflict: 'url', ignoreDuplicates: true });
    if (error) throw error;
  }

  const idByUrl = new Map<string, string>();
  if (insertUrls.length > 0) {
    const { data, error } = await supabase.from('media').select('id, url').in('url', insertUrls);
    if (error) throw error;
    for (const row of data ?? []) idByUrl.set(row.url, row.id);
  }

  const links: LinkInsert[] = [];
  for (const p of plan.pins) {
    if (p.kind === 'insert') {
      const mediaId = idByUrl.get(p.draft.url);
      if (mediaId) for (const f of p.links) links.push({ media_id: mediaId, feature_id: f.id });
    } else if (p.kind === 'relink') {
      for (const f of p.newLinks) links.push({ media_id: p.mediaId, feature_id: f.id });
    }
  }

  if (links.length > 0) {
    const { error } = await supabase
      .from('media_features')
      .upsert(links, { onConflict: 'media_id,feature_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  return {
    inserted: plan.summary.insert,
    reused: plan.summary.relink,
    linksAdded: plan.summary.linksPlanned,
    skipped: plan.summary.skipped,
  };
}
