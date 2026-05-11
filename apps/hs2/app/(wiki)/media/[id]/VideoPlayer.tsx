'use client';

import { useRef } from 'react';
import ReactPlayer from 'react-player';
import { Button, AspectRatio, Stack, HStack } from '@chakra-ui/react';

type VideoPlayerProps = {
  src: string;
  chapters?: {
    title: string;
    seconds: number;
  }[];
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
      <HStack gap={2}>
        {chapters?.map(chapter => (
          <Button
            key={chapter.seconds}
            onClick={() => handleSeekChange(chapter.seconds)}
            variant='ghost'
            size='sm'
          >
            {chapter.title}
          </Button>
        ))}
      </HStack>
    </Stack>
  );
};

export default VideoPlayer;
