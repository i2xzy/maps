import {
  Card,
  Container,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  HStack,
} from '@chakra-ui/react';
import Link from 'next/link';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import { generateProgressData } from '@/utils/progress-data';
import { FeatureStatusBadge } from '@/components/feature/feature-status-badge';

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

  return (
    <Container maxW='5xl' py={8}>
      <Stack gap={8}>
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            { title: 'Stations' },
          ]}
        />
        {/* Header */}
        <Stack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Stations
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the stations being built for HS2
          </Heading>
        </Stack>

        <ProgressChart data={generateProgressData(features)} />

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          {features?.map(feature => (
            <Link href={`/structures/stations/${feature.id}`} key={feature.id}>
              <Card.Root
                overflow='hidden'
                variant='subtle'
                size={{ base: 'sm', md: 'md' }}
              >
                <Image
                  src={feature.media_features[0]?.media.url}
                  alt={feature.name}
                  height={300}
                  objectFit='cover'
                />
                <Card.Body gap='2'>
                  <HStack direction='row' justifyContent='space-between'>
                    <Card.Title color='blue.400'>{feature.name}</Card.Title>
                    <FeatureStatusBadge status={feature.status} />
                  </HStack>
                  <Card.Description>{feature.description}</Card.Description>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
