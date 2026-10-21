'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  DecisionSchema,
  type CatalogueRows,
  type CreatorId,
  type CreatorRef,
  type ImportDraft,
} from '@/lib/import';
import { readCatalogueRows } from '@/lib/import-server/catalogue';
import { serverSpanLookup } from '@/lib/import-server/plan';
import { commitImport as runCommit, type ApplyResult } from '@/lib/import-server/commit';

const urlsSchema = z.array(z.string());

export async function loadCatalogue(urls: string[]): Promise<CatalogueRows> {
  const { supabase } = await requireAdmin();
  return readCatalogueRows(supabase, urlsSchema.parse(urls));
}

const spanSchema = z.object({
  from: z.string(),
  to: z.string(),
  routePrefix: z.string().nullable(),
});

export async function spanLookup(
  from: string,
  to: string,
  routePrefix: string | null,
): Promise<string[]> {
  const { supabase } = await requireAdmin();
  const p = spanSchema.parse({ from, to, routePrefix });
  return [...(await serverSpanLookup(supabase)(p.from, p.to, p.routePrefix))];
}

const createCreatorSchema = z.object({
  displayName: z.string().min(1),
  url: z.url(),
  platform: z.string().default('youtube'),
  externalId: z.string().min(1),
});

export async function createCreator(
  input: z.input<typeof createCreatorSchema>,
): Promise<CreatorRef> {
  const { supabase } = await requireAdmin();
  const data = createCreatorSchema.parse(input);
  const { data: row, error } = await supabase
    .from('creators')
    .insert({
      display_name: data.displayName,
      url: data.url,
      platform: data.platform,
      external_id: data.externalId,
    })
    .select('id, display_name')
    .single();
  if (error) throw error;
  return { id: row.id as CreatorId, displayName: row.display_name };
}

const aliasSchema = z.object({
  alias: z.string().min(1),
  featureNames: z.array(z.string().min(1)).min(1),
});

export async function addAlias(alias: string, featureNames: string[]): Promise<void> {
  const { supabase } = await requireAdmin();
  const data = aliasSchema.parse({ alias, featureNames });
  const rows = data.featureNames.map((feature_name) => ({ alias: data.alias, feature_name }));
  const { error } = await supabase
    .from('feature_title_aliases')
    .upsert(rows, { onConflict: 'alias,feature_name', ignoreDuplicates: true });
  if (error) throw error;
}

export async function commitImport(draft: ImportDraft): Promise<ApplyResult> {
  const { supabase } = await requireAdmin();
  // Decisions drive the writes, so validate them strictly. The layer is only
  // shape-guarded: deep ParsedLayer re-validation would duplicate types.ts for
  // little gain behind the admin gate, so the parsed layer's structure is trusted.
  const decisions = z.array(DecisionSchema).parse(draft.decisions);
  if (!Array.isArray(draft.layer?.pins) || draft.layer.pins.length === 0) {
    throw new Error('Import draft has no pins.');
  }
  const result = await runCommit(supabase, { layer: draft.layer, decisions });
  revalidatePath('/', 'layout');
  return result;
}
