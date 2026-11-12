import { describe, expect, it } from 'vitest';

import { buildIndex } from './matching';
import { TYPO_THRESHOLD } from './trigram';
import { catalogueFixture, creator, feature } from './test-support';

const wendover = feature('f1', 'Wendover Dean Viaduct');
const curzon = feature('f2', 'Curzon Street Station');
const waterOrton1 = feature('f3', 'Water Orton No. 1 Viaduct');
const waterOrton2 = feature('f4', 'Water Orton No. 2 Viaduct');

const index = buildIndex(
  catalogueFixture({
    features: [wendover, curzon, waterOrton1, waterOrton2],
    aliases: [['Water Orton Viaducts', [waterOrton1, waterOrton2]]],
    creators: [creator('c1', 'djsviews'), creator('c2', 'cuemaster')],
  }),
);

describe('resolveCandidate', () => {
  it('matches a feature by name (case-insensitively)', () => {
    const r = index.resolveCandidate('wendover dean viaduct');
    expect(r).toEqual({ kind: 'features', via: 'name', features: [wendover] });
  });

  it('matches an alias to several features', () => {
    const r = index.resolveCandidate('Water Orton Viaducts');
    expect(r.kind).toBe('features');
    if (r.kind === 'features') {
      expect(r.via).toBe('alias');
      expect(r.features).toEqual([waterOrton1, waterOrton2]);
    }
  });

  it('reports a typo as unmatched with a close feature', () => {
    const r = index.resolveCandidate('Wendover Dean Viaductt');
    expect(r.kind).toBe('unmatched');
    if (r.kind === 'unmatched') {
      expect(r.closest?.feature).toEqual(wendover);
      expect(r.closest?.similarity).toBeGreaterThan(TYPO_THRESHOLD);
    }
  });

  it('reports an unknown name as unmatched with a distant closest', () => {
    const r = index.resolveCandidate('Somewhere Else Entirely');
    expect(r.kind).toBe('unmatched');
    if (r.kind === 'unmatched') {
      expect(r.closest?.similarity).toBeLessThan(TYPO_THRESHOLD);
    }
  });
});

describe('creator lookup', () => {
  it('resolves a channel to a creator by normalised name', () => {
    expect(index.creatorByName('DJSViews')?.id).toBe('c1');
  });

  it('returns null for an unknown channel', () => {
    expect(index.creatorByName('nobody')).toBeNull();
  });

  it('suggests the closest creator for a misspelled channel', () => {
    expect(index.closestCreator('djsview')?.id).toBe('c1');
  });
});

describe('featuresByNames', () => {
  it('resolves known names and drops unknown ones', () => {
    const refs = index.featuresByNames(['Wendover Dean Viaduct', 'Curzon Street Station', 'ghost']);
    expect(refs).toEqual([wendover, curzon]);
  });
});
