import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PlayerContextType {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [seekTo, setSeekTo] = useState<(time: number) => void>(() => (time: number) => {
    console.log('SeekTo not yet initialized');
  });

  const setSeekToFunction = (fn: (time: number) => void) => {
    setSeekTo(() => fn);
  };

  return (
    <PlayerContext.Provider 
      value={{ 
        playing, 
        setPlaying, 
        progress, 
        setProgress, 
        duration, 
        setDuration,
        seekTo
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

export function useSetSeekTo() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('useSetSeekTo must be used within a PlayerProvider');
  }
  
  return (fn: (time: number) => void) => {
    (context as any).seekTo = fn;
  };
}