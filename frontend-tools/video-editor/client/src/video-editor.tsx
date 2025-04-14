import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from "@/components/theme-provider";
import { CustomTabs, TabsList, TabsTrigger, TabsContent } from "@/components/CustomTabs";
import { Card, CardContent } from "@/components/basic/Card";
import VideoPlayer from "@/components/video-player/VideoPlayer";
import ChapterManager from "@/components/video-player/ChapterManager";
import { PlayerProvider } from "@/components/video-player/PlayerContext";
import "./index.css";

function VideoEditor() {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <div className="w-full">
          <CustomTabs defaultValue="trim">
            <TabsList>
              <TabsTrigger value="trim">Trim Video</TabsTrigger>
              <TabsTrigger value="chapters">Chapters</TabsTrigger>
            </TabsList>

            <TabsContent value="trim">
              <Card>
                <CardContent>
                  <VideoPlayer />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chapters">
              <Card>
                <CardContent>
                  <ChapterManager />
                </CardContent>
              </Card>
            </TabsContent>
          </CustomTabs>
        </div>
      </PlayerProvider>
    </ThemeProvider>
  );
}

// Mount the app when the DOM is ready
const mount = () => {
  const container = document.getElementById('video-editor-root');
  if (container) {
    const root = createRoot(container);
    root.render(<VideoEditor />);
  }
};

// Handle both cases: immediate mounting or waiting for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
} 