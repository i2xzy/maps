/**
 * Map GeoJSON assembly.
 *
 * The `features_geo` / `media_geo` Postgres views expose each row's geometry as
 * a parsed GeoJSON object in a `geojson` column (ST_AsGeoJSON(geom, 6)::json).
 * MapLibre wants those rows as two FeatureCollections per layer — one of points,
 * one of lines — because clustering is a point-source-only feature.
 *
 *   view rows ({ geojson, ...props })
 *        │  partition by geometry type
 *        ├── Point             ─▶ points  FeatureCollection   (clustered)
 *        └── LineString / Multi ─▶ lines  FeatureCollection   (not clustered)
 *
 * Rows with null / malformed geometry are skipped, never thrown — a single bad
 * import row must not blank the whole layer.
 */

/** A GeoJSON geometry as returned by ST_AsGeoJSON(...)::json. */
export type MapGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }
  | { type: string; coordinates: unknown };

/**
 * A view row: arbitrary properties plus the geometry under `geojson`. `geojson`
 * is typed `unknown` because the source is Postgres `json` (the generated type
 * is the recursive `Json`); the geometry is narrowed at runtime in `asGeometry`.
 */
export type GeoRow = Record<string, unknown> & {
  geojson: unknown;
};

export type MapFeature = {
  type: 'Feature';
  geometry: MapGeometry;
  properties: Record<string, unknown>;
};

export type MapFeatureCollection = {
  type: 'FeatureCollection';
  features: MapFeature[];
};

/** Result of partitioning a set of rows into point and line layers. */
export type PartitionedGeoJSON = {
  points: MapFeatureCollection;
  lines: MapFeatureCollection;
};

const emptyFC = (): MapFeatureCollection => ({
  type: 'FeatureCollection',
  features: [],
});

/** Narrow an unknown value to a usable GeoJSON geometry, or null. */
export function asGeometry(value: unknown): MapGeometry | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as { type?: unknown; coordinates?: unknown };
  if (typeof g.type !== 'string') return null;
  if (g.coordinates == null) return null;
  return value as MapGeometry;
}

/**
 * Split view rows into point and line FeatureCollections. The `geojson` field
 * is lifted into each feature's geometry; every other field becomes a property.
 * Null or malformed geometry is dropped silently. Geometry types other than
 * Point / LineString / MultiLineString are dropped (none are expected from the
 * HS2 data, which is points + linestrings only).
 */
export function rowsToFeatureCollection(
  rows: GeoRow[] | null | undefined
): PartitionedGeoJSON {
  const points = emptyFC();
  const lines = emptyFC();
  if (!rows) return { points, lines };

  for (const row of rows) {
    const geometry = asGeometry(row.geojson);
    if (!geometry) continue;

    // Properties = everything except the geometry payload.
    const properties: Record<string, unknown> = { ...row };
    delete properties.geojson;

    const feature: MapFeature = { type: 'Feature', geometry, properties };

    if (geometry.type === 'Point') {
      points.features.push(feature);
    } else if (
      geometry.type === 'LineString' ||
      geometry.type === 'MultiLineString'
    ) {
      lines.features.push(feature);
    }
    // any other geometry type: skipped
  }

  return { points, lines };
}

/**
 * A representative [lng, lat] for any geometry — the point itself, or the
 * midpoint vertex of a line. Used to fly to a feature picked from search.
 */
export function representativePoint(
  geometry: unknown
): [number, number] | null {
  const g = asGeometry(geometry);
  if (!g) return null;

  if (g.type === 'Point') {
    const c = g.coordinates as number[];
    return c.length >= 2 ? [c[0]!, c[1]!] : null;
  }
  if (g.type === 'LineString') {
    const c = g.coordinates as number[][];
    const mid = c[Math.floor(c.length / 2)];
    return mid && mid.length >= 2 ? [mid[0]!, mid[1]!] : null;
  }
  if (g.type === 'MultiLineString') {
    const line = (g.coordinates as number[][][])[0];
    const mid = line?.[Math.floor(line.length / 2)];
    return mid && mid.length >= 2 ? [mid[0]!, mid[1]!] : null;
  }
  return null;
}
