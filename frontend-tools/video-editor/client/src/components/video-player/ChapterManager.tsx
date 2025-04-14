import { useState, useRef } from "react";
import ReactPlayer from "react-player";
import { Card, CardContent } from "@/components/basic/Card";
import { Button } from "@/components/basic/Button";
import { Input } from "@/components/basic/Input";
import { formatTime } from "@/lib/time";
import { Play, Pause, Plus, Trash2 } from "lucide-react";

interface Chapter {
  id: string;
  title: string;
  timestamp: number;
}


// Add type definition for window
declare global {
  interface Window {
    MEDIA_DATA: {
      videoUrl: string;
      chapters?: Chapter[];
    }
  }
}
console.log("MEDIA_DATA", window.MEDIA_DATA);

export default function ChapterManager() {
  const sampleVideoUrl = window.MEDIA_DATA?.videoUrl || "http://temp.web357.com/SampleVideo_1280x720_30mb.mp4";
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>(window.MEDIA_DATA?.chapters || [
        {
          id: "ajc9CJ",
          title: "Introduction",
          timestamp: 0
        },
        {
          id: "451a",
          title: "Main Content",
          timestamp: 12.235
        },
        {
          id: "789b",
          title: "Conclusion",
          timestamp: 21.135
        },
        {
          id: "123d",
          title: "Chapter 4",
          timestamp: 37.000
        },
        {
          id: "456e",
          title: "Chapter 5",
          timestamp: 55.000
        },
        {
          id: "789g",
          title: "Chapter 6",
          timestamp: 60.000
        },
        {
          id: "123h",
          title: "Chapter 7",
          timestamp: 75.000
        },
        {
          id: "456i",           
          title: "Chapter 8",
          timestamp: 90.000
        },
        {
          id: "789j",
          title: "Chapter 9",
          timestamp: 105.000
        },
        {
          id: "123k",
          title: "Chapter 10",
          timestamp: 120.000
        }
      ]);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  const playerRef = useRef<ReactPlayer>(null);

  const handleProgress = (state: { playedSeconds: number }) => {
    setProgress(state.playedSeconds);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

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
    if (playerRef.current) {
      playerRef.current.seekTo(timestamp);
      setPlaying(true);
    }
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
          ref={playerRef}
          url={sampleVideoUrl}
          width="100%"
          height="100%"
          playing={playing}
          onProgress={handleProgress}
          onDuration={handleDuration}
          controls={true}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setPlaying(!playing)}>
            {playing ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <div className="text-sm text-gray-600">
            Current Time: {formatTime(progress)}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter chapter title"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            className="flex-1"
          />
          <Button onClick={addChapter}>
            <Plus className="h-4 w-4 mr-2" />
            Add Chapter
          </Button>
        </div>

        {chapters.length > 0 && (
          <Card className="p-4">
            <h3 className="font-medium mb-4">Chapters</h3>
            <div className="space-y-3">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {formatTime(chapter.timestamp, true)}
                    </span>
                    <span className="text-sm">{chapter.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewChapter(chapter.timestamp)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
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
                className="w-full"
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
