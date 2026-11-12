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
  /** True when the video is already in the DB and this item only adds new links. */
  relink: boolean;
  creatorName: string;
  media: ReviewMedia;
  initialTitle: string;
  initialFeatures: ReadonlyArray<FeatureRef>;
};

// Pins to review, in plan (ordinal) order: fresh inserts, plus relinks that
// resolved feature links the existing video doesn't have yet (so new coverage
// added to an already-imported video isn't silently dropped). A relink with no
// new links stays auto-skipped, so re-uploading the same file still resumes at
// the first pin not yet committed.
export function reviewItems(plan: ImportPlan): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const p of plan.pins) {
    if (p.kind === 'insert') {
      out.push({
        ordinal: p.pin.ordinal,
        relink: false,
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
    } else if (p.kind === 'relink' && p.newLinks.length > 0 && p.pin.url) {
      // The media row already exists, so its fields aren't written — only the
      // selected links are added (commitPin's media upsert no-ops on conflict).
      // shotType/creatorId are placeholders the commit ignores.
      out.push({
        ordinal: p.pin.ordinal,
        relink: true,
        creatorName: p.pin.channel,
        media: {
          url: p.pin.url,
          description: p.pin.description,
          youtubeId: p.pin.youtubeId,
          shotType: p.pin.shotType ?? 'drone',
          type: 'video',
          publishedAt: p.pin.publishedAt,
          recordedDate: p.pin.recordedDate,
          creatorId: null,
          geometry: p.pin.geometry,
        },
        initialTitle: p.title,
        initialFeatures: p.links,
      });
    }
  }
  return out;
}

/**
 * Relinks with nothing new to add — already fully in the DB, auto-skipped and
 * only counted in the summary. (Relinks with new links go through review.)
 */
export function alreadyImportedCount(plan: ImportPlan): number {
  return plan.pins.filter((p) => p.kind === 'relink' && p.newLinks.length === 0).length;
}
