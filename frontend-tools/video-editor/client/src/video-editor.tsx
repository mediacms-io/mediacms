import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from "@/components/theme-provider";
import VideoPlayer from "@/components/video-player/VideoPlayer";
import ChapterManager from "@/components/video-player/ChapterManager";
import { PlayerProvider } from "@/components/video-player/PlayerContext";
import "./index.css";

// Component for the trim functionality
function TrimEditor() {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <VideoPlayer />
      </PlayerProvider>
    </ThemeProvider>
  );
}

// Component for the chapters functionality
function ChaptersEditor() {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <ChapterManager />
      </PlayerProvider>
    </ThemeProvider>
  );
}

// Mount the components when the DOM is ready
const mountComponents = () => {
  // Mount the trim editor
  const trimContainer = document.getElementById('video-editor-trim-root');
  if (trimContainer) {
    const trimRoot = createRoot(trimContainer);
    trimRoot.render(<TrimEditor />);
  }

  // Mount the chapters editor
  const chaptersContainer = document.getElementById('video-editor-chapters-root');
  if (chaptersContainer) {
    const chaptersRoot = createRoot(chaptersContainer);
    chaptersRoot.render(<ChaptersEditor />);
  }
};

// Handle both cases: immediate mounting or waiting for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountComponents);
} else {
  mountComponents();
}