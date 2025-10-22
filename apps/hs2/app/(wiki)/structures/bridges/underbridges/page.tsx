import { Container, Heading, Stack } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import { generateProgressData } from '@/utils/progress-data';
import BridgeCard from '../BridgeCard';

export default async function OverbridgesPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('id, type, status, name, chainage, route_element_id')
    .in('type', ['underbridge', 'underpass'])
    .not('chainage', 'is', null)
    .order('chainage', { ascending: true });

  // split features into 2 arrays based on route_element_id; if it begins with B it's Birmingham Spur and otherwise it's the main line
  const birminghamSpurUnderbridges = features?.filter(feature =>
    feature.route_element_id?.startsWith('B')
  );
  const mainLineUnderbridges = features?.filter(
    feature => !feature.route_element_id?.startsWith('B')
  );

  return (
    <Container maxW='5xl' py={8}>
      <Stack gap={8}>
        <Breadcrumb
          items={[
            { title: 'Structures', url: '/structures' },
            { title: 'Bridges', url: '/structures/bridges' },
            { title: 'Underbridges' },
          ]}
        />
        {/* Header */}
        <Stack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Underbridges
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Progress of the underbridges and underpasses being built for HS2
          </Heading>
        </Stack>

        <ProgressChart data={generateProgressData(features)} />

        <Stack gap={6}>
          {/* <Heading as='h2'>All underbridges and underpasses</Heading>
          {features?.map(feature => (
            <BridgeCard
              id={feature.id}
              name={feature.name}
              status={feature.status}
              type='underbridges'
              key={feature.id}
            />
          ))} */}
          <Heading as='h2'>Main Line Underbridges and Underpasses</Heading>
          {mainLineUnderbridges?.map(underbridge => (
            <BridgeCard
              key={underbridge.id}
              {...underbridge}
              type='underbridges'
            />
          ))}
          <Heading as='h2'>Birmingham Spur Underbridges</Heading>
          {birminghamSpurUnderbridges?.map(underbridge => (
            <BridgeCard
              key={underbridge.id}
              {...underbridge}
              type='underbridges'
            />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
