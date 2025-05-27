import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Button,
  VStack,
  HStack,
  Text,
  Card,
} from '@chakra-ui/react';
import Link from 'next/link';
import { createClient } from '@supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.from('features').select();

  console.log(data);

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

        {/* Top Level Stats */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6}>
          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Total Length
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                330 miles
              </Text>
              <Text fontSize='sm' color='gray.500'>
                London to Birmingham & beyond
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Construction Progress
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                65%
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Phase 1 completion
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Active Sites
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                350+
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Across the route
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Text fontSize='sm' color='gray.600' mb={1}>
                Investment
              </Text>
              <Text fontSize='3xl' fontWeight='bold' mb={1}>
                £106bn
              </Text>
              <Text fontSize='sm' color='gray.500'>
                Total project cost
              </Text>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

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
            <Link href='/news'>
              <Button colorPalette='green' size='lg'>
                Latest News
              </Button>
            </Link>
            <Link href='/progress'>
              <Button colorPalette='purple' size='lg'>
                Construction Progress
              </Button>
            </Link>
            <Link href='/stations'>
              <Button colorPalette='orange' size='lg'>
                Stations & Routes
              </Button>
            </Link>
          </HStack>
        </Box>
      </VStack>
    </Container>
  );
}
