import {
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Card,
  SimpleGrid,
  Badge,
  Link as ChakraLink,
  Separator,
  Box,
  Image,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LuExternalLink } from 'react-icons/lu';

import { createClient } from '@supabase/server';
import { snakeCaseToTitleCase } from '@ui/helpers/text-formatting';
import { Breadcrumb } from '@ui/components/breadcrumb';
import { featureTypes } from '@/components/feature/config';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { MediaGallery } from '@/components/media/media-gallery';
import { FeatureStatusBadge } from '@/components/feature/feature-status-badge';

// Helper function to format phase for display
function formatPhase(phase: string): string {
  switch (phase) {
    case 'phase1':
      return 'Phase 1';
    case 'phase2a':
      return 'Phase 2a';
    case 'phase2b':
      return 'Phase 2b';
    default:
      return phase;
  }
}

interface PageProps {
  params: Promise<{ type: string; slug: string[] }>;
}

export default async function StructureDetailPage({ params }: PageProps) {
  const { type, slug } = await params;

  console.log({ type, slug });
  //   get the id from the slug, can be either type/id or type/sub_type/id
  const id = slug[1] || slug[0] || '';
  console.log({ id });
  const subType = slug.length > 1 ? slug[0] : '';
  console.log({ subType });

  const supabase = await createClient();

  // Get the main feature
  const { data: feature } = await supabase
    .from('features')
    .select('*')
    .eq('id', id)
    .single();

  if (!feature) {
    notFound();
  }

  // Fetch related media
  const { data: mediaData } = await supabase
    .from('media_features')
    .select(
      `
      is_cover,
      media (
        id,
        title,
        description,
        url,
        type,
        shot_type,
        youtube_id,
        published_at,
        recorded_date,
        creator_id,
        creators (
          display_name,
          profile_image_url
        )
      )
    `
    )
    .eq('feature_id', id);
  const media =
    mediaData
      ?.filter(item => !item.is_cover)
      .map(item => item.media)
      .filter(
        (item): item is NonNullable<typeof item> & { published_at: string } =>
          !!item && !!item.published_at
      ) || [];

  const coverMedia = mediaData?.filter(item => item.is_cover)[0]?.media;

  // Fetch related groupings
  const { data: groupingsData } = await supabase
    .from('grouping_features')
    .select('groupings (id, name, type, url)')
    .eq('feature_id', id);

  const groupings =
    groupingsData?.map(item => item.groupings).filter(Boolean) || [];
  const plans = groupings.filter(item => item.type === 'plan_sheet');
  const segments = groupings.filter(item => item.type !== 'plan_sheet');

  // For paired structures (like East/West viaducts), get the counterpart
  let pairedFeature = null;
  if (feature.name.includes('East Viaduct')) {
    const pairedName = feature.name.replace('East Viaduct', 'West Viaduct');
    const { data } = await supabase
      .from('features')
      .select('*')
      .eq('name', pairedName)
      .single();
    pairedFeature = data;
  }

  const featureType = featureTypes[feature.type];

  const displayName = feature.name.replace('East Viaduct', 'Viaducts');

  return (
    <Container maxW='6xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Structures', url: '/structures' },
            {
              title: snakeCaseToTitleCase(type),
              url: `/structures/${type}`,
            },
            subType && {
              title: snakeCaseToTitleCase(subType),
              url: `/structures/${type}/${subType}`,
            },
            { title: displayName },
          ].filter(item => !!item)}
        />

        {/* Header */}
        <VStack gap={4} align='start'>
          {coverMedia && (
            <Image
              src={coverMedia.url}
              alt={feature.name}
              width='100%'
              height={500}
              objectFit='cover'
            />
          )}
          <Heading as='h1' size='2xl'>
            {displayName}
          </Heading>

          <HStack gap={4} wrap='wrap'>
            <Badge size='lg'>
              <FeatureIcon feature={feature} />
              {featureType.label}
            </Badge>
            {!pairedFeature && (
              <FeatureStatusBadge status={feature.status} size='md' />
            )}
            <Badge colorPalette='teal' size='md'>
              {formatPhase(feature.phase)}
            </Badge>
          </HStack>
        </VStack>

        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Main Details */}
          <VStack gap={6} align='stretch' gridColumn={{ base: 1, lg: '1 / 3' }}>
            {/* Feature Information */}
            <Card.Root>
              <Card.Header>
                <Heading size='lg'>Feature Details</Heading>
              </Card.Header>
              <Card.Body>
                <VStack gap={4} align='stretch'>
                  <HStack justify='space-between'>
                    <Text fontWeight='medium'>Type:</Text>
                    <Text>{featureType.label}</Text>
                  </HStack>
                  <Separator />
                  <HStack justify='space-between'>
                    <Text fontWeight='medium'>Phase:</Text>
                    <Text>{formatPhase(feature.phase)}</Text>
                  </HStack>
                  {!pairedFeature && (
                    <>
                      <Separator />
                      <HStack justify='space-between'>
                        <Text fontWeight='medium'>Status:</Text>
                        <FeatureStatusBadge status={feature.status} />
                      </HStack>
                    </>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>

            {/* Construction Progress */}
            {pairedFeature && (
              <Card.Root>
                <Card.Header>
                  <Card.Title>Segment Progress</Card.Title>
                </Card.Header>
                <Card.Body>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                    <VStack align='start'>
                      <Text fontWeight='semibold'>{feature.name}</Text>
                      <FeatureStatusBadge status={feature.status} />
                    </VStack>
                    <VStack align='start'>
                      <Text fontWeight='semibold'>{pairedFeature.name}</Text>
                      <FeatureStatusBadge status={pairedFeature.status} />
                    </VStack>
                  </SimpleGrid>
                </Card.Body>
              </Card.Root>
            )}
            {/* Related Media */}
            <MediaGallery media={media} />
          </VStack>

          {/* Sidebar */}

          <VStack gap={6} align='stretch'>
            {/* Mini Map */}
            <Card.Root>
              <Card.Header>
                <Heading size='md'>Location</Heading>
              </Card.Header>
              <Card.Body>
                <Box height='200px' width='100%' borderRadius='md'>
                  <Box
                    height='100%'
                    width='100%'
                    bg='gray.100'
                    borderRadius='md'
                    display='flex'
                    alignItems='center'
                    justifyContent='center'
                  >
                    <VStack gap={2} p={2}>
                      <Heading size='md' color='gray.500'>
                        Interactive Map Coming Soon
                      </Heading>
                    </VStack>
                  </Box>
                </Box>
              </Card.Body>
            </Card.Root>

            {/* Related Plans */}
            {plans.length > 0 && (
              <Card.Root>
                <Card.Header>
                  <Heading size='md'>Plan Sheets</Heading>
                </Card.Header>
                <Card.Body>
                  <VStack gap={3} align='stretch'>
                    {plans.map(plan => (
                      <VStack key={plan.id} gap={1} align='stretch'>
                        <Text fontWeight='medium' fontSize='sm'>
                          {plan.name}
                        </Text>
                        {plan.url && (
                          <ChakraLink
                            href={plan.url}
                            target='_blank'
                            fontSize='xs'
                            color='teal.500'
                          >
                            Open PDF <LuExternalLink />
                          </ChakraLink>
                        )}
                      </VStack>
                    ))}
                  </VStack>
                </Card.Body>
              </Card.Root>
            )}

            {/* Related Segments */}
            {segments.length > 0 && (
              <Card.Root>
                <Card.Header>
                  <Heading size='md'>Parent Segment</Heading>
                </Card.Header>
                <Card.Body>
                  <VStack gap={3} align='stretch'>
                    {segments.map(segment => (
                      <VStack key={segment.id} gap={1} align='stretch'>
                        <Link
                          href={`/structures/${segment.type}s/${segment.id}`}
                        >
                          <Text fontWeight='medium' fontSize='sm'>
                            {segment.name}
                          </Text>
                        </Link>
                      </VStack>
                    ))}
                  </VStack>
                </Card.Body>
              </Card.Root>
            )}
          </VStack>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
