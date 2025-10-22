import { Badge, Box } from '@chakra-ui/react';
import { FeatureStatus } from '@supabase/types';
import { featureStatuses } from './config';

interface FeatureStatusBadgeProps {
  status: FeatureStatus | null;
  size?: 'sm' | 'md' | 'lg';
}

export function FeatureStatusBadge({
  status,
  size = 'sm',
}: FeatureStatusBadgeProps) {
  if (!status) return null;

  const statusConfig = featureStatuses[status];

  return (
    <Badge
      colorPalette={statusConfig.colorPalette}
      size={size}
      variant='solid'
      bg={statusConfig.color}
    >
      <Box hideBelow='md'>{statusConfig.label}</Box>
      <Box hideFrom='md'>{statusConfig.labelShort || statusConfig.label}</Box>
    </Badge>
  );
}
