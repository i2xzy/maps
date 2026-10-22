import { describe, expect, it } from 'vitest';

import type { Geometry } from '@/lib/import';

import { importGeometryToGeoJSON } from './review-geometry';

describe('importGeometryToGeoJSON', () => {
  it('maps a point to a GeoJSON Point, preserving lon/lat order', () => {
    const g: Geometry = { kind: 'point', lon: -1.5, lat: 52.3 };
    expect(importGeometryToGeoJSON(g)).toEqual({ type: 'Point', coordinates: [-1.5, 52.3] });
  });

  it('maps a line to a GeoJSON LineString of [lon, lat] pairs', () => {
    const g: Geometry = {
      kind: 'line',
      coords: [
        [-1.5, 52.3],
        [-1.4, 52.4],
      ],
    };
    expect(importGeometryToGeoJSON(g)).toEqual({
      type: 'LineString',
      coordinates: [
        [-1.5, 52.3],
        [-1.4, 52.4],
      ],
    });
  });
});
