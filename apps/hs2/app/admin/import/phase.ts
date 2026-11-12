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
  // Only hard problems (a pin that won't import, or a duplicate url) gate the
  // flow. Warning-only pins — e.g. a date read from the title, or a non-YouTube
  // url — still import, and no in-app action clears the warning, so blocking on
  // them would trap the wizard until the operator re-exported the KML.
  if (collectIssues(plan.pins).some((i) => i.severity !== 'warning')) return 'issues';
  if (plan.worklists.missingCreators.length > 0) return 'creators';
  return 'review';
}

// The media fields a new pin writes. Already-imported pins (relink) are excluded
// from review, so every reviewed pin is a fresh insert with a resolved creator.
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
  creatorName: string;
  media: ReviewMedia;
  initialTitle: string;
  initialFeatures: ReadonlyArray<FeatureRef>;
};

// New pins to review, in plan (ordinal) order. A relink pin's url is already in
// the DB, so it is skipped automatically; re-uploading the same file therefore
// resumes at the first pin not yet committed.
export function reviewItems(plan: ImportPlan): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const p of plan.pins) {
    if (p.kind !== 'insert') continue;
    out.push({
      ordinal: p.pin.ordinal,
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
  }
  return out;
}

/** Pins whose url is already in the DB, auto-skipped (shown in the summary). */
export function alreadyImportedCount(plan: ImportPlan): number {
  return plan.pins.filter((p) => p.kind === 'relink').length;
}
