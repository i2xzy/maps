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
    .not('chainage', 'is', null)
    .in('type', ['overbridge'])
    .order('chainage', { ascending: true });

  // split features into 2 arrays based on route_element_id; if it begins with B it's Birmingham Spur and otherwise it's the main line
  const birminghamSpurOverbridges = features?.filter(feature =>
    feature.route_element_id?.startsWith('B')
  );
  const mainLineOverbridges = features?.filter(
    feature => !feature.route_element_id?.startsWith('B')
  );

  return (
    <Container maxW='5xl' py={8}>
      <Stack gap={8}>
        <Breadcrumb
          items={[
            { title: 'Structures', url: '/structures' },
            { title: 'Bridges', url: '/structures/bridges' },
            { title: 'Overbridges' },
          ]}
        />
        {/* Header */}
        <Stack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Overbridges
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Progress of the overbridges being built for HS2
          </Heading>
        </Stack>

        <ProgressChart data={generateProgressData(features)} />

        <Stack gap={6}>
          <Heading as='h2'>Main Line Overbridges</Heading>
          {mainLineOverbridges?.map(overbridge => (
            <BridgeCard
              key={overbridge.id}
              {...overbridge}
              type='overbridges'
            />
          ))}
          <Heading as='h2'>Birmingham Spur Overbridges</Heading>
          {birminghamSpurOverbridges?.map(overbridge => (
            <BridgeCard
              key={overbridge.id}
              {...overbridge}
              type='overbridges'
            />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
