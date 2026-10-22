import type { Geometry } from '@/lib/import';
import type { MapGeometry } from '@/utils/map-geojson';

/**
 * Adapt the import domain's `Geometry` (lon/lat scalars / pairs) to the GeoJSON
 * `MapGeometry` the map utils and MapLibre consume. Coordinate order already
 * matches ([lon, lat] in both), so this is a pure shape change.
 */
export function importGeometryToGeoJSON(g: Geometry): MapGeometry {
  if (g.kind === 'point') {
    return { type: 'Point', coordinates: [g.lon, g.lat] };
  }
  return { type: 'LineString', coordinates: g.coords.map(([lon, lat]) => [lon, lat]) };
}
