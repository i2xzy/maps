import { FeatureStatus } from '@supabase/types';
import { featureStatuses } from '@/components/feature/config';

// Helper function to count features by status
export function countFeaturesByStatus(
  features: Array<{ status: FeatureStatus | null }> | null | undefined
) {
  return features?.reduce<Record<NonNullable<FeatureStatus>, number>>(
    (acc, feature) => {
      const status = feature.status || 'NOT_STARTED';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<NonNullable<FeatureStatus>, number>
  );
}

// Helper function to generate progress chart data from status counts
export function generateProgressData(
  features: Array<{ status: FeatureStatus | null }> | null | undefined
) {
  if (!features) return [];

  const statusCounts = countFeaturesByStatus(features);

  if (!statusCounts) return [];

  return Object.entries(featureStatuses)
    .map(([status, config]) => ({
      name: config.label,
      value: statusCounts[status as NonNullable<FeatureStatus>] ?? 0,
      color: config.color,
    }))
    .filter(item => item.value > 0);
}

// Helper function to generate overall progress chart data with grouped statuses
// Groups similar construction phases together for a high-level overview
export function generateOverallProgressData(
  features: Array<{ status: FeatureStatus | null }> | null | undefined
) {
  if (!features) return [];

  const statusCounts = countFeaturesByStatus(features);

  if (!statusCounts) return [];

  return [
    {
      name: 'Not Started',
      value: statusCounts['NOT_STARTED'] ?? 0,
      color: featureStatuses['NOT_STARTED'].color,
    },
    {
      name: 'Prep Work',
      value: statusCounts['PREP_WORK'] ?? 0,
      color: featureStatuses['PREP_WORK'].color,
    },
    {
      name: 'Foundations',
      value:
        (statusCounts['DIGGING'] ?? 0) +
        (statusCounts['SEGMENT_INSTALLATION'] ?? 0) +
        (statusCounts['FOUNDATIONS'] ?? 0) +
        (statusCounts['PIERS'] ?? 0),
      color: featureStatuses['PIERS'].color,
    },
    {
      name: 'Superstructure',
      value:
        (statusCounts['DECK'] ?? 0) +
        (statusCounts['PARAPET'] ?? 0) +
        (statusCounts['SIDE_TUNNELS'] ?? 0) +
        (statusCounts['SURFACE_BUILDINGS'] ?? 0),
      color: featureStatuses['DECK'].color,
    },
    {
      name: 'Civils',
      value: (statusCounts['CIVILS'] ?? 0) + (statusCounts['LANDSCAPING'] ?? 0),
      color: featureStatuses['CIVILS'].color,
    },
    {
      name: 'Completed',
      value: statusCounts['COMPLETED'] ?? 0,
      color: featureStatuses['COMPLETED'].color,
    },
  ].filter(item => item.value > 0);
}
