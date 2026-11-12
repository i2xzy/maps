import { describe, expect, it } from 'vitest';

import { similarity, TYPO_THRESHOLD } from './trigram';

describe('similarity', () => {
  it('is 1 for identical strings', () => {
    expect(similarity('Wendover Dean Viaduct', 'Wendover Dean Viaduct')).toBe(1);
  });

  it('is 0 when both are empty / have no trigrams', () => {
    expect(similarity('', '')).toBe(0);
    expect(similarity('!!!', '???')).toBe(0);
  });

  it('matches a hand-computed value (cat vs cap = 2/6)', () => {
    expect(similarity('cat', 'cap')).toBeCloseTo(1 / 3, 10);
  });

  it('is case-insensitive', () => {
    expect(similarity('Curzon Street', 'curzon street')).toBe(1);
  });

  it('puts a one-letter typo above the threshold', () => {
    expect(similarity('Wendover Dean Viaductt', 'Wendover Dean Viaduct')).toBeGreaterThan(TYPO_THRESHOLD);
  });

  it('puts two unrelated feature names below the threshold', () => {
    expect(similarity('Curzon Street Station', 'Chiltern Tunnel North Portal')).toBeLessThan(
      TYPO_THRESHOLD,
    );
  });

  it('exposes the ported 0.45 threshold', () => {
    expect(TYPO_THRESHOLD).toBe(0.45);
  });
});
