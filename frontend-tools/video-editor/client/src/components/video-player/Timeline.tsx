import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/time";

interface TimelineProps {
  duration: number;
  progress: number;
  startTime: number;
  endTime: number;
  onChange: (start: number, end: number) => void;
}

export default function Timeline({
  duration,
  progress,
  startTime,
  endTime,
  onChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);

  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100;
  };

  const getTimeFromPosition = (position: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const percent = Math.max(0, Math.min(100, position / rect.width * 100));
    return (percent / 100) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent, handle: "start" | "end") => {
    setIsDragging(handle);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = getTimeFromPosition(x);

    if (isDragging === "start") {
      onChange(Math.min(newTime, endTime - 1), endTime);
    } else {
      onChange(startTime, Math.max(newTime, startTime + 1));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="space-y-2">
      <div
        ref={timelineRef}
        className="relative h-8 bg-gray-200 rounded cursor-pointer"
      >
        {/* Progress bar */}
        <div
          className="absolute h-full bg-gray-300"
          style={{ width: `${getPositionFromTime(progress)}%` }}
        />

        {/* Selection area */}
        <div
          className="absolute h-full bg-primary/20"
          style={{
            left: `${getPositionFromTime(startTime)}%`,
            width: `${getPositionFromTime(endTime - startTime)}%`,
          }}
        />

        {/* Start handle */}
        <div
          className="absolute top-0 w-2 h-full bg-primary cursor-ew-resize"
          style={{ left: `${getPositionFromTime(startTime)}%` }}
          onMouseDown={(e) => handleMouseDown(e, "start")}
        />

        {/* End handle */}
        <div
          className="absolute top-0 w-2 h-full bg-primary cursor-ew-resize"
          style={{ left: `${getPositionFromTime(endTime)}%` }}
          onMouseDown={(e) => handleMouseDown(e, "end")}
        />
      </div>

      <div className="flex justify-between text-sm text-gray-500">
        <span>{formatTime(0, true)}</span>
        <span>{formatTime(duration, true)}</span>
      </div>
    </div>
  );
}
