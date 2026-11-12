import { describe, expect, it } from 'vitest';

import { buildCatalogue, type CatalogueRows } from './catalogue';
import { buildIndex } from './matching';
import { norm } from './titles';
import type { FeatureId, MediaId, Url } from './types';

const rows: CatalogueRows = {
  creators: [{ id: 'c1', displayName: 'DJSViews' }],
  features: [
    { id: 'f1', name: 'Wendover Dean Viaduct', chainage: 10, routeElementId: '165-L1' },
    { id: 'f2', name: 'Curzon Street Station', chainage: 20, routeElementId: null },
  ],
  aliases: [
    { alias: 'Water Orton Viaducts', featureName: 'Wendover Dean Viaduct' },
    { alias: 'Water Orton Viaducts', featureName: 'Curzon Street Station' },
    { alias: 'Ghost Alias', featureName: 'A Feature That Does Not Exist' },
  ],
  existingMedia: [{ url: 'https://youtu.be/existing0001', id: 'm1', featureIds: ['f2'] }],
};

describe('buildCatalogue', () => {
  it('keys creators and features by the shared normalisation (case/whitespace-insensitive)', () => {
    const index = buildIndex(buildCatalogue(rows));
    // A messy-cased, extra-whitespace candidate still resolves to the feature.
    const r = index.resolveCandidate('  wendover   DEAN viaduct ');
    expect(r.kind).toBe('features');
    if (r.kind === 'features') expect(r.features.map((f) => f.id)).toEqual(['f1']);
    expect(index.creatorByName('djsviews')?.id).toBe('c1');
  });

  it('resolves an alias to every feature it stands for', () => {
    const index = buildIndex(buildCatalogue(rows));
    const r = index.resolveCandidate('Water Orton Viaducts');
    expect(r.kind).toBe('features');
    if (r.kind === 'features') {
      expect(r.via).toBe('alias');
      expect(r.features.map((f) => f.id)).toEqual(['f1', 'f2']);
    }
  });

  it('drops an alias whose target feature is unknown', () => {
    const catalogue = buildCatalogue(rows);
    expect(catalogue.aliases.has('ghost alias' as never)).toBe(false);
  });

  it('classifies each feature onto a branch from its route_element_id', () => {
    const catalogue = buildCatalogue({
      creators: [],
      aliases: [],
      existingMedia: [],
      features: [
        { id: 'g1', name: 'Spur Overbridge', chainage: 1, routeElementId: 'B-12' },
        { id: 'g2', name: 'North Overbridge', chainage: 2, routeElementId: 'ND-3' },
        { id: 'g3', name: 'Main Overbridge', chainage: 3, routeElementId: '165-L1' },
        { id: 'g4', name: 'Null Overbridge', chainage: 4, routeElementId: null },
      ],
    });
    const branchOf = (name: string) => catalogue.featuresByName.get(norm(name))?.branch;
    expect(branchOf('Spur Overbridge')).toBe('spur');
    expect(branchOf('North Overbridge')).toBe('north');
    expect(branchOf('Main Overbridge')).toBe('main');
    expect(branchOf('Null Overbridge')).toBe('main');
  });

  it('keys existing media by exact url with its feature-id set', () => {
    const catalogue = buildCatalogue(rows);
    const entry = catalogue.existingMedia.get('https://youtu.be/existing0001' as Url);
    expect(entry?.id).toBe('m1' as MediaId);
    expect(entry?.featureIds.has('f2' as FeatureId)).toBe(true);
    expect(catalogue.existingMedia.get('https://youtu.be/other' as Url)).toBeUndefined();
  });
});
