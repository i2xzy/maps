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
import { FeatureStatus } from '@supabase/types';
import { countFeaturesByStatus } from '@/utils/progress-data';
import ProgressChart from '@/components/progress-chart';
import StatCard from '@/components/stat-card';
import { featureStatuses } from '@/components/feature/config';

// Helper function to generate overall progress chart data
function generateOverallProgressData(
  statusCounts: Record<NonNullable<FeatureStatus>, number> | undefined
) {
  if (!statusCounts) return [];

  return [
    {
      name: 'Not Started',
      value: statusCounts['NOT_STARTED'] ?? 0,
      color: featureStatuses['NOT_STARTED'].color,
    },
    {
      name: 'Prep Work',
      value: statusCounts['PREP_WORK'] ?? 0,
      color: featureStatuses['PREP_WORK'].color,
    },
    {
      name: 'Foundations',
      value:
        (statusCounts['DIGGING'] ?? 0) +
        (statusCounts['SEGMENT_INSTALLATION'] ?? 0) +
        (statusCounts['FOUNDATIONS'] ?? 0) +
        (statusCounts['PIERS'] ?? 0),
      color: featureStatuses['PIERS'].color,
    },
    {
      name: 'Superstructure',
      value:
        (statusCounts['DECK'] ?? 0) +
        (statusCounts['PARAPET'] ?? 0) +
        (statusCounts['SIDE_TUNNELS'] ?? 0) +
        (statusCounts['SURFACE_BUILDINGS'] ?? 0),
      color: featureStatuses['DECK'].color,
    },
    {
      name: 'Civils',
      value: (statusCounts['CIVILS'] ?? 0) + (statusCounts['LANDSCAPING'] ?? 0),
      color: featureStatuses['CIVILS'].color,
    },
    {
      name: 'Completed',
      value: statusCounts['COMPLETED'] ?? 0,
      color: featureStatuses['COMPLETED'].color,
    },
  ];
}

export default async function Home() {
  const supabase = await createClient();
  const { data: features } = await supabase
    .from('features')
    .select('type, status, name')
    .not('type', 'eq', 'culvert')
    .not('type', 'eq', 'shaft');

  const stations = features?.filter(f => f.type === 'station');
  const allTunnels = features?.filter(
    f => f.type === 'tunnel' || f.type === 'cut_and_cover'
  );
  const allBridges = features?.filter(f =>
    ['overbridge', 'underbridge', 'underpass'].includes(f.type)
  );
  const allViaducts = features?.filter(
    f => f.type === 'viaduct' || f.type === 'box_structure'
  );

  const topLevelStats = [
    { label: 'Major Features', value: features?.length || 0 },
    { label: 'Stations', value: stations?.length || 0 },
    { label: 'Tunnels', value: allTunnels?.length || 0 },
    { label: 'Bridges', value: allBridges?.length || 0 },
    { label: 'Viaducts', value: allViaducts?.length || 0 },
  ];

  // Count features by all statuses
  const statusCounts = countFeaturesByStatus(features);

  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Header */}
        <VStack gap={2} align='start'>
          <Heading as='h1' size='2xl'>
            HS2 Structures
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Overview of the structures being built for HS2
          </Heading>
        </VStack>

        {/* Top Level Stats */}
        <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} gap={6}>
          {topLevelStats.map(stat => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </SimpleGrid>

        {statusCounts && (
          <ProgressChart data={generateOverallProgressData(statusCounts)} />
        )}

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
          <Link href='/structures/stations'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://cdn.prgloo.com/media/91d77d87f3ae4120bc553a7a70fb9886.jpg?width=1120&height=1680'
                alt='Stations'
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Stations</Card.Title>
                <Card.Description>
                  Stations will be built at key locations along the route to
                  serve the new high speed railway.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/tunnels'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
                alt='Twin Bore Tunnel'
                height={300}
                objectFit='cover'
                objectPosition='left'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Tunnels</Card.Title>
                <Card.Description>
                  Five twin-bore tunnels and six green, or cut-and-cover,
                  tunnels will be built between London and Birmingham.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/bridges'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://cdn.prgloo.com/media/780e3c496aad490085872af101cd85c4.jpeg?width=1120&height=1680'
                alt='Bridges'
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Bridges</Card.Title>
                <Card.Description>
                  Bridges will take existing roads, bridleways and footpaths
                  over or under the new railway.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
          <Link href='/structures/viaducts'>
            <Card.Root overflow='hidden' variant='subtle'>
              <Image
                src='https://assets.hs2.org.uk/wp-content/uploads/2025/04/Colne-Valley-Viaduct_16-by-9-1400x631.png'
                alt='Viaducts'
                height={300}
                objectFit='cover'
              />
              <Card.Body gap='2'>
                <Card.Title color='blue.400'>Viaducts</Card.Title>
                <Card.Description>
                  Viaducts will carry the new high speed railway over multi-lane
                  roads, rivers and valleys.
                </Card.Description>
              </Card.Body>
            </Card.Root>
          </Link>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
