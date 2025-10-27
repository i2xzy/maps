import type { Metadata } from 'next';
import {
  Container,
  Heading,
  Text,
  Stack,
  HStack,
  Badge,
  Card,
} from '@chakra-ui/react';

import { featureTypes } from '@/components/feature/config';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { FeatureType } from '@supabase/types';

export const metadata: Metadata = {
  title: 'Interactive Map',
  description:
    'Explore the HS2 route on an interactive map showing stations, bridges, tunnels, viaducts, and other structures with real-time construction progress from London to Birmingham.',
};

export default function MapPage() {
  return (
    <Container maxW='8xl' py={8}>
      <Stack gap={8}>
        {/* Header */}
        <Stack gap={2}>
          <Heading as='h1' size='2xl'>
            Interactive Map
          </Heading>
          <Heading size='lg' color='gray.600' fontWeight='normal'>
            Explore the High Speed 2 railway route and construction sites
          </Heading>
        </Stack>

        {/* Map Container */}
        <Card.Root height={{ base: '400px', md: '600px' }} bg='gray.100'>
          <Card.Body p={0} alignItems='center' justifyContent='center'>
            <Stack gap={4} textAlign='center' p={6}>
              <Heading size='lg' color='gray.500'>
                Interactive Map Coming Soon
              </Heading>
              <Text color='gray.600' maxW='md'>
                This will display the full HS2 route from London to Birmingham
                and beyond, with real-time construction progress, active sites,
                and key milestones.
              </Text>
              <HStack gap={2} justify='center' wrap='wrap'>
                <Badge colorPalette='blue' size='lg'>
                  Phase 1
                </Badge>
                <Badge colorPalette='green' size='lg'>
                  Phase 2a
                </Badge>
                <Badge colorPalette='purple' size='lg'>
                  Phase 2b
                </Badge>
              </HStack>
            </Stack>
          </Card.Body>
        </Card.Root>

        {/* Map Features */}
        <Stack gap={4}>
          <Heading size='lg'>Planned Features</Heading>
          <HStack gap={4} wrap='wrap'>
            {(
              [
                'station',
                'overbridge',
                'underbridge',
                'tunnel',
                'viaduct',
                'embankment',
                'cutting',
                'culvert',
              ] as FeatureType[]
            ).map(type => (
              <Badge key={type} size='lg'>
                <FeatureIcon type={type} />
                {featureTypes[type].label}s
              </Badge>
            ))}
          </HStack>
        </Stack>
      </Stack>
    </Container>
  );
}
