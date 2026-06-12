import { describe, it, expect } from 'vitest';
import { rowsToFeatureCollection, type GeoRow } from './map-geojson';

describe('rowsToFeatureCollection', () => {
  it('partitions mixed Point and LineString rows into the right layers', () => {
    const rows: GeoRow[] = [
      {
        id: 'a',
        name: 'Old Oak Common',
        geojson: { type: 'Point', coordinates: [-0.23, 51.53] },
      },
      {
        id: 'b',
        name: 'Chiltern Tunnel',
        geojson: {
          type: 'LineString',
          coordinates: [
            [-0.5, 51.6],
            [-0.6, 51.7],
          ],
        },
      },
      {
        id: 'c',
        name: 'Drone flyover',
        geojson: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-0.7, 51.8],
              [-0.8, 51.9],
            ],
          ],
        },
      },
    ];

    const { points, lines } = rowsToFeatureCollection(rows);

    expect(points.features).toHaveLength(1);
    expect(points.features[0]?.properties.id).toBe('a');
    expect(points.features[0]?.geometry.type).toBe('Point');

    expect(lines.features).toHaveLength(2);
    expect(lines.features.map(f => f.properties.id)).toEqual(['b', 'c']);
    // The geometry payload must not leak into properties.
    expect(lines.features[0]?.properties).not.toHaveProperty('geojson');
  });

  it('skips rows with null geometry without throwing', () => {
    const rows: GeoRow[] = [
      { id: 'a', geojson: null },
      { id: 'b', geojson: { type: 'Point', coordinates: [-0.1, 51.5] } },
    ];

    const { points, lines } = rowsToFeatureCollection(rows);

    expect(points.features).toHaveLength(1);
    expect(points.features[0]?.properties.id).toBe('b');
    expect(lines.features).toHaveLength(0);
  });

  it('returns empty FeatureCollections for empty / nullish input', () => {
    const inputs: (GeoRow[] | null | undefined)[] = [[], null, undefined];
    for (const input of inputs) {
      const { points, lines } = rowsToFeatureCollection(input);
      expect(points).toEqual({ type: 'FeatureCollection', features: [] });
      expect(lines).toEqual({ type: 'FeatureCollection', features: [] });
    }
  });

  it('tolerates malformed geometry (missing type or coordinates)', () => {
    const rows = [
      { id: 'a', geojson: {} },
      { id: 'b', geojson: { type: 'Point' } },
      { id: 'c', geojson: { coordinates: [0, 0] } },
      { id: 'd', geojson: 'not-an-object' },
      { id: 'e', geojson: { type: 'Point', coordinates: [-0.1, 51.5] } },
    ] as unknown as GeoRow[];

    const { points, lines } = rowsToFeatureCollection(rows);

    // Only the one well-formed Point survives; nothing throws.
    expect(points.features).toHaveLength(1);
    expect(points.features[0]?.properties.id).toBe('e');
    expect(lines.features).toHaveLength(0);
  });
});
