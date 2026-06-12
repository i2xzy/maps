import type { Metadata } from 'next';
import {
  Container,
  Stack,
  Heading,
  SimpleGrid,
  Card,
  VStack,
  Avatar,
  Text,
  Link as ChakraLink,
  LinkOverlay,
  LinkBox,
} from '@chakra-ui/react';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';
import { getInitials } from '@ui/helpers/text-formatting';

export const metadata: Metadata = {
  title: 'Content Creators',
  description:
    'Discover YouTube channels and content creators documenting HS2 construction. Browse creators, watch their videos, and follow their coverage of the High Speed 2 railway project.',
};

export default async function CreatorsPage() {
  const supabase = await createClient();

  // Creators with their distinct video count, in one query via the
  // creators_with_video_counts view (see
  // packages/supabase/sql/creators_with_video_counts.sql). The view counts in a
  // single aggregate — no PostgREST 1000-row fetch cap, no bulk row transfer —
  // and we sort server-side (most videos first, then by name).
  const { data: rows } = await supabase
    .from('creators_with_video_counts')
    .select(
      'id, display_name, external_id, platform, profile_image_url, bio, url, video_count'
    )
    .order('video_count', { ascending: false })
    .order('display_name', { ascending: true });

  if (!rows) {
    return notFound();
  }

  // View columns are nullable in the generated types; every row is backed by a
  // real creator, so default the fields the cards rely on to non-null values.
  const creatorsWithCounts = rows.map(c => ({
    ...c,
    id: c.id ?? '',
    display_name: c.display_name ?? '',
    external_id: c.external_id ?? '',
    url: c.url ?? '',
    video_count: c.video_count ?? 0,
  }));

  return (
    <Container maxW='8xl' py={8}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading size='2xl'>Content Creators</Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Explore videos from {creatorsWithCounts.length} YouTube channels
            covering HS2 construction progress
          </Heading>
        </Stack>

        {creatorsWithCounts.length > 0 ? (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={6}>
            {creatorsWithCounts.map(creator => (
              <Card.Root key={creator.id} h='100%'>
                <Card.Body>
                  <LinkBox as='article'>
                    <VStack gap={4}>
                      <Avatar.Root size='2xl'>
                        <Avatar.Fallback name={creator.display_name}>
                          {getInitials(creator.display_name)}
                        </Avatar.Fallback>
                        {creator.profile_image_url && (
                          <Avatar.Image src={creator.profile_image_url} />
                        )}
                      </Avatar.Root>
                      <VStack gap={1}>
                        <LinkOverlay href={`/creators/${creator.id}`}>
                          <Text
                            fontWeight='bold'
                            fontSize='lg'
                            textAlign='center'
                            lineClamp={2}
                          >
                            {creator.display_name}
                          </Text>
                        </LinkOverlay>
                        <ChakraLink href={creator.url} target='_blank'>
                          <Text fontSize='sm' color='fg.muted'>
                            @{creator.external_id}
                          </Text>
                        </ChakraLink>
                        <Text fontSize='sm' fontWeight='medium'>
                          {creator.video_count}{' '}
                          {creator.video_count === 1 ? 'video' : 'videos'}
                        </Text>
                      </VStack>
                    </VStack>
                  </LinkBox>
                </Card.Body>
              </Card.Root>
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
