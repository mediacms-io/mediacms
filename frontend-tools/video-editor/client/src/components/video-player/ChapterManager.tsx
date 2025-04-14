import { useState } from "react";
import ReactPlayer from "react-player";
import { Card, CardContent } from "@/components/basic/Card";
import { Button } from "@/components/basic/Button";
import { Input } from "@/components/basic/Input";
import { formatTime } from "@/lib/time";
import { Play, Pause, Plus, Trash2 } from "lucide-react";
import { usePlayer } from "./PlayerContext";

interface Chapter {
  id: string;
  title: string;
  timestamp: number;
}

export default function ChapterManager() {
  const sampleVideoUrl = window.MEDIA_DATA?.videoUrl || "http://temp.web357.com/SampleVideo_1280x720_30mb.mp4";
  
  // Use the shared player context
  const { playing, setPlaying, progress, setProgress, duration, setDuration } = usePlayer();
  const [chapters, setChapters] = useState<Chapter[]>(window.MEDIA_DATA?.chapters || []);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  const addChapter = () => {
    if (!newChapterTitle.trim()) {
      alert("Please enter a chapter title");
      return;
    }

    const newChapter: Chapter = {
      id: Math.random().toString(36).substring(7),
      title: newChapterTitle,
      timestamp: progress,
    };

    // Sort chapters by timestamp
    const updatedChapters = [...chapters, newChapter].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    setChapters(updatedChapters);
    setNewChapterTitle("");
  };

  const removeChapter = (id: string) => {
    setChapters(chapters.filter((chapter) => chapter.id !== id));
  };

  const previewChapter = (timestamp: number) => {
    // Use the global seekTo function that's exposed on the window
    if ((window as any).seekToFunction) {
      (window as any).seekToFunction(timestamp);
    } else {
      // Fallback if the function isn't available yet
      console.log("SeekTo function not yet initialized");
    }
    setPlaying(true);
  };

  const handleSubmitChapters = () => {
    alert(
      `Preparing to submit chapters to backend:\n${JSON.stringify(chapters, null, 2)}`,
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <ReactPlayer
          url={sampleVideoUrl}
          width="100%"
          height="100%"
          playing={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onProgress={(state) => setProgress(state.playedSeconds)}
          onDuration={(d) => setDuration(d)}
          controls={true}
        />
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setPlaying(!playing)}
            className="bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900"
          >
            {playing ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <div className="text-sm text-amber-800 font-medium">
            Current Time: {formatTime(progress).split('.')[0]}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter chapter title"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            className="flex-1 border-amber-300 focus-visible:ring-amber-500"
          />
          <Button 
            onClick={addChapter}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chapter
          </Button>
        </div>

        {chapters.length > 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <h3 className="font-medium mb-4 text-amber-900">Chapters</h3>
            <div className="space-y-3">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between p-2 bg-amber-100 border border-amber-200 rounded"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-amber-900">
                      {formatTime(chapter.timestamp).split('.')[0]}
                    </span>
                    <span className="text-sm text-amber-900">{chapter.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900"
                      onClick={() => previewChapter(chapter.timestamp)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-red-100 hover:bg-red-200 border-red-300 text-red-900"
                      onClick={() => removeChapter(chapter.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="default"
                onClick={handleSubmitChapters}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Submit Chapters
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
