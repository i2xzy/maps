'use client';

/**
 * Non-interactive "Location" mini-map for a feature detail page.
 *
 * A real MapLibre map (not a static image) so labels are crisp vector text at
 * any DPI. Basemap mirrors the interactive map's satellite mode (Esri World
 * Imagery raster) with OpenFreeMap vector labels composited on top — the same
 * data behind the main map's streets style — so towns/roads are named and
 * readable. The feature geometry is drawn in its type colour (a line, or a
 * FeatureDisc marker for points), matching the map and the side-panel lists.
 *
 * The whole thing is wrapped in a link to the interactive map with the feature
 * preselected; the map is inert (interactive=false + pointer-events:none) so
 * clicks fall through to the link and it never hijacks page scroll.
 */
import { useState } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  type MapEvent,
  type ErrorEvent,
} from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Text, Icon } from '@chakra-ui/react';
import Link from 'next/link';
import { LuExpand, LuMapPinned } from 'react-icons/lu';

import type { FeatureType } from '@supabase/types';
import { asGeometry, representativePoint } from '@/utils/map-geojson';
import { geometryBounds } from '@/utils/map-preview';
import { TYPE_COLORS, TYPE_FALLBACK } from '@/components/map/map-colors';
import { FeatureDisc } from '@/components/map/marker-disc';

const ASPECT = 5 / 3;

// Satellite hybrid: Esri World Imagery (the interactive map's satellite basemap)
// with OpenFreeMap vector labels — the same data behind the main map's streets
// style — composited on top, so imagery keeps crisp town/road labels.
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const OPENMAPTILES = 'https://tiles.openfreemap.org/planet';

const labelPaint = {
  'text-color': '#ffffff',
  'text-halo-color': 'rgba(0,0,0,0.85)',
  'text-halo-width': 1.4,
} as const;

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
    openmaptiles: {
      type: 'vector',
      url: OPENMAPTILES,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite' },
    {
      id: 'road-labels',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: labelPaint,
    },
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 14, 'village', 13, 12],
        'text-max-width': 8,
      },
      paint: labelPaint,
    },
  ],
};

type Props = {
  featureId: string;
  featureName: string;
  featureType: FeatureType;
  geojson: unknown;
};

export default function FeatureMiniMap({
  featureId,
  featureName,
  featureType,
  geojson,
}: Props) {
  // A WebGL/context failure (unsupported browser) blanks the map; degrade to a
  // plain linked card rather than throwing. Transient tile errors are ignored.
  const [failed, setFailed] = useState(false);

  const geometry = asGeometry(geojson);
  const bounds = geometryBounds(geojson);
  const point = representativePoint(geojson);
  // The loader only mounts this when geometry exists, but guard anyway.
  if (!geometry || !bounds || !point) return null;

  const isPoint = geometry.type === 'Point';
  const color = TYPE_COLORS[featureType] ?? TYPE_FALLBACK;

  // The frame is fit to the feature, but expanded to a minimum span so small
  // features and points still show a few km of context — enough for the street
  // style's zoom-gated town/road labels to fall in view. ~0.0068° lat ≈ 0.75 km
  // half-height (≈ 1.5 km tall min); the lng half is widened for the 5:3 aspect.
  const MIN_HALF_LAT = 0.0068;
  const MIN_HALF_LNG = 0.018;
  const centreLng = (bounds.minLng + bounds.maxLng) / 2;
  const centreLat = (bounds.minLat + bounds.maxLat) / 2;
  const view: [[number, number], [number, number]] = [
    [
      Math.min(bounds.minLng, centreLng - MIN_HALF_LNG),
      Math.min(bounds.minLat, centreLat - MIN_HALF_LAT),
    ],
    [
      Math.max(bounds.maxLng, centreLng + MIN_HALF_LNG),
      Math.max(bounds.maxLat, centreLat + MIN_HALF_LAT),
    ],
  ];
  const centre = { longitude: centreLng, latitude: centreLat };

  return (
    <Link
      href={`/map?sel=f:${featureId}`}
      aria-label={`View ${featureName} on the interactive map`}
    >
      <Box
        role='group'
        position='relative'
        overflow='hidden'
        aspectRatio={ASPECT}
        width='100%'
        borderRadius='md'
        borderWidth='1px'
        borderColor='border'
        bg='bg.subtle'
      >
        {failed ? (
          <Box
            position='absolute'
            inset={0}
            display='flex'
            alignItems='center'
            justifyContent='center'
            color='fg.muted'
          >
            <Icon boxSize={6}>
              <LuMapPinned />
            </Icon>
          </Box>
        ) : (
          <Box position='absolute' inset={0} pointerEvents='none'>
            <Map
              mapStyle={SATELLITE_STYLE}
              initialViewState={{ ...centre, zoom: 12 }}
              interactive={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
              onError={(e: ErrorEvent) => {
                // Fatal (WebGL/context/bad-coord) → degrade to the linked
                // fallback card. Transient tile 404s stay non-fatal (a mostly
                // rendered preview beats blanking the whole card).
                const msg = String(e?.error?.message ?? '');
                if (
                  /webgl|context lost|failed to (initialize|create)|invalid lnglat/i.test(
                    msg
                  )
                ) {
                  setFailed(true);
                } else {
                  console.warn('[mini-map] non-fatal error:', msg);
                }
              }}
              onLoad={(e: MapEvent) => {
                // Fit the min-span view so small features/points still show
                // enough context for the street style's labels to appear.
                try {
                  e.target.fitBounds(view, { padding: 24, animate: false });
                } catch {
                  setFailed(true);
                }
              }}
            >
            {!isPoint && (
              <Source
                id='feature'
                type='geojson'
                data={{ type: 'Feature', geometry, properties: {} }}
              >
                <Layer
                  id='feature-line-casing'
                  type='line'
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': 'rgba(0,0,0,0.5)', 'line-width': 8 }}
                />
                <Layer
                  id='feature-line'
                  type='line'
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': color, 'line-width': 4 }}
                />
              </Source>
            )}
            {isPoint && (
              <Marker longitude={point[0]} latitude={point[1]} anchor='center'>
                <FeatureDisc type={featureType} name={featureName} size='26px' />
              </Marker>
            )}
            </Map>
          </Box>
        )}

        {/* Attribution — required for the imagery and the OSM label data. */}
        {!failed && (
          <Text
            position='absolute'
            top={1}
            right={1.5}
            fontSize='10px'
            color='whiteAlpha.900'
            textShadow='0 1px 2px rgba(0,0,0,0.9)'
          >
            © Esri · OpenStreetMap
          </Text>
        )}

        {/* Clickability cue: a small "open the interactive map" chip. */}
        <Box
          position='absolute'
          bottom={1.5}
          right={1.5}
          boxSize={8}
          display='flex'
          alignItems='center'
          justifyContent='center'
          borderRadius='sm'
          bg='blackAlpha.600'
          color='white'
          transition='background 0.15s'
          _groupHover={{ bg: 'blackAlpha.800' }}
        >
          <Icon boxSize={4}>
            <LuExpand />
          </Icon>
        </Box>
      </Box>
    </Link>
  );
}
