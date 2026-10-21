// The one owner of turning raw DB rows into a Catalogue. It holds the only
// production use of the internal `norm`, so every name key in the Catalogue is
// built the same way the resolver looks names up. DB rows are trusted internal
// data: ids are branded here without re-validation. Unknown alias targets are
// dropped, matching the index's featuresByNames behaviour, so an alias can never
// point at a feature the catalogue doesn't hold.

import type {
  Branch,
  Catalogue,
  CreatorId,
  CreatorRef,
  FeatureId,
  FeatureRef,
  MediaId,
  NormName,
  Url,
} from './types';
import { norm } from './titles';

export type CatalogueRows = {
  creators: ReadonlyArray<{ id: string; displayName: string }>;
  features: ReadonlyArray<{ id: string; name: string; chainage: number | null; routeElementId: string | null }>;
  aliases: ReadonlyArray<{ alias: string; featureName: string }>;
  existingMedia: ReadonlyArray<{ url: string; id: string; featureIds: ReadonlyArray<string> }>;
};

// The operator's rule: route_element_id starting with B is the Birmingham spur,
// N is the north chord, everything else (numeric ids, null) is the main line.
export function branchOf(routeElementId: string | null): Branch {
  if (routeElementId?.startsWith('B')) return 'spur';
  if (routeElementId?.startsWith('N')) return 'north';
  return 'main';
}

const BRANCH_ORDER: ReadonlyArray<Branch> = ['main', 'spur', 'north'];

/** The branches present among these features, in fixed order. */
export function distinctBranches(features: ReadonlyArray<FeatureRef>): Branch[] {
  const present = new Set(features.map((f) => f.branch));
  return BRANCH_ORDER.filter((b) => present.has(b));
}

export function buildCatalogue(rows: CatalogueRows): Catalogue {
  const creatorsByName = new Map<NormName, CreatorRef>();
  for (const c of rows.creators) {
    creatorsByName.set(norm(c.displayName), { id: c.id as CreatorId, displayName: c.displayName });
  }

  const featuresByName = new Map<NormName, FeatureRef>();
  for (const f of rows.features) {
    featuresByName.set(norm(f.name), {
      id: f.id as FeatureId,
      name: f.name,
      chainage: f.chainage,
      branch: branchOf(f.routeElementId),
    });
  }

  const aliases = new Map<NormName, FeatureRef[]>();
  for (const a of rows.aliases) {
    const ref = featuresByName.get(norm(a.featureName));
    if (!ref) continue;
    const key = norm(a.alias);
    const list = aliases.get(key) ?? [];
    list.push(ref);
    aliases.set(key, list);
  }

  const existingMedia = new Map<Url, { id: MediaId; featureIds: ReadonlySet<FeatureId> }>();
  for (const m of rows.existingMedia) {
    existingMedia.set(m.url as Url, {
      id: m.id as MediaId,
      featureIds: new Set(m.featureIds.map((id) => id as FeatureId)),
    });
  }

  return { creatorsByName, featuresByName, aliases, existingMedia };
}
