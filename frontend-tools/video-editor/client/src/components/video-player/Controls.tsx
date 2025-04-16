import { Button } from "@/components/basic/Button";
import { Play, Pause } from "lucide-react";
import { formatTime } from "@/lib/time";

interface ControlsProps {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  currentTime: number;
  duration: number;
}

export default function Controls({
  playing,
  setPlaying,
  currentTime,
  duration,
}: ControlsProps) {
  return (
    <div className="flex items-center space-x-4">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setPlaying(!playing)}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="text-sm">
        {formatTime(currentTime, true)} / {formatTime(duration, true)}
      </div>
    </div>
  );
}