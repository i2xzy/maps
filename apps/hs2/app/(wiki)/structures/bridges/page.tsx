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
import { Breadcrumb } from '@ui/components/breadcrumb';
import ProgressChart from '@/components/progress-chart';
import FeatureSection from '@/components/feature/feature-section';
import { generateProgressData } from '@/utils/progress-data';

export default async function BridgesPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('type, status, chainage')
    .in('type', ['overbridge', 'underbridge', 'underpass']);

  const overbridges = features?.filter(
    f => f.type === 'overbridge' && f.chainage !== null
  );
  const underbridges = features?.filter(
    f => f.type === 'underbridge' && f.chainage !== null
  );
  const underpasses = features?.filter(
    f => f.type === 'underpass' && f.chainage !== null
  );

  const otherBridges = features?.filter(f => f.chainage === null);

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Structures', url: '/structures' },
            { title: 'Bridges' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Bridges
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the bridges being built for HS2
          </Heading>
        </VStack>

        {/* Tunnels */}
        <FeatureSection
          stats={[
            {
              label: 'Overbridges',
              value: overbridges?.length,
            },
            {
              label: 'Underbridges',
              value: underbridges?.length,
            },
            {
              label: 'Underpasses',
              value: underpasses?.length,
            },
            {
              label: 'Other Bridges',
              value: otherBridges?.length,
              helpText: 'Not on the HS2 route',
            },
          ]}
        />
        <ProgressChart data={generateProgressData(features)} />

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          <Link href='/structures/bridges/overbridges'>
            <Card.Root overflow='hidden' variant='subtle' h='100%'>
              <Image
                src='https://cdn.prgloo.com/media/780e3c496aad490085872af101cd85c4.jpeg?width=1120&height=1680'
                alt='Overbridges'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Overbridges</Card.Title>
                <Card.Description>
                  Overbridges are bridges that span over the HS2 route.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/bridges/underbridges'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://cdn.prgloo.com/media/fbe4318f01fe4d638dceadbfa3322426.jpg?width=1120&height=1680'
                alt='Underbridges'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>
                  Underbridges and Underpasses
                </Card.Title>
                <Card.Description>
                  Underbridges and underpasses are bridges that are built under
                  the HS2 route.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
