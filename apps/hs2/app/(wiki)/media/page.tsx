import { Container, Stack, Heading } from '@chakra-ui/react';

import { createClient } from '@supabase/server';
import { MediaGallery } from '@/components/media/media-gallery';

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

        {media && media.length > 0 ? (
          <MediaGallery media={media} title='Videos' isPage />
        ) : (
          <Heading size='md' color='fg.muted'>
            No updates yet.
          </Heading>
        )}
      </Stack>
    </Container>
  );
}
