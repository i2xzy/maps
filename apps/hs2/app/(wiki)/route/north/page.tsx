import { notFound } from 'next/navigation';
import { Heading, Stack } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { generateOverallProgressData } from '@/utils/progress-data';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import { REGIONS } from '../config';
import PlansList from '../PlansList';

const regionData = REGIONS.find(r => r.id === 'north');

// Insert North Chord sheets after sheet 44 (around chainage ~169000)
const NORTH_CHORD_INSERT_CHAINAGE = 169000; // Adjust to sheet 44's chainage

export default async function NorthPage() {
  const supabase = await createClient();

  if (!regionData) {
    notFound();
  }

  // Get all features
  const { data: features } = await supabase
    .from('features')
    .select('route_element_id, status, chainage')
    .or(
      `and(chainage.gte.${regionData.chainageFrom},chainage.lte.${regionData.chainageTo}),route_element_id.ilike.N%`
    )
    .not('type', 'eq', 'culvert')
    .not('type', 'eq', 'shaft');

  const { data: plans } = await supabase
    .from('groupings')
    .select('id, name, type, chainage_from, description')
    .eq('type', 'plan_sheet')
    .or(
      `and(chainage_from.gte.${regionData.chainageFrom},chainage_from.lte.${regionData.chainageTo}),chainage_from.is.null`
    )
    .not('name', 'ilike', 'birmingham%')
    .order('chainage_from', { ascending: true })
    .order('name', { ascending: false });

  const sortedPlans =
    plans?.sort((a, b) => {
      const aIsNorthChord = a.name?.includes('North Chord');
      const bIsNorthChord = b.name?.includes('North Chord');

      const aChain = aIsNorthChord
        ? NORTH_CHORD_INSERT_CHAINAGE
        : (a.chainage_from ?? Infinity);
      const bChain = bIsNorthChord
        ? NORTH_CHORD_INSERT_CHAINAGE
        : (b.chainage_from ?? Infinity);

      return aChain - bChain;
    }) || [];

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

      <PlansList region='north' plans={sortedPlans} />
    </Stack>
  );
}
