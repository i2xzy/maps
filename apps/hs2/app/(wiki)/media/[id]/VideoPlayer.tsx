'use client';

import { useRef } from 'react';
import ReactPlayer from 'react-player';
import {
  Button,
  AspectRatio,
  Stack,
  HStack,
  VStack,
  Text,
} from '@chakra-ui/react';

import { formatTimestamp, type Chapter } from '@/utils/media-grouping';

type VideoPlayerProps = {
  src: string;
  chapters?: Chapter[];
};

const VideoPlayer = ({ src, chapters }: VideoPlayerProps) => {
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const handleSeekChange = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = seconds;
      playerRef.current.play();
    }
  };

  return (
    <Stack gap={4} w='full'>
      <AspectRatio ratio={16 / 9} w='full'>
        <ReactPlayer
          ref={playerRef}
          src={src}
          controls
          width='100%'
          height='100%'
        />
      </AspectRatio>
      {chapters && chapters.length > 0 && (
        <VStack gap={2} align='stretch' w='full'>
          {chapters.map((chapter, i) => (
            <HStack key={`${chapter.seconds}-${i}`} gap={3} align='start'>
              <Button
                onClick={() => handleSeekChange(chapter.seconds)}
                variant='outline'
                size='sm'
                flexShrink={0}
              >
                {formatTimestamp(chapter.seconds)}
              </Button>
              <VStack gap={0} align='start'>
                <Text fontWeight='medium' fontSize='sm'>
                  {chapter.label}
                </Text>
                {chapter.date && (
                  <Text fontSize='xs' color='fg.muted'>
                    {chapter.date}
                  </Text>
                )}
              </VStack>
            </HStack>
          ))}
        </VStack>
      )}
    </Stack>
  );
};

export default VideoPlayer;
