import { notFound } from 'next/navigation';
import { Heading, Stack } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { generateOverallProgressData } from '@/utils/progress-data';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import { REGIONS } from '../config';
import PlansList from '../PlansList';

const regionData = REGIONS.find(r => r.id === 'birmingham');

export default async function BirminghamPage() {
  const supabase = await createClient();

  if (!regionData) {
    notFound();
  }

  // Get all features
  const { data: features } = await supabase
    .from('features')
    .select('route_element_id, status, chainage')
    .gte('chainage', regionData.chainageFrom)
    .lt('chainage', regionData.chainageTo)
    .ilike('route_element_id', 'B%')
    .not('type', 'eq', 'culvert')
    .not('type', 'eq', 'shaft');

  const { data: plans } = await supabase
    .from('groupings')
    .select('id, name, type, chainage_from, description')
    .eq('type', 'plan_sheet')
    .gte('chainage_from', regionData.chainageFrom)
    .lt('chainage_from', regionData.chainageTo)
    .ilike('name', 'Birmingham%')
    .order('chainage_from', { ascending: true });

  return (
    <Stack gap={8}>
      <Breadcrumb
        items={[{ title: 'Route', url: '/route' }, { title: regionData.name }]}
        size={{ base: 'sm', md: 'md' }}
      />

      {/* Header */}
      <Stack gap={2}>
        <Heading size='2xl'>{regionData.name}</Heading>
        <Heading size='lg' color='fg.muted' fontWeight='normal'>
          Explore the HS2 route {regionData.description.replace('From', 'from')}
        </Heading>
      </Stack>

      <ProgressChart data={generateOverallProgressData(features)} />

      <PlansList region='london' plans={plans} />
    </Stack>
  );
}
