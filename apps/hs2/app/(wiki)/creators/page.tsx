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

  // Get all creators.
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
      url
    `
    )
    .order('display_name', { ascending: true });

  if (!creators) {
    return notFound();
  }

  // Count DISTINCT videos per creator. Sibling rows (one per Google My Maps
  // pin) share a youtube_id, so a plain row count over-counts; dedupe by
  // youtube_id (falling back to row id for pins with no youtube_id).
  // Page through results: a single select is capped at PostgREST's max-rows
  // (1000), which silently undercounts every creator once the total number of
  // video rows exceeds it.
  const videosByCreator = new Map<string, Set<string>>();
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: videoRows } = await supabase
      .from('media')
      .select('id, creator_id, youtube_id')
      .eq('type', 'video')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    for (const row of videoRows ?? []) {
      if (!row.creator_id) continue;
      const key = row.youtube_id || `no-id-${row.id}`;
      const set = videosByCreator.get(row.creator_id) ?? new Set<string>();
      set.add(key);
      videosByCreator.set(row.creator_id, set);
    }

    if (!videoRows || videoRows.length < PAGE_SIZE) break;
  }

  const creatorsWithCounts = creators
    .map(creator => ({
      ...creator,
      mediaCount: videosByCreator.get(creator.id)?.size ?? 0,
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
                          {creator.mediaCount || 0}{' '}
                          {creator.mediaCount === 1 ? 'video' : 'videos'}
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
