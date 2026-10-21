'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  creatorIdSchema,
  featureIdSchema,
  isoDateSchema,
  mediaTypeSchema,
  shotTypeSchema,
  urlSchema,
  youtubeIdSchema,
  type CatalogueRows,
  type CreatorId,
  type CreatorRef,
  type Geometry,
  type IsoDate,
  type MediaType,
  type ShotType,
  type Url,
  type YoutubeId,
} from '@/lib/import';
import { readCatalogueRows } from '@/lib/import-server/catalogue';
import { serverSpanLookup } from '@/lib/import-server/plan';
import { geometryToEwkt } from '@/lib/import-server/geometry';

const urlsSchema = z.array(z.string());

export async function loadCatalogue(urls: string[]): Promise<CatalogueRows> {
  const { supabase } = await requireAdmin();
  return readCatalogueRows(supabase, urlsSchema.parse(urls));
}

const spanSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export async function spanLookup(from: string, to: string): Promise<string[]> {
  const { supabase } = await requireAdmin();
  const p = spanSchema.parse({ from, to });
  return [...(await serverSpanLookup(supabase)(p.from, p.to))];
}

const createCreatorSchema = z.object({
  displayName: z.string().min(1),
  url: z.url(),
  platform: z.string().default('youtube'),
  externalId: z.string().min(1),
  profileImageUrl: z.union([z.url(), z.literal('')]).optional(),
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
      profile_image_url: data.profileImageUrl || null,
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

const geometrySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), lon: z.number(), lat: z.number() }),
  z.object({ kind: z.literal('line'), coords: z.array(z.tuple([z.number(), z.number()])) }),
]);

const commitPinSchema = z.object({
  url: urlSchema,
  title: z.string(),
  description: z.string().nullable(),
  youtubeId: youtubeIdSchema.nullable(),
  shotType: shotTypeSchema,
  type: mediaTypeSchema,
  publishedAt: isoDateSchema.nullable(),
  recordedDate: isoDateSchema.nullable(),
  creatorId: creatorIdSchema.nullable(),
  geometry: geometrySchema.nullable(),
  featureIds: z.array(featureIdSchema),
});

/** The media row one Review confirmation writes. Branded at the server boundary;
 *  the client passes domain-typed values straight from the live plan. */
export type CommitPinInput = {
  url: Url;
  title: string;
  description: string | null;
  youtubeId: YoutubeId | null;
  shotType: ShotType;
  type: MediaType;
  publishedAt: IsoDate | null;
  recordedDate: IsoDate | null;
  creatorId: CreatorId | null;
  geometry: Geometry | null;
  featureIds: ReadonlyArray<string>;
};

export type CommitPinResult = { mediaId: string; inserted: boolean; linksAdded: number };

// Writes one reviewed pin: its media row and its selected feature links. Both
// writes are idempotent upserts that ignore duplicates, so re-confirming the
// same pin converges without overwriting. `inserted` reports whether a new media
// row was actually created (false when the url already existed); `linksAdded`
// counts the links this call newly created, both read from the returned rows.
export async function commitPin(input: CommitPinInput): Promise<CommitPinResult> {
  const { supabase } = await requireAdmin();
  const data = commitPinSchema.parse(input);

  const { data: upserted, error: mediaError } = await supabase
    .from('media')
    .upsert(
      {
        url: data.url,
        title: data.title,
        description: data.description,
        youtube_id: data.youtubeId,
        type: data.type,
        shot_type: data.shotType,
        creator_id: data.creatorId,
        location: geometryToEwkt(data.geometry),
        published_at: data.publishedAt,
        recorded_date: data.recordedDate,
      },
      { onConflict: 'url', ignoreDuplicates: true },
    )
    .select('id');
  if (mediaError) throw mediaError;

  const inserted = (upserted?.length ?? 0) > 0;
  let mediaId = upserted?.[0]?.id;
  if (!mediaId) {
    const { data: existing, error } = await supabase
      .from('media')
      .select('id')
      .eq('url', data.url)
      .single();
    if (error) throw error;
    mediaId = existing.id;
  }

  let linksAdded = 0;
  if (data.featureIds.length > 0) {
    const rows = data.featureIds.map((feature_id) => ({ media_id: mediaId, feature_id }));
    const { data: linkRows, error } = await supabase
      .from('media_features')
      .upsert(rows, { onConflict: 'media_id,feature_id', ignoreDuplicates: true })
      .select('feature_id');
    if (error) throw error;
    linksAdded = linkRows?.length ?? 0;
  }

  return { mediaId, inserted, linksAdded };
}

// Called once when a Review pass finishes. Every pin is already written, so this
// only refreshes the pages that read media and their feature links.
export async function finishImport(): Promise<void> {
  await requireAdmin();
  revalidatePath('/', 'layout');
}

