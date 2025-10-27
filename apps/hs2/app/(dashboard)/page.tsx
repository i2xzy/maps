import type { Metadata } from 'next';
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
} from '@chakra-ui/react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'HS2 Construction Dashboard - Overview of the High Speed 2 railway project with access to interactive map, media updates, structures database, and route information.',
};

export default async function Home() {
  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Header */}
        <Box textAlign='center'>
          <Heading as='h1' size='2xl' mb={4}>
            HS2 Construction Dashboard
          </Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            High Speed 2 Railway Project Overview
          </Heading>
        </Box>

        {/* Navigation to Features */}
        <Box>
          <Heading as='h3' size='lg' mb={6} textAlign='center'>
            Explore Features
          </Heading>
          <HStack gap={4} justify='center' wrap='wrap'>
            <Link href='/map'>
              <Button colorPalette='blue' size='lg'>
                Interactive Map
              </Button>
            </Link>
            <Link href='/media'>
              <Button colorPalette='green' size='lg'>
                Media Updates
              </Button>
            </Link>
            <Link href='/structures'>
              <Button colorPalette='purple' size='lg'>
                Structures Overview
              </Button>
            </Link>
            <Link href='/route'>
              <Button colorPalette='orange' size='lg'>
                Route Overview
              </Button>
            </Link>
          </HStack>
        </Box>
      </VStack>
    </Container>
  );
}
