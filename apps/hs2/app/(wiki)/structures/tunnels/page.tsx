import {
  Card,
  Container,
  Heading,
  Image,
  SimpleGrid,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';

import { createClient } from '@supabase/server';
import { FeatureStatus } from '@supabase/types';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import FeatureSection from '@/components/feature-section';

// Helper function to count features by status
function countFeaturesByStatus(
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

// Helper function to generate progress chart data for different feature types
function generateProgressData(
  statusCounts: Record<NonNullable<FeatureStatus>, number> | undefined
) {
  if (!statusCounts) return [];

  return [
    {
      name: 'Not Started',
      value: statusCounts['NOT_STARTED'] ?? 0,
      color: 'red.600',
    },
    {
      name: 'Prep Work',
      value: statusCounts['PREP_WORK'] ?? 0,
      color: 'red.500',
    },
    {
      name: 'Digging',
      value: statusCounts['DIGGING'] ?? 0,
      color: 'yellow.600',
    },
    {
      name: 'Foundations',
      value: statusCounts['FOUNDATIONS'] ?? 0,
      color: 'yellow.600',
    },
    {
      name: 'Segment Installation',
      value: statusCounts['SEGMENT_INSTALLATION'] ?? 0,
      color: 'yellow.500',
    },
    {
      name: 'Piers',
      value: statusCounts['PIERS'] ?? 0,
      color: 'yellow.500',
    },
    {
      name: 'Side Tunnels',
      value: statusCounts['SIDE_TUNNELS'] ?? 0,
      color: 'blue.500',
    },
    {
      name: 'Deck',
      value: statusCounts['DECK'] ?? 0,
      color: 'blue.500',
    },
    {
      name: 'Parapet',
      value: statusCounts['PARAPET'] ?? 0,
      color: 'blue.600',
    },
    {
      name: 'Civils',
      value: statusCounts['CIVILS'] ?? 0,
      color: 'green.500',
    },
    {
      name: 'Completed',
      value: statusCounts['COMPLETED'] ?? 0,
      color: 'green.600',
    },
  ].filter(item => item.value > 0);
}

export default async function TunnelsPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('type, status')
    .in('type', ['tunnel', 'cut_and_cover']);

  const tunnels = features?.filter(f => f.type === 'tunnel');
  const cutAndCovers = features?.filter(f => f.type === 'cut_and_cover');
  const allTunnels = features?.filter(
    f => f.type === 'tunnel' || f.type === 'cut_and_cover'
  );

  // Count Tunnels by status
  const tunnelStatusCounts = countFeaturesByStatus(allTunnels);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Tunnels' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Tunnels
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the tunnels being built for HS2
          </Heading>
        </VStack>

        {/* Tunnels */}
        <FeatureSection
          stats={[
            {
              label: 'Miles of Tunnels',
              value: 65,
            },
            {
              label: 'Twin Bore Tunnels',
              value: tunnels?.length,
            },
            {
              label: 'Green Tunnels',
              value: cutAndCovers?.length,
            },
          ]}
        />
        {tunnelStatusCounts && (
          <ProgressChart data={generateProgressData(tunnelStatusCounts)} />
        )}

        <SimpleGrid columns={2} gap={6}>
          <Link href='/wiki/tunnels/twin-bore-tunnels'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
                alt='Twin Bore Tunnel'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Twin-bore Tunnels</Card.Title>
                <Card.Description>
                  Twin-bore tunnels, each containing a single rail track, are
                  constructed using tunnel boring machines (TBMs).
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/wiki/tunnels/green-tunnels'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2023/09/230215_HS2_EKFB_Progress_G2S_Chipping_Warden_JR_000019-1400x631.png'
                alt='Cut-and-cover Tunnel'
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Green Tunnels</Card.Title>
                <Card.Description>
                  Green tunnels will be built using the cut-and-cover method of
                  construction, with trees and shrubs then planted on top.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
