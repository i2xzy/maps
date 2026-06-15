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

/**
 * Load all rows of a GeoJSON view via its RPC. The features_geo_all /
 * media_geo_all functions (see .context/map-views.sql) each return the whole
 * row set as one JSON array, so we sidestep PostgREST's 1000-row cap — one
 * request, no pagination, no per-page COUNT. Each element matches GeoRow.
 */
async function fetchGeo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fn: 'features_geo_all' | 'media_geo_all'
): Promise<GeoRow[]> {
  const { data, error } = await supabase.rpc(fn);
  if (error) {
    console.error(`[map] ${fn} failed:`, error.message);
    return [];
  }
  return (data ?? []) as unknown as GeoRow[];
}

export default async function MapPage() {
  const supabase = await createClient();

  const [features, media, creatorsRes] = await Promise.all([
    fetchGeo(supabase, 'features_geo_all'),
    fetchGeo(supabase, 'media_geo_all'),
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
