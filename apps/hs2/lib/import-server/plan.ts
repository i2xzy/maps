import type { Client } from '@supabase/server';
import {
  buildCatalogue,
  foldDecisions,
  resolveLayer,
  type ImportDraft,
  type ImportId,
  type ImportPlan,
  type ImportSessionMeta,
  type SpanLookup,
  type Url,
} from '@/lib/import';

import { readCatalogueRows } from './catalogue';

export function serverSpanLookup(supabase: Client): SpanLookup {
  return async (from, to) => {
    const { data, error } = await supabase.rpc('chainage_span', {
      p_start: from,
      p_end: to,
    });
    if (error) throw error;
    return (data ?? []).map((row) => row.feature_name);
  };
}

// The authoritative re-derivation: the client's plan is never trusted, the
// server rebuilds it from the draft against live catalogue data before writing.
// The session meta is display-only in the plan, so a throwaway one is fine here.
export async function deriveServerPlan(supabase: Client, draft: ImportDraft): Promise<ImportPlan> {
  const urls = draft.layer.pins
    .map((p) => p.url)
    .filter((u): u is Url => u !== null);
  const catalogue = buildCatalogue(await readCatalogueRows(supabase, urls));
  const session: ImportSessionMeta = {
    id: crypto.randomUUID() as ImportId,
    name: 'server-derive',
    fileName: '',
    createdAt: new Date().toISOString(),
    lastApply: null,
  };
  return resolveLayer(
    draft.layer,
    foldDecisions(draft.decisions),
    catalogue,
    serverSpanLookup(supabase),
    session,
  );
}
