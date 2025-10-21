import { Container, Heading, VStack } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import FeatureSection from '@/components/feature/feature-section';
import { generateProgressData } from '@/utils/progress-data';

import ViaductCard from './ViaductCard';

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
            Overview of the viaducts and box structures being built for HS2
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
        <ProgressChart data={generateProgressData(features)} />

        <VStack gap={6} align='stretch'>
          <Heading as='h2'>Main Line Viaducts and Box Structures</Heading>
          {mainLineViaducts?.map(viaduct => (
            <ViaductCard key={viaduct.id} {...viaduct} />
          ))}
          <Heading as='h2'>Birmingham Spur Viaducts</Heading>
          {birminghamSpurViaducts?.map(viaduct => (
            <ViaductCard key={viaduct.id} {...viaduct} />
          ))}
          <Heading as='h2'>North Cord Viaducts</Heading>
          {northCordViaducts?.map(viaduct => (
            <ViaductCard key={viaduct.id} {...viaduct} />
          ))}
        </VStack>
      </VStack>
    </Container>
  );
}
