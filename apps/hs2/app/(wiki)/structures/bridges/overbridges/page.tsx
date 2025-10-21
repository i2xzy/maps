import { Card, Container, Heading, VStack } from '@chakra-ui/react';
import Link from 'next/link';

import { createClient } from '@supabase/server';
import { FeatureStatus } from '@supabase/types';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';

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

export default async function OverbridgesPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('id, type, status, name')
    .in('type', ['overbridge']);

  // Count Bridges by status
  const bridgeStatusCounts = countFeaturesByStatus(features);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Bridges', url: '/structures/bridges' },
            { title: 'Overbridges' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Overbridges
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Progress of the overbridges being built for HS2
          </Heading>
        </VStack>

        {bridgeStatusCounts && (
          <ProgressChart data={generateProgressData(bridgeStatusCounts)} />
        )}

        <VStack gap={6} align='stretch'>
          <Heading as='h2'>All overbridges</Heading>
          {features?.map(feature => (
            <Link
              href={`/structures/bridges/overbridges/${feature.id}`}
              key={feature.id}
            >
              <Card.Root overflow='hidden' variant='subtle'>
                {/* <Image
                  src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
                  alt='Viaducts'
                  height={300}
                  objectFit='cover'
                  objectPosition='left'
                /> */}
                <Card.Body gap='2'>
                  <Card.Title color='blue.400'>{feature.name}</Card.Title>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </VStack>
      </VStack>
    </Container>
  );
}
