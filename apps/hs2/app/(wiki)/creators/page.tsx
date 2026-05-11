import type { Metadata } from 'next';
import { Container, Stack, Heading, SimpleGrid } from '@chakra-ui/react';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';
import CreatorCard from './CreatorCard';

export const metadata: Metadata = {
  title: 'Content Creators',
  description:
    'Discover YouTube channels and content creators documenting HS2 construction. Browse creators, watch their videos, and follow their coverage of the High Speed 2 railway project.',
};

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
              <CreatorCard key={creator.id} creator={creator} />
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
