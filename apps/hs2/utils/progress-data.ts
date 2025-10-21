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
