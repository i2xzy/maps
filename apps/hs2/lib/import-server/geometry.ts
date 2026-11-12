import type { Geometry } from '@/lib/import';

// The ONE place a parsed Geometry becomes the string written to media.location.
// If a probe shows Supabase rejects raw EWKT for that geography column, swap
// this body for an ST_GeomFromText RPC and nothing else in the commit changes.
export function geometryToEwkt(geometry: Geometry | null): string | null {
  if (!geometry) return null;
  if (geometry.kind === 'point') {
    return `SRID=4326;POINT(${geometry.lon} ${geometry.lat})`;
  }
  if (geometry.coords.length === 0) return null;
  const coords = geometry.coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ');
  return `SRID=4326;LINESTRING(${coords})`;
}
