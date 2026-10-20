import { describe, expect, it } from 'vitest';

import { asUrl, normaliseWhitespace, shotTypeFromLabel, youtubeId } from './fields';

describe('normaliseWhitespace', () => {
  it('collapses nbsp, tab, newline and runs, then trims', () => {
    expect(normaliseWhitespace('a b')).toBe('a b');
    expect(normaliseWhitespace('a\tb')).toBe('a b');
    expect(normaliseWhitespace('  a   b\n c  ')).toBe('a b c');
  });
});

describe('youtubeId', () => {
  const cases: Array<[string, string | null]> = [
    ['https://www.youtube.com/watch?v=FKKd6Omx0d8', 'FKKd6Omx0d8'],
    ['https://youtu.be/FKKd6Omx0d8?si=P89rj19dc1oeeQOc&t=152', 'FKKd6Omx0d8'],
    ['https://www.youtube.com/embed/FKKd6Omx0d8', 'FKKd6Omx0d8'],
    ['https://www.youtube.com/shorts/FKKd6Omx0d8', 'FKKd6Omx0d8'],
    ['https://www.youtube.com/watch?v=1_ehv0S4DvI', '1_ehv0S4DvI'],
    ['https://www.youtube.com/watch?v=X-p8w_m31sE', 'X-p8w_m31sE'],
    ['https://example.com/no-id-here', null],
    ['', null],
  ];
  it.each(cases)('%s -> %s', (url, expected) => {
    expect(youtubeId(url)).toBe(expected);
  });
});

describe('shotTypeFromLabel', () => {
  const cases: Array<[string, string | null]> = [
    ['Drone', 'drone'],
    ['elevated view', 'elevated'],
    ['CGI render', 'illustration'],
    ['mockup', 'illustration'],
    ['animation', 'illustration'],
    ['aeroplane', 'aircraft'],
    ['plane flyover', 'aircraft'],
    ['flight', 'aircraft'],
    ['ground', 'ground'],
    ['point observation', 'ground'],
    ['vehicle cab', 'vehicle'],
    ['cab ride', 'vehicle'],
    ['mixed', 'mixed'],
    ['', null],
    ['satellite', null],
  ];
  it.each(cases)('%s -> %s', (raw, expected) => {
    expect(shotTypeFromLabel(raw)).toBe(expected);
  });

  it('honours the rule ordering: drone wins over a later keyword', () => {
    expect(shotTypeFromLabel('drone render')).toBe('drone');
    expect(shotTypeFromLabel('drone from an elevated platform')).toBe('drone');
  });
});

describe('asUrl', () => {
  it('accepts http(s) and trims', () => {
    expect(asUrl('https://x.com/a')).toBe('https://x.com/a');
    expect(asUrl(' http://x.com ')).toBe('http://x.com');
  });
  it('rejects a pasted feature name or blank', () => {
    expect(asUrl('Wendover Dean Viaduct')).toBeNull();
    expect(asUrl('')).toBeNull();
  });
});
