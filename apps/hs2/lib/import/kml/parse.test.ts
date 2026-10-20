import { describe, expect, it } from 'vitest';

import type { ParsedLayer, Pin } from '../types';
import { parseLayer } from './parse';

function firstPin(layer: ParsedLayer): Pin {
  const pin = layer.pins.at(0);
  if (!pin) throw new Error('expected at least one parsed pin');
  return pin;
}

type PmData = Record<string, string>;

function placemark(opts: {
  name: string;
  data?: PmData;
  point?: readonly [number, number];
  line?: ReadonlyArray<readonly [number, number]>;
}): string {
  const dataXml = Object.entries(opts.data ?? {})
    .map(([k, v]) => `<Data name="${k}"><value>${v}</value></Data>`)
    .join('');
  let geom = '';
  if (opts.point) geom = `<Point><coordinates>${opts.point[0]},${opts.point[1]},0</coordinates></Point>`;
  else if (opts.line) {
    geom = `<LineString><coordinates>${opts.line.map(([a, b]) => `${a},${b},0`).join(' ')}</coordinates></LineString>`;
  }
  return `<Placemark><name>${opts.name}</name><ExtendedData>${dataXml}</ExtendedData>${geom}</Placemark>`;
}

function doc(...pms: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>${pms.join('')}</Folder></Document></kml>`;
}

describe('parseLayer: a well-formed point pin', () => {
  const layer = parseLayer(
    doc(
      placemark({
        name: '2025-01-02 Wendover Dean Viaduct',
        data: {
          Channel: 'djsviews',
          Link: 'https://www.youtube.com/watch?v=FKKd6Omx0d8',
          Type: 'Drone',
          date: '2 Jan 2025',
          description: 'HS2 Wendover Dean | Drone Footage',
        },
        point: [-0.7201648, 51.7355967],
      }),
    ),
  );
  const pin = firstPin(layer);

  it('carries every parsed field', () => {
    expect(pin.title).toBe('2025-01-02 Wendover Dean Viaduct');
    expect(pin.channel).toBe('djsviews');
    expect(pin.url).toBe('https://www.youtube.com/watch?v=FKKd6Omx0d8');
    expect(pin.youtubeId).toBe('FKKd6Omx0d8');
    expect(pin.shotType).toBe('drone');
    expect(pin.publishedAt).toBe('2025-01-02');
    expect(pin.recordedDate).toBeNull();
    expect(pin.description).toBe('HS2 Wendover Dean | Drone Footage');
  });

  it('parses a point geometry (altitude dropped)', () => {
    expect(pin.geometry).toEqual({ kind: 'point', lon: -0.7201648, lat: 51.7355967 });
  });

  it('emits no warnings for a clean pin', () => {
    expect(layer.warnings).toEqual([]);
  });
});

describe('parseLayer: geometry and whitespace', () => {
  it('parses a LineString', () => {
    const layer = parseLayer(
      doc(placemark({ name: 'A to B', line: [[-0.7, 51.7], [-0.69, 51.71], [-0.68, 51.72]] })),
    );
    expect(firstPin(layer).geometry).toEqual({
      kind: 'line',
      coords: [[-0.7, 51.7], [-0.69, 51.71], [-0.68, 51.72]],
    });
  });

  it('normalises nbsp and tab in fields', () => {
    const layer = parseLayer(
      doc(placemark({ name: '2025-01-02 Curzon\tStreet', data: { Channel: 'a b' } })),
    );
    expect(firstPin(layer).title).toBe('2025-01-02 Curzon Street');
    expect(firstPin(layer).channel).toBe('a b');
  });
});

describe('parseLayer: the four youtube URL forms', () => {
  const forms = [
    'https://www.youtube.com/watch?v=FKKd6Omx0d8',
    'https://youtu.be/FKKd6Omx0d8?si=xW&amp;t=158',
    'https://www.youtube.com/embed/FKKd6Omx0d8',
    'https://www.youtube.com/shorts/FKKd6Omx0d8',
  ];
  it.each(forms)('extracts the id from %s', (link) => {
    const layer = parseLayer(doc(placemark({ name: 'x', data: { Type: 'drone', Link: link } })));
    expect(firstPin(layer).youtubeId).toBe('FKKd6Omx0d8');
  });
});

describe('parseLayer: month-only and two-digit-year dates', () => {
  it('published month-only takes the first day; recorded takes the last', () => {
    const layer = parseLayer(
      doc(
        placemark({
          name: 'x',
          data: { Type: 'drone', date: 'Jan 2024', recorded_date: 'Feb 2024' },
        }),
      ),
    );
    expect(firstPin(layer).publishedAt).toBe('2024-01-01');
    expect(firstPin(layer).recordedDate).toBe('2024-02-29');
  });

  it('parses a two-digit year', () => {
    const layer = parseLayer(doc(placemark({ name: 'x', data: { Type: 'drone', date: '28 Jul 24' } })));
    expect(firstPin(layer).publishedAt).toBe('2024-07-28');
  });
});

describe('parseLayer: warnings are data', () => {
  it('blanks a non-URL Link and warns; the pin url is null', () => {
    const layer = parseLayer(
      doc(placemark({ name: 'x', data: { Type: 'drone', Link: 'Wendover Dean Viaduct' } })),
    );
    expect(firstPin(layer).url).toBeNull();
    expect(layer.warnings).toContainEqual({
      pin: 0,
      kind: 'non-url-link',
      link: 'Wendover Dean Viaduct',
    });
  });

  it('warns on an unmapped shot type and leaves shotType null', () => {
    const layer = parseLayer(doc(placemark({ name: 'x', data: { Type: 'satellite pass' } })));
    expect(firstPin(layer).shotType).toBeNull();
    expect(layer.warnings).toContainEqual({ pin: 0, kind: 'unmapped-shot-type', raw: 'satellite pass' });
  });

  it('warns on an unparsed date', () => {
    const layer = parseLayer(doc(placemark({ name: 'x', data: { Type: 'drone', date: 'sometime' } })));
    expect(firstPin(layer).publishedAt).toBeNull();
    expect(layer.warnings).toContainEqual({ pin: 0, kind: 'unparsed-date', field: 'published', raw: 'sometime' });
  });

  it('warns when there is a URL but no extractable youtube id', () => {
    const layer = parseLayer(
      doc(placemark({ name: 'x', data: { Type: 'drone', Link: 'https://vimeo.com/123' } })),
    );
    expect(layer.warnings).toContainEqual({ pin: 0, kind: 'no-youtube-id', url: 'https://vimeo.com/123' });
  });

  it('falls back to the title date when the date field is junk, and warns', () => {
    const layer = parseLayer(
      doc(placemark({ name: '2024-06-06 Something', data: { Type: 'drone', date: 'garbage' } })),
    );
    expect(firstPin(layer).publishedAt).toBe('2024-06-06');
    expect(layer.warnings).toContainEqual({
      pin: 0,
      kind: 'date-from-title',
      titleDate: '2024-06-06',
      raw: 'garbage',
    });
  });

  it('does not warn date-from-title when the date field was empty', () => {
    const layer = parseLayer(doc(placemark({ name: '2024-06-06 Something', data: { Type: 'drone' } })));
    expect(firstPin(layer).publishedAt).toBe('2024-06-06');
    expect(layer.warnings.some((w) => w.kind === 'date-from-title')).toBe(false);
  });
});

describe('parseLayer: swap detection', () => {
  it('flags a date sitting in the Channel field (creator is wrong)', () => {
    const layer = parseLayer(
      doc(placemark({ name: 'x', data: { Type: 'drone', Channel: '6 Jun 2024' } })),
    );
    expect(layer.warnings).toContainEqual({
      pin: 0,
      kind: 'misplaced-date',
      field: 'channel',
      value: '6 Jun 2024',
    });
  });

  it('flags a description that is entirely a date', () => {
    const layer = parseLayer(
      doc(placemark({ name: 'x', data: { Type: 'drone', description: 'Jan 2024' } })),
    );
    expect(layer.warnings).toContainEqual({
      pin: 0,
      kind: 'misplaced-date',
      field: 'description',
      value: 'Jan 2024',
    });
  });
});

describe('parseLayer: nested placemarks and ordinals', () => {
  it('collects placemarks in document order across folders', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>${placemark(
      { name: 'first', data: { Type: 'drone' } },
    )}</Folder><Folder>${placemark({ name: 'second', data: { Type: 'drone' } })}</Folder></Document></kml>`;
    const layer = parseLayer(kml);
    expect(layer.pins.map((p) => p.title)).toEqual(['first', 'second']);
    expect(layer.pins.map((p) => p.ordinal)).toEqual([0, 1]);
  });
});
