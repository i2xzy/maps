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

export default async function BridgesPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('type, status')
    .in('type', ['overbridge', 'underbridge', 'underpass']);

  const overbridges = features?.filter(f => f.type === 'overbridge');
  const underbridges = features?.filter(f => f.type === 'underbridge');
  const underpasses = features?.filter(f => f.type === 'underpass');

  const allBridges = features?.filter(
    f =>
      f.type === 'overbridge' ||
      f.type === 'underbridge' ||
      f.type === 'underpass'
  );

  // Count Bridges by status
  const bridgeStatusCounts = countFeaturesByStatus(allBridges);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Bridges' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Bridges
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the bridges being built for HS2
          </Heading>
        </VStack>

        {/* Tunnels */}
        <FeatureSection
          stats={[
            {
              label: 'Overbridges',
              value: overbridges?.length,
            },
            {
              label: 'Underbridges',
              value: underbridges?.length,
            },
            {
              label: 'Underpasses',
              value: underpasses?.length,
            },
          ]}
        />
        {bridgeStatusCounts && (
          <ProgressChart data={generateProgressData(bridgeStatusCounts)} />
        )}

        <SimpleGrid columns={2} gap={6}>
          <Link href='/structures/bridges/overbridges'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://cdn.prgloo.com/media/780e3c496aad490085872af101cd85c4.jpeg?width=1120&height=1680'
                alt='Overbridges'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Overbridges</Card.Title>
                <Card.Description>
                  Overbridges are bridges that span over the HS2 route.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/bridges/underbridges'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://cdn.prgloo.com/media/780e3c496aad490085872af101cd85c4.jpeg?width=1120&height=1680'
                alt='Underbridges'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>
                  Underbridges and Underpasses
                </Card.Title>
                <Card.Description>
                  Underbridges and underpasses are bridges that are built under
                  the HS2 route.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
