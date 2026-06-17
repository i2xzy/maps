import type { Metadata } from 'next';
import { Box } from '@chakra-ui/react';

import { createStaticClient } from '@supabase/server';
import type { GeoRow } from '@/utils/map-geojson';
import MapLoader from './MapLoader';

const TITLE = 'Interactive HS2 Route Map';
const DESCRIPTION =
  'Explore the HS2 route on an interactive map: stations, bridges, tunnels and ' +
  'viaducts with construction status, plus videos mapped to the structures they ' +
  'cover, from London to Birmingham.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The root layout sets generic og/twitter; override here so a shared /map
  // link previews as the map, not the site default. (Next replaces openGraph
  // rather than deep-merging, so the non-text fields are re-stated. The
  // og:image comes from app/opengraph-image.tsx.)
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'HS2 Progress Tracker',
    url: 'https://hs2.highspeedprogress.com/map',
    title: TITLE,
    description: DESCRIPTION,
    // Overriding openGraph replaces the inherited object, so re-attach the
    // site og:image (app/opengraph-image.tsx) explicitly.
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
};

// Geometry changes rarely (only on a data import) and an HS2-news traffic spike
// shouldn't hammer Supabase — serve from cache, refresh daily (D9).
export const revalidate = 86400;

/**
 * Load all rows of a GeoJSON view via its RPC. The features_geo_all /
 * media_geo_all functions (see packages/supabase/sql/map_geo.sql) each return
 * the whole row set as one JSON array, so we sidestep PostgREST's 1000-row cap
 * — one request, no pagination, no per-page COUNT. Each element matches GeoRow.
 * `ok` is false on an RPC error so the page can flag a load failure rather than
 * silently showing an empty map.
 */
async function fetchGeo(
  supabase: ReturnType<typeof createStaticClient>,
  fn: 'features_geo_all' | 'media_geo_all'
): Promise<{ rows: GeoRow[]; ok: boolean }> {
  const { data, error } = await supabase.rpc(fn);
  if (error) {
    console.error(`[map] ${fn} failed:`, error.message);
    return { rows: [], ok: false };
  }
  return { rows: (data ?? []) as unknown as GeoRow[], ok: true };
}

export default async function MapPage() {
  const supabase = createStaticClient();

  const [featuresRes, mediaRes, creatorsRes] = await Promise.all([
    fetchGeo(supabase, 'features_geo_all'),
    fetchGeo(supabase, 'media_geo_all'),
    supabase.from('creators').select('id, display_name, colour, profile_image_url'),
  ]);

  if (creatorsRes.error) {
    console.error('[map] creators failed:', creatorsRes.error.message);
  }

  const creators = (creatorsRes.data ?? []).map(c => ({
    id: c.id,
    name: c.display_name,
    color: c.colour,
    imageUrl: c.profile_image_url,
  }));

  // Distinguish a load failure from a genuinely empty result so the map can
  // surface a banner instead of looking like there's just nothing to show.
  const dataError = !featuresRes.ok || !mediaRes.ok || creatorsRes.error != null;

  return (
    <Box position='absolute' inset={0}>
      <MapLoader
        features={featuresRes.rows}
        media={mediaRes.rows}
        creators={creators}
        dataError={dataError}
      />
    </Box>
  );
}
