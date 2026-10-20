// The planner. Deterministic and total given its inputs: it never throws on a
// schema-valid layer. It owns every disposition and matching rule; the SQL
// apply step receives already-resolved ids. ImportPlan is a complete projection
// (per-pin dispositions + worklists + summary) with no stored state.

import type {
  BlockReason,
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
  return { kind: 'auto', routePrefix: null };
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

function makeSpanResolver(index: Index, lookupSpan: SpanLookup) {
  const cache = new Map<string, Promise<FeatureRef[]>>();
  return (from: string, to: string, routePrefix: string | null): Promise<FeatureRef[]> => {
    const key = `${spanKey(from, to)}\u0000${routePrefix ?? ''}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = lookupSpan(from, to, routePrefix).then((names) => index.featuresByNames(names));
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
      const features = await resolveSpan(ends.from, ends.to, choice.routePrefix);
      if (features.length >= 2) {
        return { kind: 'linked', via: 'auto', routePrefix: choice.routePrefix, features };
      }
      return { kind: 'unresolved', routePrefix: choice.routePrefix, features };
    }
    case 'endpointsOnly':
      return {
        kind: 'linked',
        via: 'endpointsOnly',
        routePrefix: null,
        features: index.featuresByNames([ends.from, ends.to]),
      };
    case 'explicit':
      return {
        kind: 'linked',
        via: 'explicit',
        routePrefix: null,
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
  const unmatched = new Map<string, { text: string; pinCount: number; closest: Closest }>();
  const ranges = new Map<
    string,
    { from: string; to: string; pinCount: number; shotTypes: Set<ShotType>; span: SpanPlan; choice: SpanChoice }
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

    const seenUnmatched = new Set<string>();
    const seenRange = new Set<string>();
    const shotType = plan.pin.shotType;
    for (const cand of plan.candidates) {
      if (cand.kind === 'unmatched') {
        const key = norm(cand.text);
        if (!seenUnmatched.has(key)) {
          seenUnmatched.add(key);
          const entry = unmatched.get(key) ?? { text: cand.text, pinCount: 0, closest: cand.closest };
          entry.pinCount += 1;
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
    })),
    ranges: [...ranges.values()].map((e) => ({
      from: e.from,
      to: e.to,
      pinCount: e.pinCount,
      shotTypes: [...e.shotTypes],
      span: e.span,
      choice: e.choice,
    })),
    unmappedShotTypes: [...unmappedShotTypes.values()],
  };
}

function spanChoiceOf(span: SpanPlan): SpanChoice {
  switch (span.kind) {
    case 'linked':
      if (span.via === 'auto') return { kind: 'auto', routePrefix: span.routePrefix };
      if (span.via === 'endpointsOnly') return { kind: 'endpointsOnly' };
      return { kind: 'explicit', featureNames: span.features.map((f) => f.name) };
    case 'unresolved':
      return { kind: 'auto', routePrefix: span.routePrefix };
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
    blocked: { 'no-url': 0, 'no-creator': 0, 'no-shot-type': 0 } as Record<BlockReason['kind'], number>,
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
