import { Container, Heading, VStack } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { FeatureStatus } from '@supabase/types';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import FeatureSection from '@/components/feature-section';

import ViaductCard from './ViaductCard';

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

export default async function ViaductsPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('id, name,type, status, chainage, route_element_id')
    .in('type', ['viaduct', 'box_structure'])
    .not('name', 'like', '%West Viaduct%')
    .order('chainage', { ascending: true });

  // Some viaducts are made up of 2 segments e.g.  but should be counted as 1

  const viaducts = features?.filter(feature => feature.type === 'viaduct');
  const boxStructures = features?.filter(
    feature => feature.type === 'box_structure'
  );

  // split features into 3 arrays based on route_element_id; if it begins with B it's Birmingham Spur, if it begins with N it's North Cord and otherwise it's the main line
  const birminghamSpurViaducts = features?.filter(feature =>
    feature.route_element_id?.startsWith('B')
  );
  const northCordViaducts = features?.filter(feature =>
    feature.route_element_id?.startsWith('N')
  );
  const mainLineViaducts = features?.filter(
    feature =>
      !feature.route_element_id?.startsWith('B') &&
      !feature.route_element_id?.startsWith('N')
  );

  console.log(birminghamSpurViaducts);
  console.log(northCordViaducts);
  console.log(mainLineViaducts?.map(feature => feature.route_element_id));

  // Count Tunnels by status
  const viaductStatusCounts = countFeaturesByStatus(features);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Viaducts' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Viaducts
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the viaducts being built for HS2
          </Heading>
        </VStack>

        {/* Tunnels */}
        <FeatureSection
          stats={[
            {
              label: 'km of viaducts',
              value: 15,
            },
            {
              label: 'Viaducts',
              value: viaducts?.length,
            },
            {
              label: 'Box Structures',
              value: boxStructures?.length,
            },
          ]}
        />
        {viaductStatusCounts && (
          <ProgressChart data={generateProgressData(viaductStatusCounts)} />
        )}

        <VStack gap={6} align='stretch'>
          <Heading as='h2'>Main Line Viaducts and Box Structures</Heading>
          {mainLineViaducts?.map(viaduct => (
            <ViaductCard id={viaduct.id} name={viaduct.name} key={viaduct.id} />
          ))}
          <Heading as='h2'>Birmingham Spur Viaducts</Heading>
          {birminghamSpurViaducts?.map(viaduct => (
            <ViaductCard id={viaduct.id} name={viaduct.name} key={viaduct.id} />
          ))}
          <Heading as='h2'>North Cord Viaducts</Heading>
          {northCordViaducts?.map(viaduct => (
            <ViaductCard id={viaduct.id} name={viaduct.name} key={viaduct.id} />
          ))}
        </VStack>
      </VStack>
    </Container>
  );
}
