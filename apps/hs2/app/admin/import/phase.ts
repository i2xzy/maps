// The stepper's state, derived from the live plan. No stored phase: the first
// gate still open wins, and each gate clears itself as the draft changes (a
// clean re-upload, a created creator). Review is forward-only because nothing
// writes the draft backwards once a gate has passed.

import type {
  CreatorId,
  FeatureRef,
  Geometry,
  ImportPlan,
  IsoDate,
  MediaType,
  ShotType,
  Url,
  YoutubeId,
} from '@/lib/import';

import { collectIssues } from './tabs/IssuesTab';

export type Phase = 'upload' | 'issues' | 'creators' | 'review';

export const PHASE_LABELS: Record<Phase, string> = {
  upload: 'Upload',
  issues: 'Fix issues',
  creators: 'Add creators',
  review: 'Review',
};

export const PHASE_ORDER: ReadonlyArray<Phase> = ['upload', 'issues', 'creators', 'review'];

export function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function derivePhase(plan: ImportPlan): Exclude<Phase, 'upload'> {
  if (collectIssues(plan.pins).length > 0) return 'issues';
  if (plan.worklists.missingCreators.length > 0) return 'creators';
  return 'review';
}

// One shape for both insert and relink so the reviewer walks a single list with
// one commit path. creatorId is null for relink: the media row already exists,
// and commitPin's ignore-duplicates upsert never overwrites its creator.
export type ReviewMedia = {
  url: Url;
  description: string | null;
  youtubeId: YoutubeId | null;
  shotType: ShotType;
  type: MediaType;
  publishedAt: IsoDate | null;
  recordedDate: IsoDate | null;
  creatorId: CreatorId | null;
  geometry: Geometry | null;
};

export type ReviewItem = {
  ordinal: number;
  action: 'insert' | 'relink';
  channel: string;
  creatorName: string | null;
  media: ReviewMedia;
  initialTitle: string;
  initialFeatures: ReadonlyArray<FeatureRef>;
};

// Importable pins in plan (ordinal) order. A relink without a url or shot type
// can't form a media row, but issue-gating keeps such pins out of Review, so in
// practice this filter drops nothing.
export function reviewItems(plan: ImportPlan): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const p of plan.pins) {
    if (p.kind === 'insert') {
      out.push({
        ordinal: p.pin.ordinal,
        action: 'insert',
        channel: p.pin.channel,
        creatorName: p.creator.displayName,
        media: {
          url: p.draft.url,
          description: p.draft.description,
          youtubeId: p.draft.youtubeId,
          shotType: p.draft.shotType,
          type: p.draft.type,
          publishedAt: p.draft.publishedAt,
          recordedDate: p.draft.recordedDate,
          creatorId: p.creator.id,
          geometry: p.draft.geometry,
        },
        initialTitle: p.draft.title,
        initialFeatures: p.links,
      });
    } else if (p.kind === 'relink') {
      const { pin } = p;
      if (pin.url === null || pin.shotType === null) continue;
      out.push({
        ordinal: pin.ordinal,
        action: 'relink',
        channel: pin.channel,
        creatorName: null,
        media: {
          url: pin.url,
          description: pin.description,
          youtubeId: pin.youtubeId,
          shotType: pin.shotType,
          type: 'video',
          publishedAt: pin.publishedAt,
          recordedDate: pin.recordedDate,
          creatorId: null,
          geometry: pin.geometry,
        },
        initialTitle: p.title,
        initialFeatures: p.links,
      });
    }
  }
  return out;
}

export function geometryKind(geometry: Geometry | null): 'point' | 'line' | 'none' {
  return geometry === null ? 'none' : geometry.kind;
}
