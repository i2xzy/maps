// Domain types for the KML import core. No React, Next, or Supabase client
// imports: only the generated `Database`/`Constants` types, which carry the
// enum definitions so this module never re-lists them by hand.

import { z } from 'zod';
import { Constants, type Database } from '@supabase/types/database';
// Type-only, erased at runtime, so the types <-> decisions cycle stays compile-time.
import type { Decision } from './decisions';

// ---------------------------------------------------------------------------
// Enums, sourced from the generated types so they cannot drift from the DB.
// ---------------------------------------------------------------------------

export type ShotType = Database['public']['Enums']['shot_type'];
export type MediaType = Database['public']['Enums']['media_type'];

export const shotTypeSchema = z.enum(Constants.public.Enums.shot_type);
export const mediaTypeSchema = z.enum(Constants.public.Enums.media_type);

// HS2's three branches, classified from `features.route_element_id`. A closed
// union so a branch filter can never be an arbitrary string. Not a DB enum.
export type Branch = 'main' | 'spur' | 'north';
export const branchSchema = z.enum(['main', 'spur', 'north']);

// ---------------------------------------------------------------------------
// Branded primitives. zod is the single source of each brand, so a schema and
// its type can never disagree. Values are minted where external data is parsed.
// ---------------------------------------------------------------------------

export const importIdSchema = z.string().min(1).brand<'ImportId'>();
export const mediaIdSchema = z.string().min(1).brand<'MediaId'>();
export const creatorIdSchema = z.string().min(1).brand<'CreatorId'>();
export const featureIdSchema = z.string().min(1).brand<'FeatureId'>();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).brand<'IsoDate'>();
export const urlSchema = z.string().regex(/^https?:\/\//).brand<'Url'>();
export const youtubeIdSchema = z.string().regex(/^[\w-]{11}$/).brand<'YoutubeId'>();
/** lower(trim(collapse-whitespace(x))). The one equality the DB and TS share. */
export const normNameSchema = z.string().brand<'NormName'>();
/** `${norm(from)}\u0000${norm(to)}` — identity of a range decision. */
export const spanKeySchema = z.string().brand<'SpanKey'>();

export type ImportId = z.infer<typeof importIdSchema>;
export type MediaId = z.infer<typeof mediaIdSchema>;
export type CreatorId = z.infer<typeof creatorIdSchema>;
export type FeatureId = z.infer<typeof featureIdSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type Url = z.infer<typeof urlSchema>;
export type YoutubeId = z.infer<typeof youtubeIdSchema>;
export type NormName = z.infer<typeof normNameSchema>;
export type SpanKey = z.infer<typeof spanKeySchema>;

// ---------------------------------------------------------------------------
// What the KML says (output of parseLayer). Immutable per import.
// ---------------------------------------------------------------------------

export type Geometry =
  | { kind: 'point'; lon: number; lat: number }
  | { kind: 'line'; coords: ReadonlyArray<readonly [lon: number, lat: number]> };

export type Pin = {
  /** Document order in the KML. Display only; identity is `url`. */
  ordinal: number;
  /** null when Link is blank or not a URL (then the pin is blocked). */
  url: Url | null;
  /** Whitespace-normalised (nbsp/tab -> space, runs collapsed, trimmed). */
  title: string;
  channel: string;
  description: string | null;
  youtubeId: YoutubeId | null;
  /** null when the raw My Maps "Type" label did not map to an enum. */
  shotType: ShotType | null;
  rawType: string;
  /** After the title-date fallback. */
  publishedAt: IsoDate | null;
  publishedRaw: string;
  recordedDate: IsoDate | null;
  recordedRaw: string;
  geometry: Geometry | null;
};

/** Parse-time diagnostics, ported field-for-field from parse_kml.py. Data, never thrown. */
export type ParseWarning = { pin: number } & (
  | { kind: 'non-url-link'; link: string }
  | { kind: 'no-youtube-id'; url: Url }
  | { kind: 'unmapped-shot-type'; raw: string }
  | { kind: 'unparsed-date'; field: 'published' | 'recorded'; raw: string }
  | { kind: 'date-from-title'; titleDate: IsoDate; raw: string }
  | { kind: 'misplaced-date'; field: 'channel' | 'description'; value: string }
  | { kind: 'channel-is-url'; value: string }
);

export type ParsedLayer = {
  pins: ReadonlyArray<Pin>;
  warnings: ReadonlyArray<ParseWarning>;
};

// ---------------------------------------------------------------------------
// Title grammar: "YYYY-MM-DD body"; body split on "|" and "&"; "A to B" range.
// ---------------------------------------------------------------------------

export type TitleParts = {
  datePrefix: IsoDate | null;
  body: string;
  /** Trimmed, non-empty, in order. */
  candidates: ReadonlyArray<string>;
};

// ---------------------------------------------------------------------------
// What the admin decided for THIS layer, keyed for upsert. DB facts (new
// creators, new aliases) are NOT decisions; they are written to their own
// tables and surface through the Catalogue.
// ---------------------------------------------------------------------------

export type SpanChoice = z.infer<typeof spanChoiceSchema>;
export const spanChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('auto'), branch: branchSchema.nullable() }),
  z.object({ kind: z.literal('endpointsOnly') }),
  z.object({ kind: z.literal('explicit'), featureNames: z.array(z.string()).readonly() }),
  z.object({ kind: z.literal('manual') }),
]);

/** Folded view of the decision rows. Keys are NormName, SpanKey, or Url. */
export type Decisions = {
  candidateFixes: ReadonlyMap<NormName, string>;
  shotTypeFixes: ReadonlyMap<NormName, ShotType>;
  channelMap: ReadonlyMap<NormName, CreatorId>;
  spans: ReadonlyMap<SpanKey, SpanChoice>;
  skips: ReadonlyMap<Url, string>;
  dateOverrides: ReadonlyMap<Url, { publishedAt?: IsoDate | null; recordedDate?: IsoDate | null }>;
};

export const emptyDecisions: Decisions = {
  candidateFixes: new Map(),
  shotTypeFixes: new Map(),
  channelMap: new Map(),
  spans: new Map(),
  skips: new Map(),
  dateOverrides: new Map(),
};

// ---------------------------------------------------------------------------
// The reference data a layer is resolved against. A snapshot, loaded once per
// request. Only the slices the resolver needs.
// ---------------------------------------------------------------------------

export type CreatorRef = { id: CreatorId; displayName: string };
export type FeatureRef = { id: FeatureId; name: string; chainage: number | null; branch: Branch };

export type Catalogue = {
  creatorsByName: ReadonlyMap<NormName, CreatorRef>;
  featuresByName: ReadonlyMap<NormName, FeatureRef>;
  /** alias -> the features it stands for (may be several). */
  aliases: ReadonlyMap<NormName, ReadonlyArray<FeatureRef>>;
  /** media rows whose url is in this layer, with their current feature links. */
  existingMedia: ReadonlyMap<Url, { id: MediaId; featureIds: ReadonlySet<FeatureId> }>;
};

/** Injected so resolveLayer stays pure/testable; production hits rpc('chainage_span').
 *  Returns the span unfiltered; branch filtering happens in the app, not the DB. */
export type SpanLookup = (from: string, to: string) => Promise<ReadonlyArray<string>>;

// ---------------------------------------------------------------------------
// The plan: what Apply will do, fully derived. The only thing the UI renders.
// ---------------------------------------------------------------------------

export type SpanPlan =
  | {
      kind: 'linked';
      via: 'auto' | 'explicit' | 'endpointsOnly';
      /** The branch the auto span was constrained to; null for the whole route. */
      branch: Branch | null;
      /** Branches present in the unfiltered auto span, in fixed order. Empty for non-auto. */
      branchesPresent: ReadonlyArray<Branch>;
      /** True when the branch is ambiguous (mixed span, endpoints don't agree): ask the admin. */
      branchChoiceNeeded: boolean;
      features: ReadonlyArray<FeatureRef>;
    }
  /** auto span that resolved fewer than two features: left unlinked on purpose. */
  | {
      kind: 'unresolved';
      branch: Branch | null;
      branchesPresent: ReadonlyArray<Branch>;
      branchChoiceNeeded: boolean;
      features: ReadonlyArray<FeatureRef>;
    }
  | { kind: 'manual'; reason: 'ground-or-vehicle' | 'admin' };

export type CandidatePlan = { text: string } & (
  | { kind: 'features'; via: 'name' | 'alias' | 'fix'; features: ReadonlyArray<FeatureRef> }
  | { kind: 'range'; from: string; to: string; span: SpanPlan }
  | { kind: 'unmatched'; closest: { feature: FeatureRef; similarity: number } | null }
);

export type BlockReason =
  | { kind: 'no-url' }
  | { kind: 'no-creator'; channel: string }
  | { kind: 'no-shot-type'; raw: string }
  // Source-data error: the channel field holds a date or a URL, not a name.
  // Fix it in the Google map and re-export, not by inventing a creator.
  | { kind: 'bad-channel'; channel: string; why: 'date' | 'url' };

export type SkipReason =
  | { kind: 'decided'; note: string }
  /** A later pin sharing an earlier pin's url: its links merged into #firstOrdinal. */
  | { kind: 'duplicate-url'; firstOrdinal: number };

/** The media row as it will be written: a Pin after decisions are applied. */
export type MediaDraft = {
  url: Url;
  title: string;
  description: string | null;
  youtubeId: YoutubeId | null;
  shotType: ShotType;
  type: MediaType;
  publishedAt: IsoDate | null;
  recordedDate: IsoDate | null;
  geometry: Geometry | null;
};

export type PinPlan = {
  pin: Pin;
  /** Title after candidate fixes. */
  title: string;
  candidates: ReadonlyArray<CandidatePlan>;
  warnings: ReadonlyArray<ParseWarning>;
} & (
  | { kind: 'insert'; draft: MediaDraft; creator: CreatorRef; links: ReadonlyArray<FeatureRef> }
  | {
      kind: 'relink';
      mediaId: MediaId;
      links: ReadonlyArray<FeatureRef>;
      newLinks: ReadonlyArray<FeatureRef>;
    }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'skipped'; reason: SkipReason }
);

export type MissingCreator = { channel: string; pinCount: number; closest: CreatorRef | null };
export type UnmatchedCandidate = {
  text: string;
  pinCount: number;
  closest: { feature: FeatureRef; similarity: number } | null;
  verdict: 'typo' | 'alias-or-missing';
  /** How to find each pin carrying this candidate in the map: its youtube id when
   *  it has one, otherwise its full title (both are searchable in Google My Maps). */
  locators: ReadonlyArray<{ videoId: string | null; title: string }>;
};
export type RangeWork = {
  from: string;
  to: string;
  pinCount: number;
  shotTypes: ReadonlyArray<ShotType>;
  span: SpanPlan;
  choice: SpanChoice;
  /** Branches in this range's unfiltered auto span; populates the branch dropdown. */
  branchesPresent: ReadonlyArray<Branch>;
  /** Whether to show the branch dropdown: a mixed span the endpoints don't settle. */
  branchChoiceNeeded: boolean;
};
export type UnmappedShotType = { raw: string; pinCount: number };
export type BadChannel = { channel: string; why: 'date' | 'url'; pinCount: number };

export type ImportPlan = {
  session: ImportSessionMeta;
  pins: ReadonlyArray<PinPlan>;
  worklists: {
    missingCreators: ReadonlyArray<MissingCreator>;
    unmatchedCandidates: ReadonlyArray<UnmatchedCandidate>;
    ranges: ReadonlyArray<RangeWork>;
    unmappedShotTypes: ReadonlyArray<UnmappedShotType>;
    badChannels: ReadonlyArray<BadChannel>;
  };
  summary: {
    insert: number;
    relink: number;
    skipped: number;
    blocked: Record<BlockReason['kind'], number>;
    duplicateUrls: number;
    linksPlanned: number;
  };
};

export type ImportSessionMeta = {
  id: ImportId;
  name: string;
  fileName: string;
  createdAt: string;
  lastApply: ApplyOutcome | null;
};

export type ApplyOutcome = {
  at: string;
  inserted: number;
  reused: number;
  linksAdded: number;
  skipped: number;
  /** provenance without a media.import_id column. */
  insertedMediaIds: ReadonlyArray<MediaId>;
};

// ---------------------------------------------------------------------------
// The transport shape the client holds and the commit action receives. The KML
// is parsed once in the browser; what crosses to the server is the parsed layer
// plus the admin's decision rows. The plan is always re-derived, never carried.
// ---------------------------------------------------------------------------

export type ImportDraft = { layer: ParsedLayer; decisions: ReadonlyArray<Decision> };
