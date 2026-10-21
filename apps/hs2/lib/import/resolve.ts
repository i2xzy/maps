// The planner. Deterministic and total given its inputs: it never throws on a
// schema-valid layer. It owns every disposition and matching rule; the SQL
// apply step receives already-resolved ids. ImportPlan is a complete projection
// (per-pin dispositions + worklists + summary) with no stored state.

import type {
  BlockReason,
  Branch,
  CandidatePlan,
  Catalogue,
  CreatorRef,
  Decisions,
  FeatureRef,
  ImportPlan,
  ImportSessionMeta,
  IsoDate,
  MediaDraft,
  ParsedLayer,
  ParseWarning,
  Pin,
  PinPlan,
  ShotType,
  SpanChoice,
  SpanLookup,
  SpanPlan,
  Url,
} from './types';
import { distinctBranches } from './catalogue';
import { spanKey } from './decisions';
import { buildIndex } from './matching';
import { applyCandidateFixes, norm, rangeEndpoints, splitTitle } from './titles';
import { TYPO_THRESHOLD } from './trigram';

type Index = ReturnType<typeof buildIndex>;

type Prepared = {
  pin: Pin;
  title: string;
  candidates: CandidatePlan[];
  links: FeatureRef[];
  warnings: ParseWarning[];
  resolvedShotType: ShotType | null;
  creator: CreatorRef | null;
};

function defaultSpanChoice(shotType: ShotType | null): SpanChoice {
  if (shotType === 'ground' || shotType === 'vehicle') return { kind: 'manual' };
  return { kind: 'auto', branch: null };
}

// A channel holding a date or a URL is a source-data mistake, not a real name.
// Such pins are blocked as errors to fix in the map, never offered as creators.
function channelProblem(prepared: Prepared): 'date' | 'url' | null {
  for (const w of prepared.warnings) {
    if (w.kind === 'channel-is-url') return 'url';
    if (w.kind === 'misplaced-date' && w.field === 'channel') return 'date';
  }
  return null;
}

function dedupeById(refs: ReadonlyArray<FeatureRef>): FeatureRef[] {
  const seen = new Set<string>();
  const out: FeatureRef[] = [];
  for (const ref of refs) {
    if (!seen.has(ref.id)) {
      seen.add(ref.id);
      out.push(ref);
    }
  }
  return out;
}

// Chainage-bearing features a range endpoint resolves to: a direct feature name,
// or the features an alias stands for. Non-feature endpoints resolve to none.
function endpointCandidates(name: string, index: Index): FeatureRef[] {
  const res = index.resolveCandidate(name);
  if (res.kind !== 'features') return [];
  return res.features.filter((f) => f.chainage !== null);
}

// Resolve both endpoints to real features for chainage_span. When an endpoint is an
// alias covering several features, pick the pair furthest apart by chainage so the
// span covers the whole named stretch (e.g. "Washwood Heath" -> Bromford Tunnel, the
// end further from Curzon Street Station). Null if either endpoint resolves to none.
// The branch both endpoints can sit on: the one branch common to each endpoint's
// candidate features. Exactly one settles the range (e.g. both on the Birmingham
// spur); none or several leaves it open, a cross-junction range.
function sharedEndpointBranch(ends: { from: string; to: string }, index: Index): Branch | null {
  const fromBranches = new Set(endpointCandidates(ends.from, index).map((f) => f.branch));
  const toBranches = new Set(endpointCandidates(ends.to, index).map((f) => f.branch));
  const common = [...fromBranches].filter((b) => toBranches.has(b));
  return common.length === 1 ? (common[0] ?? null) : null;
}

function resolveSpanEndpoints(
  ends: { from: string; to: string },
  index: Index,
  branch: Branch | null,
): { from: FeatureRef; to: FeatureRef } | null {
  const onBranch = (f: FeatureRef) => branch === null || f.branch === branch;
  const fromCands = endpointCandidates(ends.from, index).filter(onBranch);
  const toCands = endpointCandidates(ends.to, index).filter(onBranch);
  if (fromCands.length === 0 || toCands.length === 0) return null;
  let best: { from: FeatureRef; to: FeatureRef; dist: number } | null = null;
  for (const a of fromCands) {
    for (const b of toCands) {
      const dist = Math.abs((a.chainage ?? 0) - (b.chainage ?? 0));
      if (best === null || dist > best.dist) best = { from: a, to: b, dist };
    }
  }
  return best === null ? null : { from: best.from, to: best.to };
}

function makeSpanResolver(index: Index, lookupSpan: SpanLookup) {
  const cache = new Map<string, Promise<FeatureRef[]>>();
  return (from: string, to: string): Promise<FeatureRef[]> => {
    const key = spanKey(from, to);
    let pending = cache.get(key);
    if (!pending) {
      pending = lookupSpan(from, to).then((names) => index.featuresByNames(names));
      cache.set(key, pending);
    }
    return pending;
  };
}

async function prepare(
  layer: ParsedLayer,
  decisions: Decisions,
  index: Index,
  resolveSpan: ReturnType<typeof makeSpanResolver>,
): Promise<Prepared[]> {
  const warningsByPin = new Map<number, ParseWarning[]>();
  for (const w of layer.warnings) {
    const list = warningsByPin.get(w.pin) ?? [];
    list.push(w);
    warningsByPin.set(w.pin, list);
  }
  const fixTargets = new Set<string>([...decisions.candidateFixes.values()].map((v) => norm(v)));

  const prepared: Prepared[] = [];
  for (const pin of layer.pins) {
    const title = applyCandidateFixes(pin.title, decisions.candidateFixes);
    const resolvedShotType = decisions.shotTypeFixes.get(norm(pin.rawType)) ?? pin.shotType;
    const candidates: CandidatePlan[] = [];
    const links: FeatureRef[] = [];

    for (const text of splitTitle(title).candidates) {
      const res = index.resolveCandidate(text);
      if (res.kind === 'features') {
        const via = fixTargets.has(norm(text)) ? 'fix' : res.via;
        candidates.push({ text, kind: 'features', via, features: res.features });
        links.push(...res.features);
        continue;
      }
      const ends = rangeEndpoints(text);
      if (ends) {
        const decided = decisions.spans.get(spanKey(ends.from, ends.to));
        const choice = decided ?? defaultSpanChoice(resolvedShotType);
        const span = await buildSpanPlan(ends, choice, decided !== undefined, index, resolveSpan);
        candidates.push({ text, kind: 'range', from: ends.from, to: ends.to, span });
        if (span.kind === 'linked') links.push(...span.features);
        // An endpoint that is neither a feature nor an alias is a typo or a missing
        // feature: surface it in the Titles worklist so it can be fixed or aliased.
        for (const endpoint of [ends.from, ends.to]) {
          const endRes = index.resolveCandidate(endpoint);
          if (endRes.kind === 'unmatched') {
            candidates.push({ text: endpoint, kind: 'unmatched', closest: endRes.closest });
          }
        }
        continue;
      }
      candidates.push({ text, kind: 'unmatched', closest: res.closest });
    }

    const mapped = decisions.channelMap.get(norm(pin.channel));
    const creator = mapped
      ? index.creatorById(mapped) ?? index.creatorByName(pin.channel)
      : index.creatorByName(pin.channel);

    prepared.push({
      pin,
      title,
      candidates,
      links: dedupeById(links),
      warnings: warningsByPin.get(pin.ordinal) ?? [],
      resolvedShotType,
      creator,
    });
  }
  return prepared;
}

async function buildSpanPlan(
  ends: { from: string; to: string },
  choice: SpanChoice,
  fromDecision: boolean,
  index: Index,
  resolveSpan: ReturnType<typeof makeSpanResolver>,
): Promise<SpanPlan> {
  switch (choice.kind) {
    case 'manual':
      return { kind: 'manual', reason: fromDecision ? 'admin' : 'ground-or-vehicle' };
    case 'auto': {
      // The branch both endpoints share settles the range: resolve the span on that
      // branch and filter to it, no dropdown. A cross-junction range (no shared
      // branch) stays unfiltered and asks the admin when the span is mixed.
      const endsBranch = sharedEndpointBranch(ends, index);
      const ep = resolveSpanEndpoints(ends, index, endsBranch);
      if (ep === null) {
        return {
          kind: 'unresolved',
          branch: choice.branch,
          branchesPresent: [],
          branchChoiceNeeded: false,
          features: [],
        };
      }
      const all = await resolveSpan(ep.from.name, ep.to.name);
      const branchesPresent = distinctBranches(all);
      const effective = choice.branch ?? endsBranch;
      const branchChoiceNeeded = branchesPresent.length > 1 && endsBranch === null;
      const features = effective ? all.filter((f) => f.branch === effective) : all;
      if (features.length >= 2) {
        return { kind: 'linked', via: 'auto', branch: choice.branch, branchesPresent, branchChoiceNeeded, features };
      }
      return { kind: 'unresolved', branch: choice.branch, branchesPresent, branchChoiceNeeded, features };
    }
    case 'endpointsOnly':
      return {
        kind: 'linked',
        via: 'endpointsOnly',
        branch: null,
        branchesPresent: [],
        branchChoiceNeeded: false,
        features: index.featuresByNames([ends.from, ends.to]),
      };
    case 'explicit':
      return {
        kind: 'linked',
        via: 'explicit',
        branch: null,
        branchesPresent: [],
        branchChoiceNeeded: false,
        features: index.featuresByNames(choice.featureNames),
      };
  }
}

function buildDraft(prepared: Prepared, shotType: ShotType, decisions: Decisions, url: Url): MediaDraft {
  const { pin } = prepared;
  const override = decisions.dateOverrides.get(url);
  const publishedAt: IsoDate | null =
    override?.publishedAt !== undefined ? override.publishedAt : pin.publishedAt;
  const recordedDate: IsoDate | null =
    override?.recordedDate !== undefined ? override.recordedDate : pin.recordedDate;
  return {
    url,
    title: prepared.title,
    description: pin.description,
    youtubeId: pin.youtubeId,
    shotType,
    type: 'video',
    publishedAt,
    recordedDate,
    geometry: pin.geometry,
  };
}

function disposition(prepared: Prepared, decisions: Decisions, catalogue: Catalogue, ctx: {
  firstOrdinalByUrl: ReadonlyMap<Url, number>;
  linksByUrl: ReadonlyMap<Url, FeatureRef[]>;
}): PinPlan {
  const { pin } = prepared;
  const base = { pin, title: prepared.title, candidates: prepared.candidates, warnings: prepared.warnings };

  if (pin.url && decisions.skips.has(pin.url)) {
    return { ...base, kind: 'skipped', reason: { kind: 'decided', note: decisions.skips.get(pin.url) ?? '' } };
  }
  if (pin.url === null) {
    return { ...base, kind: 'blocked', reason: { kind: 'no-url' } };
  }
  const firstOrdinal = ctx.firstOrdinalByUrl.get(pin.url);
  if (firstOrdinal !== undefined && firstOrdinal !== pin.ordinal) {
    return { ...base, kind: 'skipped', reason: { kind: 'duplicate-url', firstOrdinal } };
  }

  const links = ctx.linksByUrl.get(pin.url) ?? prepared.links;
  const existing = catalogue.existingMedia.get(pin.url);
  if (existing) {
    const newLinks = links.filter((f) => !existing.featureIds.has(f.id));
    return { ...base, kind: 'relink', mediaId: existing.id, links, newLinks };
  }
  const chanProblem = channelProblem(prepared);
  if (chanProblem !== null) {
    return { ...base, kind: 'blocked', reason: { kind: 'bad-channel', channel: pin.channel, why: chanProblem } };
  }
  if (prepared.creator === null) {
    return { ...base, kind: 'blocked', reason: { kind: 'no-creator', channel: pin.channel } };
  }
  const shotType = prepared.resolvedShotType;
  if (shotType === null) {
    return { ...base, kind: 'blocked', reason: { kind: 'no-shot-type', raw: pin.rawType } };
  }
  return {
    ...base,
    kind: 'insert',
    draft: buildDraft(prepared, shotType, decisions, pin.url),
    creator: prepared.creator,
    links,
  };
}

function buildWorklists(pins: ReadonlyArray<PinPlan>, index: Index) {
  type Closest = { feature: FeatureRef; similarity: number } | null;
  const missingCreators = new Map<string, { channel: string; pinCount: number }>();
  const unmappedShotTypes = new Map<string, { raw: string; pinCount: number }>();
  const badChannels = new Map<string, { channel: string; why: 'date' | 'url'; pinCount: number }>();
  const unmatched = new Map<
    string,
    {
      text: string;
      pinCount: number;
      closest: Closest;
      locators: { videoId: string | null; title: string }[];
    }
  >();
  const ranges = new Map<
    string,
    {
      from: string;
      to: string;
      pinCount: number;
      shotTypes: Set<ShotType>;
      span: SpanPlan;
      choice: SpanChoice;
      branchesPresent: ReadonlyArray<Branch>;
      branchChoiceNeeded: boolean;
    }
  >();

  for (const plan of pins) {
    if (plan.kind === 'blocked' && plan.reason.kind === 'no-creator') {
      const key = norm(plan.reason.channel);
      const entry = missingCreators.get(key) ?? { channel: plan.reason.channel, pinCount: 0 };
      entry.pinCount += 1;
      missingCreators.set(key, entry);
    }
    if (plan.kind === 'blocked' && plan.reason.kind === 'no-shot-type') {
      const key = norm(plan.reason.raw);
      const entry = unmappedShotTypes.get(key) ?? { raw: plan.reason.raw, pinCount: 0 };
      entry.pinCount += 1;
      unmappedShotTypes.set(key, entry);
    }
    if (plan.kind === 'blocked' && plan.reason.kind === 'bad-channel') {
      const key = norm(plan.reason.channel);
      const entry = badChannels.get(key) ?? { channel: plan.reason.channel, why: plan.reason.why, pinCount: 0 };
      entry.pinCount += 1;
      badChannels.set(key, entry);
    }

    const seenUnmatched = new Set<string>();
    const seenRange = new Set<string>();
    const shotType = plan.pin.shotType;
    for (const cand of plan.candidates) {
      if (cand.kind === 'unmatched') {
        const key = norm(cand.text);
        if (!seenUnmatched.has(key)) {
          seenUnmatched.add(key);
          const entry =
            unmatched.get(key) ?? { text: cand.text, pinCount: 0, closest: cand.closest, locators: [] };
          entry.pinCount += 1;
          entry.locators.push({ videoId: plan.pin.youtubeId, title: plan.pin.title });
          unmatched.set(key, entry);
        }
      } else if (cand.kind === 'range') {
        const key = spanKey(cand.from, cand.to);
        const entry =
          ranges.get(key) ??
          {
            from: cand.from,
            to: cand.to,
            pinCount: 0,
            shotTypes: new Set<ShotType>(),
            span: cand.span,
            choice: spanChoiceOf(cand.span),
            branchesPresent: cand.span.kind === 'manual' ? [] : cand.span.branchesPresent,
            branchChoiceNeeded: cand.span.kind === 'manual' ? false : cand.span.branchChoiceNeeded,
          };
        if (!seenRange.has(key)) {
          seenRange.add(key);
          entry.pinCount += 1;
        }
        if (shotType !== null) entry.shotTypes.add(shotType);
        ranges.set(key, entry);
      }
    }
  }

  return {
    missingCreators: [...missingCreators.values()].map((e) => ({
      ...e,
      closest: index.closestCreator(e.channel),
    })),
    unmatchedCandidates: [...unmatched.values()].map((e) => ({
      text: e.text,
      pinCount: e.pinCount,
      closest: e.closest,
      verdict:
        e.closest !== null && e.closest.similarity >= TYPO_THRESHOLD
          ? ('typo' as const)
          : ('alias-or-missing' as const),
      locators: e.locators,
    })),
    ranges: [...ranges.values()].map((e) => ({
      from: e.from,
      to: e.to,
      pinCount: e.pinCount,
      shotTypes: [...e.shotTypes],
      span: e.span,
      choice: e.choice,
      branchesPresent: e.branchesPresent,
      branchChoiceNeeded: e.branchChoiceNeeded,
    })),
    unmappedShotTypes: [...unmappedShotTypes.values()],
    badChannels: [...badChannels.values()],
  };
}

function spanChoiceOf(span: SpanPlan): SpanChoice {
  switch (span.kind) {
    case 'linked':
      if (span.via === 'auto') return { kind: 'auto', branch: span.branch };
      if (span.via === 'endpointsOnly') return { kind: 'endpointsOnly' };
      return { kind: 'explicit', featureNames: span.features.map((f) => f.name) };
    case 'unresolved':
      return { kind: 'auto', branch: span.branch };
    case 'manual':
      return { kind: 'manual' };
  }
}

export async function resolveLayer(
  layer: ParsedLayer,
  decisions: Decisions,
  catalogue: Catalogue,
  lookupSpan: SpanLookup,
  session: ImportSessionMeta,
): Promise<ImportPlan> {
  const index = buildIndex(catalogue);
  const resolveSpan = makeSpanResolver(index, lookupSpan);
  const prepared = await prepare(layer, decisions, index, resolveSpan);

  const firstOrdinalByUrl = new Map<Url, number>();
  const linksByUrl = new Map<Url, FeatureRef[]>();
  for (const p of prepared) {
    if (p.pin.url === null) continue;
    if (!firstOrdinalByUrl.has(p.pin.url)) firstOrdinalByUrl.set(p.pin.url, p.pin.ordinal);
    linksByUrl.set(p.pin.url, dedupeById([...(linksByUrl.get(p.pin.url) ?? []), ...p.links]));
  }

  const pins = prepared.map((p) =>
    disposition(p, decisions, catalogue, { firstOrdinalByUrl, linksByUrl }),
  );

  const summary = {
    insert: 0,
    relink: 0,
    skipped: 0,
    blocked: { 'no-url': 0, 'no-creator': 0, 'no-shot-type': 0, 'bad-channel': 0 } as Record<
      BlockReason['kind'],
      number
    >,
    duplicateUrls: 0,
    linksPlanned: 0,
  };
  for (const plan of pins) {
    switch (plan.kind) {
      case 'insert':
        summary.insert += 1;
        summary.linksPlanned += plan.links.length;
        break;
      case 'relink':
        summary.relink += 1;
        summary.linksPlanned += plan.newLinks.length;
        break;
      case 'skipped':
        summary.skipped += 1;
        if (plan.reason.kind === 'duplicate-url') summary.duplicateUrls += 1;
        break;
      case 'blocked':
        summary.blocked[plan.reason.kind] += 1;
        break;
    }
  }

  return { session, pins, worklists: buildWorklists(pins, index), summary };
}
