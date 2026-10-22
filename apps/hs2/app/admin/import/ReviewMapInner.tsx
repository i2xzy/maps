'use client';

/**
 * Non-interactive mini-map for a review pin: shows where the pin sits (a point
 * marker, or its line) on the satellite basemap so the admin can sanity-check
 * the location before committing. A trimmed cousin of the feature detail
 * mini-map (components/feature/mini-map.tsx) — no interactive-map Link, no
 * feature type/colour; a VideoDisc marker and a single accent colour instead.
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
import { LuMapPinned } from 'react-icons/lu';

import { asGeometry, representativePoint, type MapGeometry } from '@/utils/map-geojson';
import { geometryBounds } from '@/utils/map-preview';
import { VideoDisc } from '@/components/map/marker-disc';

const ASPECT = 5 / 3;
// A single high-contrast accent for the pin marker and its line, legible over
// the satellite imagery (there is no per-creator colour at this stage).
const PIN_COLOR = '#ef4444';

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
  geometry: MapGeometry;
  shotType: string | null;
};

export default function ReviewMapInner({ geometry, shotType }: Props) {
  // A WebGL/context failure (unsupported browser) blanks the map; degrade to a
  // plain placeholder rather than throwing. Transient tile errors are ignored.
  const [failed, setFailed] = useState(false);

  const g = asGeometry(geometry);
  const bounds = geometryBounds(geometry);
  const point = representativePoint(geometry);
  // The loader only mounts this when geometry exists, but guard anyway.
  if (!g || !bounds || !point) return null;

  const isPoint = g.type === 'Point';

  // Fit to the geometry, expanded to a minimum span so a point still shows a few
  // km of context (enough for the style's zoom-gated town/road labels). Matches
  // the feature mini-map's framing. ~0.0068° lat ≈ 0.75 km half-height.
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
    <Box
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
              // Fatal (WebGL/context/bad-coord) → degrade to the placeholder.
              // Transient tile 404s stay non-fatal (a mostly rendered preview
              // beats blanking the whole card).
              const msg = String(e?.error?.message ?? '');
              if (
                /webgl|context lost|failed to (initialize|create)|invalid lnglat/i.test(msg)
              ) {
                setFailed(true);
              } else {
                console.warn('[review-map] non-fatal error:', msg);
              }
            }}
            onLoad={(e: MapEvent) => {
              try {
                e.target.fitBounds(view, { padding: 24, animate: false });
              } catch {
                setFailed(true);
              }
            }}
          >
            {!isPoint && (
              <Source id='pin' type='geojson' data={{ type: 'Feature', geometry: g, properties: {} }}>
                <Layer
                  id='pin-line-casing'
                  type='line'
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': 'rgba(0,0,0,0.5)', 'line-width': 8 }}
                />
                <Layer
                  id='pin-line'
                  type='line'
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': PIN_COLOR, 'line-width': 4 }}
                />
              </Source>
            )}
            {isPoint && (
              <Marker longitude={point[0]} latitude={point[1]} anchor='center'>
                <VideoDisc shotType={shotType} color={PIN_COLOR} size='26px' />
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
    </Box>
  );
}
