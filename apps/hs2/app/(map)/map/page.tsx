import type { Metadata } from 'next';
import { Box } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import type { GeoRow } from '@/utils/map-geojson';
import MapLoader from './MapLoader';

export const metadata: Metadata = {
  title: 'Interactive Map',
  description:
    'Explore the HS2 route on an interactive map showing stations, bridges, tunnels, viaducts, and other structures with real-time construction progress from London to Birmingham.',
};

// Geometry changes rarely (only on a data import) and an HS2-news traffic spike
// shouldn't hammer Supabase — serve from cache, refresh daily (D9).
export const revalidate = 86400;

// PostgREST hard-caps a single SELECT at db-max-rows (1000 on this project),
// regardless of any client .limit(). media_geo already exceeds that, so we page
// through with .range() until every row is fetched (D8). The exact `count` from
// the first page tells us when we're done and lets us shout if a page comes back
// short of expectations rather than silently dropping markers.
const PAGE_SIZE = 1000;
const MAX_ROWS = 100_000; // runaway guard; far above any realistic corpus

/**
 * Fetch all of a GeoJSON view's rows, paging past the server row cap.
 * `features_geo` / `media_geo` are SQL views (see .context/map-views.sql).
 */
async function fetchGeo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  view: 'features_geo' | 'media_geo',
  columns: string
): Promise<GeoRow[]> {
  const all: GeoRow[] = [];
  let total: number | null = null;

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error, count } = await supabase
      .from(view)
      .select(columns, { count: 'exact' })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[map] failed to load ${view} (from ${from}):`, error.message);
      break;
    }
    if (total == null) total = count ?? null;

    const rows = (data ?? []) as unknown as GeoRow[];
    all.push(...rows);

    // Done: short page (the last one) or we've collected the full count.
    if (rows.length < PAGE_SIZE) break;
    if (total != null && all.length >= total) break;
  }

  // Loud, not silent: if we somehow ended up short of the reported total.
  if (total != null && all.length < total) {
    console.error(
      `[map] ${view}: fetched ${all.length} of ${total} rows — markers are ` +
        `being truncated. Check pagination / db-max-rows.`
    );
  }
  return all;
}

export default async function MapPage() {
  const supabase = await createClient();

  const [features, media, creatorsRes] = await Promise.all([
    fetchGeo(
      supabase,
      'features_geo',
      'id,name,type,status,chainage,chainage_end,route_element_id,geojson'
    ),
    fetchGeo(
      supabase,
      'media_geo',
      'id,title,type,youtube_id,recorded_date,published_at,shot_type,creator_id,geojson'
    ),
    supabase.from('creators').select('id, display_name, colour, profile_image_url'),
  ]);

  const creators = (creatorsRes.data ?? []).map(c => ({
    id: c.id,
    name: c.display_name,
    color: c.colour,
    imageUrl: c.profile_image_url,
  }));

  return (
    <Box position='absolute' inset={0}>
      <MapLoader features={features} media={media} creators={creators} />
    </Box>
  );
}
