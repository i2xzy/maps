'use client';

/**
 * Non-interactive mini-map for a review pin: shows where the pin sits (a red
 * point marker, or its line) plus the pin's selected features in their type
 * colours, so the admin can sanity-check both the location and that the chosen
 * features actually sit there before committing. A trimmed cousin of the
 * feature detail mini-map (components/feature/mini-map.tsx) — no interactive-map
 * Link; a VideoDisc for the pin and FeatureDiscs for the features.
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

import type { FeatureType } from '@supabase/types';
import { asGeometry, representativePoint, type MapGeometry } from '@/utils/map-geojson';
import { geometryBounds, type Bounds } from '@/utils/map-preview';
import { TYPE_COLORS, TYPE_FALLBACK } from '@/components/map/map-colors';
import { FeatureDisc } from '@/components/map/marker-disc';
import { VideoDisc } from '@/components/map/marker-disc';

const ASPECT = 5 / 3;
// A single high-contrast accent for the pin itself, legible over the satellite
// imagery and distinct from the features' type colours.
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

export type DrawFeature = {
  id: string;
  name: string;
  type: FeatureType;
  geometry: MapGeometry;
};

type Props = {
  pin: MapGeometry | null;
  shotType: string | null;
  features: DrawFeature[];
};

function mergeBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  return list.reduce((a, b) => ({
    minLng: Math.min(a.minLng, b.minLng),
    minLat: Math.min(a.minLat, b.minLat),
    maxLng: Math.max(a.maxLng, b.maxLng),
    maxLat: Math.max(a.maxLat, b.maxLat),
  }));
}

export default function ReviewMapInner({ pin, shotType, features }: Props) {
  // A WebGL/context failure (unsupported browser) blanks the map; degrade to a
  // plain placeholder rather than throwing. Transient tile errors are ignored.
  const [failed, setFailed] = useState(false);

  // Every drawable geometry's bounds (pin + features), merged to frame them all.
  const allBounds: Bounds[] = [];
  const pinGeom = pin ? asGeometry(pin) : null;
  if (pin) {
    const b = geometryBounds(pin);
    if (b) allBounds.push(b);
  }
  const drawFeatures = features.flatMap((f) => {
    const g = asGeometry(f.geometry);
    const b = geometryBounds(f.geometry);
    if (!g || !b) return [];
    allBounds.push(b);
    return [{ ...f, g }];
  });

  const bounds = mergeBounds(allBounds);
  // The loader only mounts this when there's something to draw, but guard anyway.
  if (!bounds) return null;

  // Fit to everything, expanded to a minimum span so a lone point still shows a
  // few km of context (enough for the style's zoom-gated labels). Matches the
  // feature mini-map's framing. ~0.0068° lat ≈ 0.75 km half-height.
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

  const pinIsPoint = pinGeom?.type === 'Point';
  const pinPoint = pin ? representativePoint(pin) : null;

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
            {/* Selected features, in their type colours, under the pin. */}
            {drawFeatures.map((f) => {
              const color = TYPE_COLORS[f.type] ?? TYPE_FALLBACK;
              if (f.g.type === 'Point') {
                const p = representativePoint(f.geometry);
                return p ? (
                  <Marker key={f.id} longitude={p[0]} latitude={p[1]} anchor='center'>
                    <FeatureDisc type={f.type} name={f.name} size='22px' />
                  </Marker>
                ) : null;
              }
              return (
                <Source
                  key={f.id}
                  id={`feat-${f.id}`}
                  type='geojson'
                  data={{ type: 'Feature', geometry: f.g, properties: {} }}
                >
                  <Layer
                    id={`feat-${f.id}-casing`}
                    type='line'
                    layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    paint={{ 'line-color': 'rgba(0,0,0,0.5)', 'line-width': 7 }}
                  />
                  <Layer
                    id={`feat-${f.id}-line`}
                    type='line'
                    layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    paint={{ 'line-color': color, 'line-width': 3.5 }}
                  />
                </Source>
              );
            })}

            {/* The pin itself, on top in the accent colour. */}
            {pin && pinGeom && !pinIsPoint && (
              <Source
                id='pin'
                type='geojson'
                data={{ type: 'Feature', geometry: pinGeom, properties: {} }}
              >
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
            {pin && pinIsPoint && pinPoint && (
              <Marker longitude={pinPoint[0]} latitude={pinPoint[1]} anchor='center'>
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
