import {
  Container,
  Stack,
  Heading,
  SimpleGrid,
  Card,
  VStack,
  Avatar,
  Text,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';

export default async function CreatorsPage() {
  const supabase = await createClient();

  // Get all creators with their media count
  const { data: creators } = await supabase
    .from('creators')
    .select(
      `
      id,
      display_name,
      external_id,
      platform,
      profile_image_url,
      bio,
      url,
      media (count)
    `
    )
    .eq('media.type', 'video')
    .order('display_name', { ascending: true });

  if (!creators) {
    return notFound();
  }

  const creatorsWithCounts = creators
    .map(creator => ({
      ...creator,
      mediaCount: creator.media[0]?.count || 0,
    }))
    .sort((a, b) => b.mediaCount - a.mediaCount);

  return (
    <Container maxW='8xl' py={8}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading size='2xl'>Content Creators</Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Explore videos from {creators.length} YouTube channels covering HS2
            construction progress
          </Heading>
        </Stack>

        {creators.length > 0 ? (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={6}>
            {creatorsWithCounts.map(creator => (
              <Link key={creator.id} href={`/creators/${creator.id}`}>
                <Card.Root h='100%' _hover={{ borderColor: 'blue.400' }}>
                  <Card.Body>
                    <VStack gap={4}>
                      <Avatar.Root size='2xl'>
                        <Avatar.Fallback name={creator.display_name} />
                        {creator.profile_image_url && (
                          <Avatar.Image src={creator.profile_image_url} />
                        )}
                      </Avatar.Root>
                      <VStack gap={1}>
                        <Text
                          fontWeight='bold'
                          fontSize='lg'
                          textAlign='center'
                          lineClamp={2}
                        >
                          {creator.display_name}
                        </Text>
                        <Text fontSize='sm' color='fg.muted'>
                          @{creator.external_id}
                        </Text>
                        <Text
                          fontSize='sm'
                          color='blue.400'
                          fontWeight='medium'
                        >
                          {creator.mediaCount || 0}{' '}
                          {creator.mediaCount === 1 ? 'video' : 'videos'}
                        </Text>
                      </VStack>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </Link>
            ))}
          </SimpleGrid>
        ) : (
          <Heading size='md' color='fg.muted'>
            No creators yet.
          </Heading>
        )}
      </Stack>
    </Container>
  );
}
