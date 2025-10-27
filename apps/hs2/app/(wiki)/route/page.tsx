import type { Metadata } from 'next';
import {
  Card,
  Heading,
  Text,
  Stack,
  SimpleGrid,
  Image,
} from '@chakra-ui/react';
import Link from 'next/link';

import { createClient } from '@supabase/server';
import { generateOverallProgressData } from '@/utils/progress-data';
import ProgressChart from '@/components/progress-chart';
import { REGIONS } from './config';

export const metadata: Metadata = {
  title: 'Route Overview',
  description:
    'Explore the HS2 route organized by geographical regions: London Metropolitan, Country South, Country North, and Birmingham Spur. View plan sheets and construction progress for each section.',
};

export default async function RoutePage() {
  const supabase = await createClient();

  // Get all features
  const { data: features } = await supabase
    .from('features')
    .select('status')
    .not('type', 'eq', 'culvert')
    .not('type', 'eq', 'shaft');

  return (
    <Stack gap={8}>
      {/* Header */}
      <Stack gap={2}>
        <Heading size='2xl'>Route Overview</Heading>
        <Heading size='lg' color='fg.muted' fontWeight='normal'>
          Explore the HS2 route organized by geographical regions.
        </Heading>
        <Text fontSize='sm' color='fg.muted'>
          The HS2 plans are divided into 5 zones: Euston Section, London
          Metropolitan, Country South, Country North, and East Midlands. But the
          East Midlands zone includes parts of the route to the south of the
          Delta Junction and most but not all of the Birmingham Spur. This
          website groups all of the Birmingham Spur together and combines the
          Euston Section and London Metropolitan into one region.
        </Text>
      </Stack>

      <ProgressChart data={generateOverallProgressData(features)} />

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
        {REGIONS.map(region => (
          <Link href={`/route/${region.id}`} key={region.id}>
            <Card.Root overflow='hidden'>
              <Image
                src={region.image}
                alt={region.imageAlt}
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>{region.name}</Card.Title>
                <Card.Description>{region.description}</Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
