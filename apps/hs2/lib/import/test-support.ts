// Builders shared by the matching and resolve suites. Not part of the public
// surface (never re-exported from index.ts); vitest ignores it (no .test.ts).

import type {
  Branch,
  Catalogue,
  CreatorId,
  CreatorRef,
  FeatureId,
  FeatureRef,
  ImportSessionMeta,
  MediaId,
  Url,
} from './types';
import { norm } from './titles';

export function feature(
  id: string,
  name: string,
  chainage: number | null = null,
  branch: Branch = 'main',
): FeatureRef {
  return { id: id as FeatureId, name, chainage, branch };
}

export function creator(id: string, displayName: string): CreatorRef {
  return { id: id as CreatorId, displayName };
}

export function catalogueFixture(opts: {
  features?: ReadonlyArray<FeatureRef>;
  aliases?: ReadonlyArray<[string, ReadonlyArray<FeatureRef>]>;
  creators?: ReadonlyArray<CreatorRef>;
  existing?: ReadonlyArray<[string, { id: string; featureIds: ReadonlyArray<string> }]>;
}): Catalogue {
  return {
    featuresByName: new Map((opts.features ?? []).map((f) => [norm(f.name), f])),
    aliases: new Map((opts.aliases ?? []).map(([alias, fs]) => [norm(alias), fs])),
    creatorsByName: new Map((opts.creators ?? []).map((c) => [norm(c.displayName), c])),
    existingMedia: new Map(
      (opts.existing ?? []).map(([url, m]) => [
        url as Url,
        { id: m.id as MediaId, featureIds: new Set(m.featureIds.map((x) => x as FeatureId)) },
      ]),
    ),
  };
}

export const sessionMeta: ImportSessionMeta = {
  id: 'import-1' as ImportSessionMeta['id'],
  name: 'test layer',
  fileName: 'test.kml',
  createdAt: '2026-01-01T00:00:00Z',
  lastApply: null,
};
