import { describe, it, expect } from 'vitest';
import { geometryBounds } from './map-preview';

describe('geometryBounds', () => {
  it('returns the point itself for a Point', () => {
    expect(geometryBounds({ type: 'Point', coordinates: [-0.23, 51.53] })).toEqual(
      { minLng: -0.23, minLat: 51.53, maxLng: -0.23, maxLat: 51.53 }
    );
  });

  it('spans every vertex of a LineString', () => {
    const b = geometryBounds({
      type: 'LineString',
      coordinates: [
        [-0.6, 51.7],
        [-0.4, 51.5],
        [-0.5, 51.9],
      ],
    });
    expect(b).toEqual({ minLng: -0.6, minLat: 51.5, maxLng: -0.4, maxLat: 51.9 });
  });

  it('recurses into MultiLineString segments', () => {
    const b = geometryBounds({
      type: 'MultiLineString',
      coordinates: [
        [
          [-0.6, 51.7],
          [-0.5, 51.6],
        ],
        [
          [-0.3, 51.9],
          [-0.2, 51.4],
        ],
      ],
    });
    expect(b).toEqual({ minLng: -0.6, minLat: 51.4, maxLng: -0.2, maxLat: 51.9 });
  });

  it('returns null for null / malformed geometry', () => {
    expect(geometryBounds(null)).toBeNull();
    expect(geometryBounds({ type: 'Point', coordinates: 'nope' })).toBeNull();
  });

  it('rejects out-of-range coordinates (bad import row)', () => {
    expect(geometryBounds({ type: 'Point', coordinates: [999, 999] })).toBeNull();
    expect(geometryBounds({ type: 'Point', coordinates: [-0.5, 91] })).toBeNull();
    expect(
      geometryBounds({
        type: 'LineString',
        coordinates: [
          [-0.5, 51.6],
          [200, 51.7],
        ],
      })
    ).toBeNull();
  });
});
