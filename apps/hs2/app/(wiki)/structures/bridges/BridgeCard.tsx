import { Card, HStack } from '@chakra-ui/react';
import Link from 'next/link';

import { FeatureStatus } from '@supabase/types';
import { FeatureStatusBadge } from '@/components/feature/feature-status-badge';

const BridgeCard = ({
  id,
  name,
  status,
  type,
}: {
  id: string;
  name: string;
  status: FeatureStatus;
  type: 'overbridges' | 'underbridges';
}) => (
  <Link href={`/structures/bridges/${type}/${id}`}>
    <Card.Root overflow='hidden' variant='subtle'>
      <Card.Body gap='2'>
        <HStack justify='space-between'>
          <Card.Title color='blue.400'>{name}</Card.Title>
          <FeatureStatusBadge status={status} />
        </HStack>
      </Card.Body>
    </Card.Root>
  </Link>
);

export default BridgeCard;
