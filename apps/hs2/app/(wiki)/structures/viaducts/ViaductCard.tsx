import { Card, HStack } from '@chakra-ui/react';
import Link from 'next/link';

import { FeatureStatus } from '@supabase/types';
import { FeatureStatusBadge } from '@/components/feature/feature-status-badge';

const ViaductCard = ({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: FeatureStatus;
}) => (
  <Link href={`/structures/viaducts/${id}`}>
    <Card.Root size={{ base: 'sm', md: 'md' }}>
      <Card.Body gap='2'>
        <HStack justify='space-between'>
          <Card.Title color='blue.400'>{name}</Card.Title>
          <FeatureStatusBadge status={status} />
        </HStack>
      </Card.Body>
    </Card.Root>
  </Link>
);

export default ViaductCard;
