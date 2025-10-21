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
      name: 'Surface Buildings',
      value: statusCounts['SURFACE_BUILDINGS'] ?? 0,
      color: 'blue.500',
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

export default async function StationsPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select(
      `
     id,
     name,
     type,
     status,
     description,
     chainage,
     media_features(
       is_cover,
       media:media_id (
         id,
         url,
         title,
         shot_type
       )
     )
   `
    )
    .eq('type', 'station')
    .eq('media_features.is_cover', true)
    .order('chainage', { ascending: true });

  // Count Stations by status
  const stationStatusCounts = countFeaturesByStatus(features);

  console.log(features);
  console.log(stationStatusCounts);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Stations' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Stations
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the stations being built for HS2
          </Heading>
        </VStack>

        {stationStatusCounts && (
          <ProgressChart data={generateProgressData(stationStatusCounts)} />
        )}

        <SimpleGrid columns={2} gap={6}>
          {features?.map(feature => (
            <Link href={`/structures/stations/${feature.id}`} key={feature.id}>
              <Card.Root overflow='hidden' variant='subtle'>
                <Image
                  src={feature.media_features[0]?.media.url}
                  alt={feature.name}
                  height={300}
                  objectFit='cover'
                />
                <Card.Body gap='2'>
                  <Card.Title color='blue.400'>{feature.name}</Card.Title>
                  <Card.Description>{feature.description}</Card.Description>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
