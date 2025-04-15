import { Card, CardContent } from "@/components/basic/Card";
import VideoPlayer from "@/components/video-player/VideoPlayer";
import ChapterManager from "@/components/video-player/ChapterManager";
import { CustomTabs, TabsList, TabsTrigger, TabsContent } from "@/components/CustomTabs";
import { PlayerProvider } from "@/components/video-player/PlayerContext";

export default function Home() {
  return (
    <div className="min-h-screen w-full p-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Video Trimmer</h1>
        <PlayerProvider>
          <CustomTabs defaultValue="trim">
            <TabsList>
              <TabsTrigger value="trim">Trim the Video</TabsTrigger>
              <TabsTrigger value="chapters">Manage Chapters</TabsTrigger>
            </TabsList>

            <TabsContent value="trim">
              <Card>
                <CardContent className="mt-4">
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
        </PlayerProvider>
      </div>
    </div>
  );
}