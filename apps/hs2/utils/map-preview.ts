/**
 * Geometry framing helpers for the feature "Location" mini-map.
 */
import { asGeometry, type MapGeometry } from './map-geojson';

export type Bounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/** Bounding box of any Point / LineString / MultiLineString geometry. */
export function geometryBounds(geometry: unknown): Bounds | null {
  const g = asGeometry(geometry);
  if (!g) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    // A coordinate pair is [number, number]; anything else is a nested array.
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) visit(c);
  };

  visit((g as MapGeometry).coordinates);
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  // Reject out-of-range coords (e.g. a bad import row) so the caller falls back
  // to the "not mapped" card instead of handing MapLibre a lat/lng it throws on.
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  return { minLng, minLat, maxLng, maxLat };
}
