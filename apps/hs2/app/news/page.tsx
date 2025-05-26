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

// Mock news data - in a real app this would come from an API
const newsItems = [
  {
    id: 1,
    title: 'HS2 Phase 1 Construction Reaches 65% Completion',
    summary:
      'Major milestone achieved as construction teams complete key sections between London and Birmingham.',
    date: '2024-01-15',
    category: 'Construction',
    priority: 'high',
  },
  {
    id: 2,
    title: 'New Interchange Station Design Unveiled',
    summary:
      'Innovative design for Birmingham Interchange station promises seamless connectivity.',
    date: '2024-01-12',
    category: 'Design',
    priority: 'medium',
  },
  {
    id: 3,
    title: 'Environmental Milestone: 1 Million Trees Planted',
    summary: 'HS2 reaches significant environmental target ahead of schedule.',
    date: '2024-01-10',
    category: 'Environment',
    priority: 'medium',
  },
  {
    id: 4,
    title: 'Tunnel Boring Machine Completes London Section',
    summary:
      'Florence, the tunnel boring machine, successfully completes the challenging London underground section.',
    date: '2024-01-08',
    category: 'Construction',
    priority: 'high',
  },
  {
    id: 5,
    title: 'Local Community Benefits Programme Expands',
    summary:
      'New initiatives launched to support communities along the HS2 route.',
    date: '2024-01-05',
    category: 'Community',
    priority: 'low',
  },
];

export default function NewsPage() {
  return (
    <Container maxW='7xl' py={8}>
      <VStack gap={6} align='stretch'>
        {/* Header */}
        <HStack justify='space-between' align='center'>
          <Box>
            <Heading as='h1' size='xl' mb={2}>
              Latest HS2 News
            </Heading>
            <Text color='gray.600'>
              Stay updated with the latest developments and milestones
            </Text>
          </Box>
          <Link href='/'>
            <Button variant='outline'>← Back to Dashboard</Button>
          </Link>
        </HStack>

        {/* News Grid */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          {newsItems.map(item => (
            <Box
              key={item.id}
              borderWidth='1px'
              borderRadius='lg'
              p={6}
              _hover={{ shadow: 'md' }}
            >
              <VStack align='stretch' gap={3}>
                <HStack justify='space-between' align='start'>
                  <Badge
                    colorPalette={
                      item.category === 'Construction'
                        ? 'blue'
                        : item.category === 'Design'
                          ? 'purple'
                          : item.category === 'Environment'
                            ? 'green'
                            : item.category === 'Community'
                              ? 'orange'
                              : 'gray'
                    }
                  >
                    {item.category}
                  </Badge>
                  <Badge
                    variant='outline'
                    colorPalette={
                      item.priority === 'high'
                        ? 'red'
                        : item.priority === 'medium'
                          ? 'yellow'
                          : 'gray'
                    }
                  >
                    {item.priority} priority
                  </Badge>
                </HStack>

                <Heading as='h3' size='md'>
                  {item.title}
                </Heading>

                <Text color='gray.600' fontSize='sm'>
                  {item.summary}
                </Text>

                <Separator />

                <HStack justify='space-between' align='center'>
                  <Text fontSize='sm' color='gray.500'>
                    {new Date(item.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Button size='sm' variant='ghost' colorPalette='blue'>
                    Read More →
                  </Button>
                </HStack>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>

        {/* Load More */}
        <Box textAlign='center' pt={4}>
          <Button colorPalette='blue' variant='outline'>
            Load More News
          </Button>
        </Box>
      </VStack>
    </Container>
  );
}
