import { describe, expect, it } from 'vitest';

import { asValidIsoDate, parseBritishDate } from './dates';

describe('parseBritishDate', () => {
  const cases: Array<[string, { monthEnd?: boolean } | undefined, string | null]> = [
    ['6 Jun 2024', undefined, '2024-06-06'],
    ['6 June 2024', undefined, '2024-06-06'],
    ['6 june 2024', undefined, '2024-06-06'],
    ['5 Sept 2024', undefined, '2024-09-05'],
    ['Sept 2024', { monthEnd: true }, '2024-09-30'],
    ['28 Jul 24', undefined, '2024-07-28'],
    ['24Aug 2025', undefined, '2025-08-24'],
    ['Jan 2024', undefined, '2024-01-01'],
    ['Jan 2024', { monthEnd: true }, '2024-01-31'],
    ['Feb 2024', { monthEnd: true }, '2024-02-29'],
    ['Feb 2023', { monthEnd: true }, '2023-02-28'],
    ['29 Feb 2024', undefined, '2024-02-29'],
    ['29 Feb 2023', undefined, null],
    ['31 Apr 2024', undefined, null],
    ['1 Jan 68', undefined, '2068-01-01'],
    ['1 Jan 69', undefined, '1969-01-01'],
    ['Jan 25', { monthEnd: true }, '2025-01-31'],
    ['', undefined, null],
    ['djsviews', undefined, null],
    ['Back in time: HS2 Curzon Street', undefined, null],
    ['6 Jun 2024 extra', undefined, null],
    ['6 Smarch 2024', undefined, null],
  ];
  it.each(cases)('%s (%o) -> %s', (raw, opts, expected) => {
    expect(parseBritishDate(raw, opts)).toBe(expected);
  });
});

describe('asValidIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(asValidIsoDate('2025-01-02')).toBe('2025-01-02');
  });
  it('rejects an impossible day', () => {
    expect(asValidIsoDate('2025-02-31')).toBeNull();
  });
  it('rejects a non-ISO string', () => {
    expect(asValidIsoDate('2 Jan 2025')).toBeNull();
  });
});
