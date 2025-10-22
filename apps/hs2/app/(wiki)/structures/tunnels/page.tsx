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

export default async function TunnelsPage() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('type, status')
    .in('type', ['tunnel', 'cut_and_cover']);

  const tunnels = features?.filter(f => f.type === 'tunnel');
  const cutAndCovers = features?.filter(f => f.type === 'cut_and_cover');
  const allTunnels = features?.filter(
    f => f.type === 'tunnel' || f.type === 'cut_and_cover'
  );

  return (
    <Container maxW='5xl' py={8}>
      <VStack gap={8} align='stretch'>
        <Breadcrumb
          items={[
            { title: 'Structures', url: '/structures' },
            { title: 'Tunnels' },
          ]}
        />
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Tunnels
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the tunnels being built for HS2
          </Heading>
        </VStack>

        {/* Tunnels */}
        <FeatureSection
          stats={[
            {
              label: 'Miles of Tunnels',
              value: 65,
            },
            {
              label: 'Twin Bore Tunnels',
              value: tunnels?.length,
            },
            {
              label: 'Green Tunnels',
              value: cutAndCovers?.length,
            },
          ]}
        />
        <ProgressChart data={generateProgressData(allTunnels)} />

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          <Link href='/structures/tunnels/twin-bore-tunnels'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
                alt='Twin Bore Tunnel'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Twin-bore Tunnels</Card.Title>
                <Card.Description>
                  Twin-bore tunnels, each containing a single rail track, are
                  constructed using tunnel boring machines (TBMs).
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/tunnels/green-tunnels'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2023/09/230215_HS2_EKFB_Progress_G2S_Chipping_Warden_JR_000019-1400x631.png'
                alt='Cut-and-cover Tunnel'
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Green Tunnels</Card.Title>
                <Card.Description>
                  Green tunnels will be built using the cut-and-cover method of
                  construction, with trees and shrubs then planted on top.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
