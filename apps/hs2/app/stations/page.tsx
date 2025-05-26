import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  SimpleGrid,
  Separator,
} from '@chakra-ui/react';
import Link from 'next/link';

const stationsData = [
  {
    name: 'London Euston',
    phase: 'Phase 1',
    status: 'Redevelopment',
    location: 'London',
    description:
      'Major terminus station serving as the southern gateway to HS2',
    features: ['18 platforms', 'Underground connections', 'Retail & dining'],
    completion: '2029',
  },
  {
    name: 'Old Oak Common',
    phase: 'Phase 1',
    status: 'Under Construction',
    location: 'West London',
    description:
      'New super-hub station connecting HS2 with Crossrail and conventional rail',
    features: ['14 platforms', 'Crossrail interchange', 'Major transport hub'],
    completion: '2029',
  },
  {
    name: 'Birmingham Interchange',
    phase: 'Phase 1',
    status: 'Under Construction',
    location: 'Solihull',
    description: 'Purpose-built station near Birmingham Airport and NEC',
    features: [
      'Airport connection',
      'Automated people mover',
      'Parkway design',
    ],
    completion: '2030',
  },
  {
    name: 'Birmingham Curzon Street',
    phase: 'Phase 1',
    status: 'Under Construction',
    location: 'Birmingham City Centre',
    description:
      'City centre terminus bringing HS2 into the heart of Birmingham',
    features: [
      'Historic facade restoration',
      'City centre location',
      'Metro connections',
    ],
    completion: '2030',
  },
  {
    name: 'Crewe',
    phase: 'Phase 2a',
    status: 'Planning',
    location: 'Cheshire',
    description: 'Major junction station connecting Phase 1 and 2a',
    features: [
      'Network Rail integration',
      'Junction design',
      'Regional connections',
    ],
    completion: '2033',
  },
  {
    name: 'Manchester Airport',
    phase: 'Phase 2b',
    status: 'Proposed',
    location: 'Manchester',
    description: 'Direct connection to Manchester Airport',
    features: [
      'Airport terminal link',
      'International gateway',
      'Multi-modal hub',
    ],
    completion: '2038',
  },
  {
    name: 'Manchester Piccadilly',
    phase: 'Phase 2b',
    status: 'Proposed',
    location: 'Manchester City Centre',
    description: 'Enhanced city centre station with HS2 platforms',
    features: [
      'Existing station expansion',
      'City centre access',
      'Tram connections',
    ],
    completion: '2038',
  },
  {
    name: 'Leeds',
    phase: 'Phase 2b',
    status: 'Proposed',
    location: 'Leeds City Centre',
    description: 'New station bringing high-speed rail to Yorkshire',
    features: [
      'New build station',
      'City regeneration',
      'Regional connectivity',
    ],
    completion: '2040',
  },
];

export default function StationsPage() {
  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={6} align='stretch'>
        {/* Header */}
        <HStack justify='space-between' align='center'>
          <Box>
            <Heading as='h1' size='xl' mb={2}>
              HS2 Stations & Routes
            </Heading>
            <Text color='gray.600'>
              Explore all stations along the HS2 network
            </Text>
          </Box>
          <Link href='/'>
            <Button variant='outline'>← Back to Dashboard</Button>
          </Link>
        </HStack>

        {/* Route Overview */}
        <Box
          bg='blue.50'
          borderColor='blue.200'
          borderWidth='1px'
          borderRadius='lg'
          p={6}
        >
          <VStack align='stretch' gap={4}>
            <Heading as='h2' size='lg' color='blue.800'>
              Route Overview
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
              <Box>
                <Text fontWeight='bold' color='blue.700'>
                  Phase 1
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  London → Birmingham
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  140 miles • 4 stations
                </Text>
              </Box>
              <Box>
                <Text fontWeight='bold' color='blue.700'>
                  Phase 2a
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  Birmingham → Crewe
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  36 miles • 1 station
                </Text>
              </Box>
              <Box>
                <Text fontWeight='bold' color='blue.700'>
                  Phase 2b
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  Crewe → Manchester & Leeds
                </Text>
                <Text fontSize='sm' color='blue.600'>
                  154 miles • 3 stations
                </Text>
              </Box>
            </SimpleGrid>
          </VStack>
        </Box>

        {/* Stations Grid */}
        <VStack gap={6} align='stretch'>
          <Heading as='h2' size='lg'>
            All Stations
          </Heading>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
            {stationsData.map((station, index) => (
              <Box
                key={index}
                borderWidth='1px'
                borderRadius='lg'
                p={6}
                _hover={{ shadow: 'md' }}
              >
                <VStack align='stretch' gap={4}>
                  <HStack justify='space-between' align='start'>
                    <Box>
                      <Heading as='h3' size='md' mb={1}>
                        {station.name}
                      </Heading>
                      <Text color='gray.600' fontSize='sm'>
                        {station.location}
                      </Text>
                    </Box>
                    <VStack gap={2} align='end'>
                      <Badge
                        colorPalette={
                          station.phase === 'Phase 1'
                            ? 'blue'
                            : station.phase === 'Phase 2a'
                              ? 'green'
                              : 'purple'
                        }
                      >
                        {station.phase}
                      </Badge>
                      <Badge
                        variant='outline'
                        colorPalette={
                          station.status === 'Under Construction'
                            ? 'blue'
                            : station.status === 'Redevelopment'
                              ? 'orange'
                              : station.status === 'Planning'
                                ? 'yellow'
                                : 'gray'
                        }
                      >
                        {station.status}
                      </Badge>
                    </VStack>
                  </HStack>

                  <Text fontSize='sm' color='gray.600'>
                    {station.description}
                  </Text>

                  <Separator />

                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                    <Box>
                      <Text fontSize='sm' fontWeight='medium' mb={2}>
                        Key Features
                      </Text>
                      <VStack align='start' gap={1}>
                        {station.features.map((feature, idx) => (
                          <Text key={idx} fontSize='sm' color='gray.600'>
                            • {feature}
                          </Text>
                        ))}
                      </VStack>
                    </Box>

                    <Box>
                      <Text fontSize='sm' fontWeight='medium' mb={2}>
                        Expected Opening
                      </Text>
                      <Text fontSize='sm' color='gray.600'>
                        {station.completion}
                      </Text>
                    </Box>
                  </SimpleGrid>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      </VStack>
    </Container>
  );
}
