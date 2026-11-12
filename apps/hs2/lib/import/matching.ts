// The name -> feature index. Resolution mirrors import-template.sql STEP 3:
// a candidate resolves to the UNION of a direct features.name match and any
// feature_title_aliases rows for it. Trigram similarity only suggests the
// closest feature/creator for the triage worklists.

import type { Catalogue, CreatorId, CreatorRef, FeatureId, FeatureRef } from './types';
import { norm } from './titles';
import { similarity } from './trigram';

export type NameResolution =
  | { kind: 'features'; via: 'name' | 'alias'; features: ReadonlyArray<FeatureRef> }
  | { kind: 'unmatched'; closest: { feature: FeatureRef; similarity: number } | null };

export type FeatureIndex = {
  /** Direct name match UNION alias match, else unmatched with the closest feature. */
  resolveCandidate(text: string): NameResolution;
  /** Resolve a list of exact feature names (span results, explicit lists); unknown names dropped. */
  featuresByNames(names: Iterable<string>): FeatureRef[];
  creatorByName(channel: string): CreatorRef | null;
  creatorById(id: CreatorId): CreatorRef | null;
  closestCreator(channel: string): CreatorRef | null;
  closestFeature(text: string): { feature: FeatureRef; similarity: number } | null;
};

function dedupeById(refs: ReadonlyArray<FeatureRef>): FeatureRef[] {
  const seen = new Set<FeatureId>();
  const out: FeatureRef[] = [];
  for (const ref of refs) {
    if (!seen.has(ref.id)) {
      seen.add(ref.id);
      out.push(ref);
    }
  }
  return out;
}

export function buildIndex(catalogue: Catalogue): FeatureIndex {
  const featureList = [...catalogue.featuresByName.values()];
  const creatorList = [...catalogue.creatorsByName.values()];
  const creatorsById = new Map<CreatorId, CreatorRef>(creatorList.map((c) => [c.id, c]));

  const closestFeature = (text: string): { feature: FeatureRef; similarity: number } | null => {
    let best: { feature: FeatureRef; similarity: number } | null = null;
    for (const feature of featureList) {
      const score = similarity(text, feature.name);
      if (best === null || score > best.similarity) best = { feature, similarity: score };
    }
    return best;
  };

  return {
    resolveCandidate(text) {
      const key = norm(text);
      const direct = catalogue.featuresByName.get(key);
      const aliased = catalogue.aliases.get(key) ?? [];
      const features = dedupeById([...(direct ? [direct] : []), ...aliased]);
      if (features.length > 0) {
        return { kind: 'features', via: direct ? 'name' : 'alias', features };
      }
      return { kind: 'unmatched', closest: closestFeature(text) };
    },
    featuresByNames(names) {
      const refs: FeatureRef[] = [];
      for (const name of names) {
        const ref = catalogue.featuresByName.get(norm(name));
        if (ref) refs.push(ref);
      }
      return dedupeById(refs);
    },
    creatorByName(channel) {
      return catalogue.creatorsByName.get(norm(channel)) ?? null;
    },
    creatorById(id) {
      return creatorsById.get(id) ?? null;
    },
    closestCreator(channel) {
      let best: { creator: CreatorRef; score: number } | null = null;
      for (const creator of creatorList) {
        const score = similarity(channel, creator.displayName);
        if (best === null || score > best.score) best = { creator, score };
      }
      return best?.creator ?? null;
    },
    closestFeature,
  };
}
