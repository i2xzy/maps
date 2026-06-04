import type { Metadata } from 'next';
import { Container, Stack, Heading } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { MediaGallery } from '@/components/media/media-gallery';
import { groupVideosByYoutubeId } from '@/utils/media-grouping';

export const metadata: Metadata = {
  title: 'News Feed',
  description:
    'Latest HS2 construction updates with videos and photos from YouTube creators and official sources. Stay updated with drone footage, time-lapses, and ground-level documentation of the project.',
};

export default async function MediaHomePage() {
  const supabase = await createClient();

  // Get all media items with creators, sorted by date (newest first)
  const { data: media } = await supabase
    .from('media')
    .select(
      `
      id,
      title,
      description,
      url,
      type,
      shot_type,
      youtube_id,
      published_at,
      recorded_date,
      creators (
        id,
        display_name,
        profile_image_url
      )
    `
    )
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

  // One video is stored as several rows (one per Google My Maps pin). Collapse
  // them to a single feed entry per youtube_id so a video appears once.
  const feed = media ? groupVideosByYoutubeId(media) : [];

  return (
    <Container maxW='8xl' py={8}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading size='2xl'>News Feed</Heading>
          <Heading as='h2' size='lg' color='gray.600' fontWeight='normal'>
            Stay updated with the latest videos about the project from HS2 Ltd
            as well as many other YouTube channels.
          </Heading>
        </Stack>

        {feed.length > 0 ? (
          <MediaGallery
            media={feed}
            title='Videos'
            isPage
            defaultSort='published'
          />
        ) : (
          <Heading size='md' color='fg.muted'>
            No updates yet.
          </Heading>
        )}
      </Stack>
    </Container>
  );
}
