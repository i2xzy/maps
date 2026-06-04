'use client';

import ReactPlayer from 'react-player';
import { AspectRatio } from '@chakra-ui/react';

import { useVideoPlayer } from './video-player-context';

type VideoPlayerProps = {
  src: string;
};

const VideoPlayer = ({ src }: VideoPlayerProps) => {
  const { playerRef } = useVideoPlayer();

  return (
    <AspectRatio ratio={16 / 9} w='full'>
      <ReactPlayer
        ref={playerRef}
        src={src}
        controls
        width='100%'
        height='100%'
      />
    </AspectRatio>
  );
};

export default VideoPlayer;
