import { describe, it, expect } from 'vitest';
import { dateInRange, earliestDate } from './video-filters';

describe('dateInRange', () => {
  it('passes everything when no range is set', () => {
    expect(dateInRange('2024-06-15')).toBe(true);
    expect(dateInRange(null)).toBe(true);
    expect(dateInRange(undefined)).toBe(true);
  });

  it('drops undated rows once a range is active', () => {
    expect(dateInRange(null, '2024-01-01', '2024-12-31')).toBe(false);
    expect(dateInRange(undefined, '2024-01-01')).toBe(false);
    expect(dateInRange('', undefined, '2024-12-31')).toBe(false);
  });

  it('is inclusive on both bounds', () => {
    expect(dateInRange('2024-01-01', '2024-01-01', '2024-06-30')).toBe(true);
    expect(dateInRange('2024-06-30', '2024-01-01', '2024-06-30')).toBe(true);
  });

  it('excludes dates outside the range', () => {
    expect(dateInRange('2023-12-31', '2024-01-01', '2024-06-30')).toBe(false);
    expect(dateInRange('2024-07-01', '2024-01-01', '2024-06-30')).toBe(false);
  });

  it('supports an open-ended range (from only)', () => {
    expect(dateInRange('2024-06-15', '2024-01-01')).toBe(true);
    expect(dateInRange('2023-12-31', '2024-01-01')).toBe(false);
  });

  it('supports an open-ended range (to only)', () => {
    expect(dateInRange('2024-06-15', undefined, '2024-12-31')).toBe(true);
    expect(dateInRange('2025-01-01', undefined, '2024-12-31')).toBe(false);
  });

  it('compares only the date portion of a full timestamp', () => {
    expect(
      dateInRange('2024-06-30T23:30:00+00:00', '2024-01-01', '2024-06-30')
    ).toBe(true);
  });
});

describe('earliestDate', () => {
  it('returns the oldest date across the list', () => {
    expect(
      earliestDate(['2025-03-01', '2021-11-17', '2024-06-15'])
    ).toBe('2021-11-17');
  });

  it('ignores null/undefined/empty entries', () => {
    expect(earliestDate([null, '2024-06-15', undefined, ''])).toBe('2024-06-15');
  });

  it('returns null when nothing is dated', () => {
    expect(earliestDate([null, undefined, ''])).toBeNull();
    expect(earliestDate([])).toBeNull();
  });

  it('normalises full timestamps to the date portion', () => {
    expect(
      earliestDate(['2024-06-15T08:00:00Z', '2024-01-01T23:59:59Z'])
    ).toBe('2024-01-01');
  });
});
