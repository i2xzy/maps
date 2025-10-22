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
    <Card.Root
      overflow='hidden'
      variant='subtle'
      size={{ base: 'sm', md: 'md' }}
    >
      {/* <Image
      src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
      alt='Viaducts'
      height={300}
      objectFit='cover'
      objectPosition='left'
    /> */}
      <Card.Body gap='2'>
        <HStack justify='space-between'>
          <Card.Title color='blue.400'>
            {name.replace(' East Viaduct', ' Viaducts')}
          </Card.Title>
          <FeatureStatusBadge status={status} />
        </HStack>
        {name.includes('East Viaduct') && (
          <Card.Description>
            {name} and {name.replace(' East Viaduct', ' West Viaduct')}
          </Card.Description>
        )}
      </Card.Body>
    </Card.Root>
  </Link>
);

export default ViaductCard;
