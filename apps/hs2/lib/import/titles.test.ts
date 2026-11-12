import { describe, expect, it } from 'vitest';

import type { NormName } from './types';
import { applyCandidateFixes, norm, rangeEndpoints, splitTitle } from './titles';

describe('norm', () => {
  it('lowercases, collapses whitespace incl. nbsp, and trims', () => {
    expect(norm('  Wendover Dean  Viaduct ')).toBe('wendover dean viaduct');
  });
});

describe('splitTitle', () => {
  it('strips the date prefix and keeps a single candidate', () => {
    const parts = splitTitle('2025-01-02 Wendover Dean Viaduct');
    expect(parts.datePrefix).toBe('2025-01-02');
    expect(parts.body).toBe('Wendover Dean Viaduct');
    expect(parts.candidates).toEqual(['Wendover Dean Viaduct']);
  });

  it('splits the body on "|" (real 2026 row)', () => {
    const parts = splitTitle('2026-01-04 Westbury Viaduct | A422 Brackley Road Overbridge');
    expect(parts.candidates).toEqual(['Westbury Viaduct', 'A422 Brackley Road Overbridge']);
  });

  it('splits the body on "&"', () => {
    const parts = splitTitle('2024-01-01 Water Orton No. 1 Viaduct & Water Orton No. 2 Viaduct');
    expect(parts.candidates).toEqual(['Water Orton No. 1 Viaduct', 'Water Orton No. 2 Viaduct']);
  });

  it('keeps a range as a single candidate (no split on " to ") (real 2026 row)', () => {
    const parts = splitTitle('2026-01-02 A422 Brackley Road Overbridge to A43 Oxford Road Overbridge');
    expect(parts.candidates).toEqual(['A422 Brackley Road Overbridge to A43 Oxford Road Overbridge']);
  });

  it('has no date prefix when the title does not start with one', () => {
    const parts = splitTitle('Just A Name');
    expect(parts.datePrefix).toBeNull();
    expect(parts.candidates).toEqual(['Just A Name']);
  });
});

describe('rangeEndpoints', () => {
  it('returns first and last around " to " (real 2026 row)', () => {
    expect(rangeEndpoints('Chiltern Tunnel North Portal to Leather Lane Overbridge')).toEqual({
      from: 'Chiltern Tunnel North Portal',
      to: 'Leather Lane Overbridge',
    });
  });

  it('takes the first and last across multiple " to "', () => {
    expect(rangeEndpoints('A to B to C')).toEqual({ from: 'A', to: 'C' });
  });

  it('is case-insensitive', () => {
    expect(rangeEndpoints('X TO Y')).toEqual({ from: 'X', to: 'Y' });
  });

  it('returns null when there is no " to "', () => {
    expect(rangeEndpoints('Westbury Viaduct')).toBeNull();
  });
});

describe('applyCandidateFixes', () => {
  const fixes = new Map<NormName, string>([[norm('Wendover Dean Viaductt'), 'Wendover Dean Viaduct']]);

  it('rewrites a typo candidate, preserving the date prefix', () => {
    expect(applyCandidateFixes('2025-01-02 Wendover Dean Viaductt', fixes)).toBe(
      '2025-01-02 Wendover Dean Viaduct',
    );
  });

  it('rewrites only the matching candidate and keeps the separator', () => {
    const multi = new Map<NormName, string>([[norm('Typo Name'), 'Real Name']]);
    expect(applyCandidateFixes('2026-01-04 Westbury Viaduct | Typo Name', multi)).toBe(
      '2026-01-04 Westbury Viaduct | Real Name',
    );
  });

  it('leaves a title untouched when nothing matches', () => {
    expect(applyCandidateFixes('2025-01-02 Curzon Street Station', fixes)).toBe(
      '2025-01-02 Curzon Street Station',
    );
  });

  it('rewrites a range endpoint typo while keeping the "to" connector', () => {
    const fix = new Map<NormName, string>([[norm('Washood Heath'), 'Washwood Heath']]);
    expect(applyCandidateFixes('2026-01-01 Curzon Street Station to Washood Heath', fix)).toBe(
      '2026-01-01 Curzon Street Station to Washwood Heath',
    );
  });
});
