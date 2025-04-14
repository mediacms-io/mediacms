import { useState, useRef, useEffect } from 'react';
import { formatTime } from '@/lib/time';
import * as Slider from '@radix-ui/react-slider';
import { Play, Pause, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { usePlayer } from './PlayerContext';

interface TrimRange {
  id: string;
  start: number;
  end: number;
  title: string;
}

interface TrimTimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  playing: boolean;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  onSeek: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  creatingNewSegment?: boolean;
  segments?: TrimRange[];
  activeSegmentId?: string | null;
  isPreviewMode?: boolean;
  currentSegmentIndex?: number;
}

export default function TrimTimeline({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  playing,
  onTrimStartChange,
  onTrimEndChange,
  onSeek,
  onPlay,
  onPause,
  creatingNewSegment = false,
  segments = [],
  activeSegmentId = null,
  isPreviewMode = false,
  currentSegmentIndex = 0
}: TrimTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Update the current time indicator position
  const currentTimePosition = `${(currentTime / duration) * 100}%`;
  const trimStartPosition = `${(trimStart / duration) * 100}%`;
  const trimEndPosition = `${(trimEnd / duration) * 100}%`;
  const selectedRangeWidth = `${((trimEnd - trimStart) / duration) * 100}%`;

  // Calculate time from position
  const calculateTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickPosition / rect.width));
    return percentage * duration;
  };

  // Handle timeline click for seeking and segment selection
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = calculateTimeFromPosition(e.clientX);
    onSeek(time);

    // During segment creation, don't change selection state
    if (creatingNewSegment) {
      console.log("Click ignored - segment creation in progress");
      return;
    }

    // Check if the click is inside any segment
    let clickedSegment = false;
    if (segments) {
      for (const segment of segments) {
        if (time >= segment.start && time <= segment.end) {
          // Click is inside a segment - select it
          if (activeSegmentId !== segment.id) {
            console.log("Timeline click on segment:", segment.id);
            // Manually set active segment through the videoPlayer state
            const event = new CustomEvent('segmentSelected', { detail: { id: segment.id } });
            document.dispatchEvent(event);
          }
          clickedSegment = true;
          break;
        }
      }
    }

    // If clicked outside all segments, clear active segment and selection
    if (!clickedSegment) {
      console.log("Timeline click outside segments - clearing selection");
      const event = new CustomEvent('segmentSelected', { detail: { id: null } });
      document.dispatchEvent(event);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = calculateTimeFromPosition(e.clientX);
    setHoverTime(time);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };


  // Use the global player context
  const { playing: contextPlaying, setPlaying } = usePlayer();
  
  return (
    <div className="relative w-full">
      {/* Main timeline bar */}
      <div 
        ref={timelineRef}
        className="relative h-10 bg-[#ccc] cursor-pointer"
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Vertical cursor that follows mouse movement - always shown when hovering */}
        {hoverTime !== null && (
          <div 
            className="absolute top-0 h-full w-0.5 bg-[#5C4536] z-30" // Updated hover cursor color
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          />
        )}
        {/* Segments visualization */}
        {[...segments]
          .sort((a, b) => a.start - b.start) // Sort segments by start time
          .map((segment, idx) => {
          const leftPos = (segment.start / duration) * 100;
          const width = ((segment.end - segment.start) / duration) * 100;
          // Custom color palette using the provided hex codes
          const colors = [
            'bg-[#5C4536]', // Brown
            'bg-[#D3B965]', // Yellow-gold
            'bg-[#4A7C4C]', // Green
            'bg-[#76A7C5]', // Light Blue
            'bg-[#7E5DAA]', // Purple
            'bg-[#5C4536]', // Brown (repeated for more segments)
            'bg-[#D3B965]', // Yellow-gold (repeated)
            'bg-[#4A7C4C]'  // Green (repeated)
          ];
          const isActive = segment.id === activeSegmentId;

          // Find the original index for the currentSegmentIndex comparison
          const originalIndex = segments.findIndex(s => s.id === segment.id);

          return (
            <div
              key={segment.id}
              className={`absolute h-full ${colors[idx % colors.length]}
                ${isPreviewMode && currentSegmentIndex === originalIndex ? 'opacity-100' : 
                 isActive ? 'opacity-100' : 
                 'opacity-60'} 
                flex items-center justify-center cursor-pointer hover:opacity-100 transition-opacity`}
              style={{ left: `${leftPos}%`, width: `${width}%`, zIndex: 5 }}
              onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling
                // Only allow selecting real segments (not temporary ones)
                if (!segment.id.startsWith("creating-") && segment.id !== "creating" && segment.id !== "initial") {
                  console.log("Timeline click on segment:", segment.id);
                  const event = new CustomEvent('segmentSelected', { 
                    detail: { id: segment.id } 
                  });
                  document.dispatchEvent(event);
                }
              }}
            >
              <span className="text-xs font-medium text-white px-1 truncate">
                {idx + 1} {isActive && "•"}
              </span>
            </div>
          );
        })}

        {/* Selected range indicator */}
        <div 
          className="absolute h-full bg-[#5C4536] opacity-40" // Using first color from palette
          style={{ 
            left: trimStartPosition, 
            width: selectedRangeWidth,
            zIndex: creatingNewSegment ? 8 : 6
          }}
        />
        
        {/* No visible markers for trim start/end positions */}



        {/* Current time indicator - always shown during playback */}
        <div 
          className="absolute top-0 h-full w-0.5 bg-red-500 z-20"
          style={{ left: currentTimePosition }}
        >
        </div>

        {/* Hover Time Display */}
        {hoverTime !== null ? (
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-sm font-medium text-white bg-black bg-opacity-30 px-2 py-1 rounded-md shadow-sm z-30 font-mono"
          >
            {formatTime(hoverTime, true)}
          </div>
        ) : (
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-sm font-medium text-white bg-black bg-opacity-75 px-2 py-1 rounded-md shadow-sm z-30 font-mono"
          >
            {formatTime(currentTime, true)}
          </div>
        )}


        {/* Time markers */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex">
          {[...Array(11)].map((_, idx) => (
            <div key={idx} className="flex-1 border-l border-gray-500 h-full" />
          ))}
        </div>
      </div>

      {/* Timeline control buttons */}
      <div className="flex justify-center mt-3 gap-4">
        <button 
          className={`flex items-center justify-center w-8 h-8 rounded-full text-white transition-colors bg-gray-500 hover:bg-gray-600 ${
            creatingNewSegment ? 'opacity-50 ring-2 ring-yellow-400' : 'hover:ring-2 hover:ring-gray-400'
          }`}
          onClick={() => {
            console.log("Left hand clicked, current time:", currentTime);
            
            // ALWAYS clear selection state when left hand is clicked to force new segment creation
            // This is key to fixing the issue
            const clearEvent = new CustomEvent('segmentSelected', { 
              detail: { id: null } 
            });
            document.dispatchEvent(clearEvent);
            
            // Wait a tiny bit to ensure selection is cleared
            setTimeout(() => {
              if (!creatingNewSegment) {
                // No segment selected, always start a new segment creation
                console.log("Starting new segment creation with left hand");
                // Begin segment creation with current time
                onTrimStartChange(currentTime);
              }
            }, 50);
          }}
          title="Set segment start time (left hand first)"
          disabled={creatingNewSegment} // Disable the left hand when already creating a segment
        >
          <svg viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-current">
            <path d="M135.652 0c23.625 0 43.826 20.65 43.826 44.8v99.851c17.048-16.34 49.766-18.346 70.944 6.299 22.829-14.288 53.017-2.147 62.315 16.45C361.878 158.426 384 189.346 384 240c0 2.746-.203 13.276-.195 16 .168 61.971-31.065 76.894-38.315 123.731C343.683 391.404 333.599 400 321.786 400H150.261l-.001-.002c-18.366-.011-35.889-10.607-43.845-28.464C93.421 342.648 57.377 276.122 29.092 264 10.897 256.203.008 242.616 0 224c-.014-34.222 35.098-57.752 66.908-44.119 8.359 3.583 16.67 8.312 24.918 14.153V44.8c0-23.45 20.543-44.8 43.826-44.8zM136 416h192c13.255 0 24 10.745 24 24v48c0 13.255-10.745 24-24 24H136c-13.255 0-24-10.745-24-24v-48c0-13.255 10.745-24 24-24zm168 28c-11.046 0-20 8.954-20 20s8.954 20 20 20 20-8.954 20-20-8.954-20-20-20z"/>
          </svg>
        </button>

        <button 
          className="flex items-center justify-center w-8 h-8 bg-gray-500 hover:bg-gray-600 rounded-full text-white transition-colors"
          onClick={() => {
            // Toggle playing state using context
            if (contextPlaying) {
              setPlaying(false);
            } else {
              onSeek(currentTime);
              setPlaying(true);
            }
          }}
          title={contextPlaying ? "Pause playback" : "Play from current position"}
        >
          {contextPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>

        <button 
          className={`flex items-center justify-center w-8 h-8 rounded-full text-white transition-colors bg-gray-500 hover:bg-gray-600 hover:ring-2 hover:ring-gray-400 ${
            creatingNewSegment ? 'ring-2 ring-yellow-400' : ''
          }`}
          onClick={() => {
            console.log("Right hand clicked, current time:", currentTime);
            if (creatingNewSegment) {
              // Complete segment creation with end point
              onTrimEndChange(currentTime);
            } else {
              // If we have a selected segment, update its end time
              if (activeSegmentId) {
                console.log("Right hand used outside segment creation mode - adjusting segment end time");
                // Use a custom event to notify VideoPlayer component
                const event = new CustomEvent('updateSegmentEnd', { 
                  detail: { id: activeSegmentId, newEnd: currentTime } 
                });
                document.dispatchEvent(event);
              } else {
                console.log("No conditions met for right hand click");
              }
            }
          }}
          title={creatingNewSegment ? "Set segment end time (right hand second)" : "Update selected segment end time"}
        >
          <svg viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-current">
            <path d="M135.652 0c23.625 0 43.826 20.65 43.826 44.8v99.851c17.048-16.34 49.766-18.346 70.944 6.299 22.829-14.288 53.017-2.147 62.315 16.45C361.878 158.426 384 189.346 384 240c0 2.746-.203 13.276-.195 16 .168 61.971-31.065 76.894-38.315 123.731C343.683 391.404 333.599 400 321.786 400H150.261l-.001-.002c-18.366-.011-35.889-10.607-43.845-28.464C93.421 342.648 57.377 276.122 29.092 264 10.897 256.203.008 242.616 0 224c-.014-34.222 35.098-57.752 66.908-44.119 8.359 3.583 16.67 8.312 24.918 14.153V44.8c0-23.45 20.543-44.8 43.826-44.8zM136 416h192c13.255 0 24 10.745 24 24v48c0 13.255-10.745 24-24 24H136c-13.255 0-24-10.745-24-24v-48c0-13.255 10.745-24 24-24zm168 28c-11.046 0-20 8.954-20 20s8.954 20 20 20 20-8.954 20-20-8.954-20-20-20z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}