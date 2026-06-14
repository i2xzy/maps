/**
 * Map colour palette.
 *
 * MapLibre paint properties need concrete colours (hex/rgb); the app's
 * `featureTypes` / `featureStatuses` config uses Chakra design tokens
 * (`purple.500`, `fg`, ...) which MapLibre can't read. This module is the
 * map-only translation of those tokens to hex, plus the data-driven
 * expression that colours markers/lines by construction status.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import type { FeatureStatus, FeatureType } from '@supabase/types';

/**
 * Feature type -> hex, mirroring the Chakra tokens in featureTypes (config.ts).
 * Markers/lines are coloured by type so the map reads as "what is this", with
 * construction status surfaced elsewhere.
 */
export const TYPE_COLORS: Record<FeatureType, string> = {
  overbridge: '#B7791F', // yellow.600
  underbridge: '#C53030', // red.600
  underpass: '#9B2C2C', // red.700 (distinguish from underbridge)
  viaduct: '#805AD5', // purple.500
  box_structure: '#6B46C1', // purple.600 (distinguish from viaduct)
  tunnel: '#2D3748', // gray.700
  cut_and_cover: '#2F855A', // green.600
  embankment: '#8B5A2B', // brown.500
  cutting: '#DD6B20', // orange.500
  shaft: '#718096', // gray.500
  station: '#1A202C', // fg (near-black)
  culvert: '#3182CE', // blue.500
};

/** Fallback for rows with an unknown/missing type. */
export const TYPE_FALLBACK = '#718096';

/** Construction status -> hex, mirroring featureStatuses colours in config.ts. */
export const STATUS_COLORS: Record<NonNullable<FeatureStatus>, string> = {
  NOT_STARTED: '#C53030',
  PREP_WORK: '#E53E3E',
  FOUNDATIONS: '#B7791F',
  DIGGING: '#D69E2E',
  SEGMENT_INSTALLATION: '#3182CE',
  PIERS: '#3182CE',
  SIDE_TUNNELS: '#3182CE',
  DECK: '#3182CE',
  PARAPET: '#2B6CB0',
  SURFACE_BUILDINGS: '#2B6CB0',
  LANDSCAPING: '#38A169',
  CIVILS: '#38A169',
  COMPLETED: '#2F855A',
};

/** Fallback for rows with no/unknown status. */
export const STATUS_FALLBACK = '#718096';

/** Default video-marker colour — neutral grey for creators outside the top N. */
export const DEFAULT_MEDIA_COLOR = '#94A3B8';

/** Cluster bubble + count colours. */
export const CLUSTER_COLOR = '#2D3748';
export const CLUSTER_TEXT_COLOR = '#FFFFFF';

/**
 * MapLibre `match` expression: colour a feature by its `status` property,
 * falling back to grey. Used for both the unclustered point and line layers.
 */
export function statusColorExpression(): ExpressionSpecification {
  const pairs = Object.entries(STATUS_COLORS).flat();
  return [
    'match',
    ['get', 'status'],
    ...pairs,
    STATUS_FALLBACK,
  ] as unknown as ExpressionSpecification;
}

/**
 * MapLibre `match` expression: colour a feature by its `type` property,
 * falling back to grey. Used for the feature point and line layers.
 */
export function typeColorExpression(): ExpressionSpecification {
  const pairs = Object.entries(TYPE_COLORS).flat();
  return [
    'match',
    ['get', 'type'],
    ...pairs,
    TYPE_FALLBACK,
  ] as unknown as ExpressionSpecification;
}
