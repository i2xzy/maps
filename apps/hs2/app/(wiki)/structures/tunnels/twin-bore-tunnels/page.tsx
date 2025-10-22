import { Card, Container, Heading, HStack, Stack } from '@chakra-ui/react';
import Link from 'next/link';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import { FeatureStatusBadge } from '@/components/feature/feature-status-badge';
import { generateProgressData } from '@/utils/progress-data';

export default async function TwinBoreTunnelsPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('id, type, status, name, chainage')
    .in('type', ['tunnel'])
    .not('chainage', 'is', null)
    .order('chainage', { ascending: true });

  return (
    <Container maxW='5xl' py={8}>
      <Stack gap={8}>
        <Breadcrumb
          items={[
            { title: 'Structures', url: '/structures' },
            { title: 'Tunnels', url: '/structures/tunnels' },
            { title: 'Twin Bore Tunnels' },
          ]}
          size={{ base: 'sm', md: 'md' }}
        />
        {/* Header */}
        <Stack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Twin Bore Tunnels
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Progress of the twin bore tunnels being built for HS2
          </Heading>
        </Stack>

        <ProgressChart data={generateProgressData(features)} />

        <Stack gap={6}>
          <Heading as='h2'>All twin bore tunnels</Heading>
          {features?.map(feature => (
            <Link
              href={`/structures/tunnels/twin-bore-tunnels/${feature.id}`}
              key={feature.id}
            >
              <Card.Root
                overflow='hidden'
                variant='subtle'
                size={{ base: 'sm', md: 'md' }}
              >
                <Card.Body gap='2'>
                  <HStack justify='space-between'>
                    <Card.Title color='blue.400'>{feature.name}</Card.Title>
                    <FeatureStatusBadge status={feature.status} />
                  </HStack>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
