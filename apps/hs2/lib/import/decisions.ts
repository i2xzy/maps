// The admin's per-layer decisions. zod is the boundary: decision rows are read
// back from the DB, so DecisionSchema validates them and Decision is its
// inferred type (one definition). foldDecisions collapses the rows into the
// keyed maps resolveLayer consumes.

import { z } from 'zod';

import {
  creatorIdSchema,
  isoDateSchema,
  shotTypeSchema,
  spanChoiceSchema,
  urlSchema,
  type CreatorId,
  type Decisions,
  type IsoDate,
  type NormName,
  type ShotType,
  type SpanChoice,
  type SpanKey,
  type Url,
} from './types';
import { norm } from './titles';

export const DecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixCandidate'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('fixShotType'), raw: z.string(), shotType: shotTypeSchema }),
  z.object({ kind: z.literal('mapChannel'), channel: z.string(), creatorId: creatorIdSchema }),
  z.object({ kind: z.literal('span'), from: z.string(), to: z.string(), choice: spanChoiceSchema }),
  z.object({ kind: z.literal('skipPin'), url: urlSchema, reason: z.string() }),
  z.object({
    kind: z.literal('overrideDates'),
    url: urlSchema,
    publishedAt: isoDateSchema.nullable().optional(),
    recordedDate: isoDateSchema.nullable().optional(),
  }),
]);

export type Decision = z.infer<typeof DecisionSchema>;

/** (kind, subject) identity for upsert/delete, matching the DB primary key. */
export type DecisionRef = { kind: Decision['kind']; subject: string };

/** `${norm(from)}\u0000${norm(to)}` — the identity of a range decision. */
export function spanKey(from: string, to: string): SpanKey {
  return `${norm(from)}\u0000${norm(to)}` as SpanKey;
}

export function decisionRef(d: Decision): DecisionRef {
  switch (d.kind) {
    case 'fixCandidate':
      return { kind: d.kind, subject: norm(d.from) };
    case 'fixShotType':
      return { kind: d.kind, subject: norm(d.raw) };
    case 'mapChannel':
      return { kind: d.kind, subject: norm(d.channel) };
    case 'span':
      return { kind: d.kind, subject: spanKey(d.from, d.to) };
    case 'skipPin':
      return { kind: d.kind, subject: d.url };
    case 'overrideDates':
      return { kind: d.kind, subject: d.url };
  }
}

export function foldDecisions(rows: ReadonlyArray<Decision>): Decisions {
  const candidateFixes = new Map<NormName, string>();
  const shotTypeFixes = new Map<NormName, ShotType>();
  const channelMap = new Map<NormName, CreatorId>();
  const spans = new Map<SpanKey, SpanChoice>();
  const skips = new Map<Url, string>();
  const dateOverrides = new Map<Url, { publishedAt?: IsoDate | null; recordedDate?: IsoDate | null }>();

  for (const d of rows) {
    switch (d.kind) {
      case 'fixCandidate':
        candidateFixes.set(norm(d.from), d.to);
        break;
      case 'fixShotType':
        shotTypeFixes.set(norm(d.raw), d.shotType);
        break;
      case 'mapChannel':
        channelMap.set(norm(d.channel), d.creatorId);
        break;
      case 'span':
        spans.set(spanKey(d.from, d.to), d.choice);
        break;
      case 'skipPin':
        skips.set(d.url, d.reason);
        break;
      case 'overrideDates':
        dateOverrides.set(d.url, { publishedAt: d.publishedAt, recordedDate: d.recordedDate });
        break;
    }
  }

  return { candidateFixes, shotTypeFixes, channelMap, spans, skips, dateOverrides };
}
