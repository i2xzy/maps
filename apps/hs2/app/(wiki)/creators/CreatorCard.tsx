import {
  Card,
  VStack,
  Avatar,
  Text,
  LinkBox,
  Link as ChakraLink,
  LinkOverlay,
} from '@chakra-ui/react';
import Link from 'next/link';

interface Creator {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  external_id: string;
  url: string;
  mediaCount: number;
}

const colorPalettes = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const CreatorCard = ({ creator }: { creator: Creator }) => {
  return (
    <Card.Root key={creator.id} h='100%'>
      <Card.Body>
        <LinkBox as='article'>
          <VStack gap={4}>
            <Avatar.Root
              size='2xl'
              colorPalette={
                colorPalettes[creator.external_id.length % colorPalettes.length]
              }
            >
              <Avatar.Fallback name={creator.external_id} />
              {creator.profile_image_url && (
                <Avatar.Image src={creator.profile_image_url} />
              )}
            </Avatar.Root>
            <VStack gap={1}>
              <LinkOverlay asChild>
                <Link href={`/creators/${creator.id}`}>
                  <Text
                    fontWeight='bold'
                    fontSize='lg'
                    textAlign='center'
                    lineClamp={2}
                  >
                    {creator.display_name}
                  </Text>
                </Link>
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
  );
};

export default CreatorCard;
