'use client';

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from 'react';

/**
 * Shares one video player instance between the player surface (left column)
 * and the chapter list (right sidebar) so chapter buttons can seek the player
 * even though they render in a different part of the layout.
 */
type VideoPlayerContextValue = {
  playerRef: RefObject<HTMLVideoElement | null>;
  seekTo: (seconds: number) => void;
};

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = seconds;
      playerRef.current.play();
    }
  }, []);

  return (
    <VideoPlayerContext.Provider value={{ playerRef, seekTo }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer(): VideoPlayerContextValue {
  const value = useContext(VideoPlayerContext);
  if (!value) {
    throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  }
  return value;
}
