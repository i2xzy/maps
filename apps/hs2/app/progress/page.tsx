import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  Card,
} from '@chakra-ui/react';
import Link from 'next/link';

const phaseData = [
  {
    phase: 'Phase 1',
    route: 'London to Birmingham',
    progress: 65,
    status: 'In Progress',
    expectedCompletion: '2029-2033',
    keyMilestones: [
      'Tunnel boring complete',
      'Viaduct construction 80% complete',
      'Station construction underway',
    ],
  },
  {
    phase: 'Phase 2a',
    route: 'Birmingham to Crewe',
    progress: 25,
    status: 'Early Works',
    expectedCompletion: '2030-2035',
    keyMilestones: [
      'Environmental surveys complete',
      'Land acquisition ongoing',
      'Design development in progress',
    ],
  },
  {
    phase: 'Phase 2b',
    route: 'Crewe to Manchester & Leeds',
    progress: 10,
    status: 'Planning',
    expectedCompletion: '2035-2040',
    keyMilestones: [
      'Route consultation complete',
      'Environmental impact assessment',
      'Parliamentary approval pending',
    ],
  },
];

export default function ProgressPage() {
  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={6} align='stretch'>
        {/* Header */}
        <HStack justify='space-between' align='center'>
          <Box>
            <Heading as='h1' size='xl' mb={2}>
              Construction Progress
            </Heading>
            <Text color='gray.600'>
              Track the progress of HS2 construction across all phases
            </Text>
          </Box>
          <Link href='/'>
            <Button variant='outline'>← Back to Dashboard</Button>
          </Link>
        </HStack>

        {/* Overall Progress Stats */}
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Overall Progress
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                45%
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Across all phases
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Active Construction Sites
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                350+
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Currently operational
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Miles of Track Laid
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                85
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Out of 330 total miles
              </Text>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        {/* Phase Progress */}
        <VStack gap={6} align='stretch'>
          <Heading as='h2' size='lg'>
            Progress by Phase
          </Heading>

          {phaseData.map((phase, index) => (
            <Box key={index} borderWidth='1px' borderRadius='lg' p={6}>
              <VStack align='stretch' gap={4}>
                <HStack justify='space-between' align='center'>
                  <Box>
                    <Heading as='h3' size='md' mb={1}>
                      {phase.phase}
                    </Heading>
                    <Text color='gray.600' fontSize='sm'>
                      {phase.route}
                    </Text>
                  </Box>
                  <Badge
                    colorPalette={
                      phase.status === 'In Progress'
                        ? 'blue'
                        : phase.status === 'Early Works'
                          ? 'yellow'
                          : 'gray'
                    }
                    fontSize='sm'
                    px={3}
                    py={1}
                  >
                    {phase.status}
                  </Badge>
                </HStack>

                <Box>
                  <HStack justify='space-between' mb={2}>
                    <Text fontSize='sm' fontWeight='medium'>
                      Progress
                    </Text>
                    <Text fontSize='sm' color='gray.600'>
                      {phase.progress}%
                    </Text>
                  </HStack>
                  <Box
                    w='full'
                    bg='gray.200'
                    borderRadius='md'
                    h={3}
                    overflow='hidden'
                  >
                    <Box
                      h='full'
                      bg={
                        phase.progress > 50
                          ? 'green.500'
                          : phase.progress > 25
                            ? 'blue.500'
                            : 'yellow.500'
                      }
                      w={`${phase.progress}%`}
                      transition='width 0.3s'
                    />
                  </Box>
                </Box>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                  <Box>
                    <Text fontSize='sm' fontWeight='medium' mb={2}>
                      Expected Completion
                    </Text>
                    <Text fontSize='sm' color='gray.600'>
                      {phase.expectedCompletion}
                    </Text>
                  </Box>

                  <Box>
                    <Text fontSize='sm' fontWeight='medium' mb={2}>
                      Key Milestones
                    </Text>
                    <VStack align='start' gap={1}>
                      {phase.keyMilestones.map((milestone, idx) => (
                        <Text key={idx} fontSize='sm' color='gray.600'>
                          • {milestone}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Container>
  );
}
