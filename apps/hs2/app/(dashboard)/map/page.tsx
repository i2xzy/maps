import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';
import Link from 'next/link';

export default function MapPage() {
  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={6} align='stretch'>
        {/* Header */}
        <HStack justify='space-between' align='center'>
          <Box>
            <Heading as='h1' size='xl' mb={2}>
              HS2 Interactive Map
            </Heading>
            <Text color='gray.600'>
              Explore the High Speed 2 railway route and construction sites
            </Text>
          </Box>
          <Link href='/'>
            <Button variant='outline'>← Back to Dashboard</Button>
          </Link>
        </HStack>

        {/* Map Container */}
        <Box borderWidth='1px' borderRadius='lg' p={6}>
          <Box
            height='600px'
            bg='gray.100'
            borderRadius='md'
            display='flex'
            alignItems='center'
            justifyContent='center'
            position='relative'
          >
            <VStack gap={4} textAlign='center'>
              <Heading size='lg' color='gray.500'>
                Interactive Map Coming Soon
              </Heading>
              <Text color='gray.600' maxW='md'>
                This will display the full HS2 route from London to Birmingham
                and beyond, with real-time construction progress, active sites,
                and key milestones.
              </Text>
              <HStack gap={2}>
                <Badge colorPalette='blue'>Phase 1</Badge>
                <Badge colorPalette='green'>Phase 2a</Badge>
                <Badge colorPalette='purple'>Phase 2b</Badge>
              </HStack>
            </VStack>
          </Box>
        </Box>

        {/* Map Features */}
        <Box>
          <Heading as='h3' size='md' mb={4}>
            Map Features
          </Heading>
          <HStack gap={4} wrap='wrap'>
            <Badge colorPalette='blue' p={2}>
              🚧 Construction Sites
            </Badge>
            <Badge colorPalette='green' p={2}>
              🚉 Stations
            </Badge>
            <Badge colorPalette='purple' p={2}>
              🛤️ Track Progress
            </Badge>
            <Badge colorPalette='orange' p={2}>
              🏗️ Major Works
            </Badge>
            <Badge colorPalette='red' p={2}>
              ⚠️ Disruptions
            </Badge>
          </HStack>
        </Box>
      </VStack>
    </Container>
  );
}
