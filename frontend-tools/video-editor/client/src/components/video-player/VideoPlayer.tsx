import { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";
import { Button } from "@/components/basic/Button";
import { formatTime } from "@/lib/time";
import { Play, Pause, Trash2, Scissors, ExternalLink, Film } from "lucide-react";
import * as ScrollArea from '@radix-ui/react-scroll-area';
import TrimTimeline from './TrimTimeline';
import { usePlayer } from "./PlayerContext";

interface TrimRange {
  id: string;
  start: number;
  end: number;
  title: string; // Will be kept for backwards compatibility but no longer editable
}

function calculateDuration(start: number, end: number): string {
  const duration = end - start;
  return formatTime(duration);
}

function calculateFrames(duration: number): number {
  // Assuming 30fps for demonstration
  return Math.round(duration * 30);
}

export default function VideoPlayer() {
  const sampleVideoUrl = window.MEDIA_DATA?.videoUrl || "http://temp.web357.com/SampleVideo_1280x720_30mb.mp4";
  
  // Use the shared player context instead of local state
  const { playing, setPlaying, progress, setProgress, duration, setDuration, seekTo: contextSeekTo } = usePlayer();
  const [currentRange, setCurrentRange] = useState<[number, number]>([0, 0]);
  // We'll initialize with an empty array and add a full-video segment when duration is known
  const [trimRanges, setTrimRanges] = useState<TrimRange[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [editingStartTime, setEditingStartTime] = useState<{id: string, value: string} | null>(null);
  const [editingEndTime, setEditingEndTime] = useState<{id: string, value: string} | null>(null);

  // Track if we're in the middle of creating a new segment
  const [creatingNewSegment, setCreatingNewSegment] = useState(false);
  // Temporary storage for the new segment's start time
  const [newSegmentStartTime, setNewSegmentStartTime] = useState(0);
  const [editingTitle, setEditingTitle] = useState<{id: string, value: string} | null>(null);
  // Track which segment is currently active (cursor is inside it or selected)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  // Track if a segment is currently selected (different from hover)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  // Track the lastCreatedSegment end time
  const [lastSegmentEnd, setLastSegmentEnd] = useState<number | null>(null);

  const playerRef = useRef<ReactPlayer>(null);

  // Force UI update when play state changes
  useEffect(() => {
    console.log("Play state changed:", playing);
  }, [playing]);

  // Function to check if the current playhead is inside a segment
  const findActiveSegment = (currentTime: number): string | null => {
    // Don't change active segment during segment creation
    if (creatingNewSegment) return null;

    for (const range of trimRanges) {
      if (currentTime >= range.start && currentTime <= range.end) {
        return range.id;
      }
    }
    return null;
  };

  // Handle mouse moving over the timeline
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (creatingNewSegment) return;

    // Get timeline element position
    const timelineRect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - timelineRect.left;
    const percent = relativeX / timelineRect.width;
    const currentTime = percent * duration;

    // Find which segment this time falls into
    const hoveredSegmentId = findActiveSegment(currentTime);
    if (hoveredSegmentId !== activeSegmentId) {
      // Only update active segment if no segment is currently selected
      // or if we're hovering over the selected segment
      if (!selectedSegmentId || hoveredSegmentId === selectedSegmentId) {
        setActiveSegmentId(hoveredSegmentId);
      }
    }
  };

  // Clear active segment when mouse leaves the timeline
  const handleMouseLeave = () => {
    if (!creatingNewSegment) {
      // Only clear active segment if no segment is selected
      if (!selectedSegmentId) {
        setActiveSegmentId(null);
      } else {
        // If a segment is selected, set that as the active segment
        setActiveSegmentId(selectedSegmentId);
      }
    }
  };

  // Add event listeners for segment selection and updates
  useEffect(() => {
    const handleSegmentSelected = (e: CustomEvent) => {
      const segmentId = e.detail.id;
      console.log("Segment selected:", segmentId);
      
      // Never change selection during segment creation
      if (creatingNewSegment) {
        console.log("Ignoring selection change during segment creation");
        return;
      }
      
      // If segmentId is null, clear selection
      if (segmentId === null) {
        console.log("Clearing segment selection completely");
        setSelectedSegmentId(null);
        setActiveSegmentId(null);
        // Reset any current range to avoid confusion
        setCurrentRange([progress, progress]);
      } else {
        console.log("Setting segment selection to:", segmentId);
        setSelectedSegmentId(segmentId);
        setActiveSegmentId(segmentId);
        
        // If a segment is selected, update current range to match it
        const selectedSegment = trimRanges.find(segment => segment.id === segmentId);
        if (selectedSegment) {
          setCurrentRange([selectedSegment.start, selectedSegment.end]);
        }
      }
    };
    
    // Add a force reset handler that will always clear selection state
    const handleForceResetSelection = () => {
      console.log("Force resetting segment selection");
      setSelectedSegmentId(null);
      setActiveSegmentId(null);
      setCurrentRange([progress, progress]);
    };

    const handleUpdateSegmentStart = (e: CustomEvent) => {
      const { id, newStart } = e.detail;
      setTrimRanges(prev => prev.map(range => {
        if (range.id === id) {
          // Make sure new start time is before end time
          const newStartTime = Math.min(newStart, range.end - 0.5);
          // Update the current range to reflect the change
          setCurrentRange([newStartTime, range.end]);
          return { ...range, start: newStartTime };
        }
        return range;
      }));
      // Show success notification
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 p-3 rounded-md shadow-lg bg-green-500 text-white z-50 animate-fadeIn";
      toast.textContent = `Updated segment start time to ${formatTime(newStart)}`;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-in-out";
        toast.style.opacity = "0";
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    };

    const handleUpdateSegmentEnd = (e: CustomEvent) => {
      const { id, newEnd } = e.detail;
      setTrimRanges(prev => prev.map(range => {
        if (range.id === id) {
          // Make sure new end time is after start time
          const newEndTime = Math.max(newEnd, range.start + 0.5);
          // Update the current range to reflect the change
          setCurrentRange([range.start, newEndTime]);
          return { ...range, end: newEndTime };
        }
        return range;
      }));
      // Show success notification
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 p-3 rounded-md shadow-lg bg-green-500 text-white z-50 animate-fadeIn";
      toast.textContent = `Updated segment end time to ${formatTime(newEnd, true)}`;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-in-out";
        toast.style.opacity = "0";
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    };

    document.addEventListener('segmentSelected', handleSegmentSelected as EventListener);
    document.addEventListener('updateSegmentStart', handleUpdateSegmentStart as EventListener);
    document.addEventListener('updateSegmentEnd', handleUpdateSegmentEnd as EventListener);
    document.addEventListener('forceResetSegmentSelection', handleForceResetSelection as EventListener);

    return () => {
      document.removeEventListener('segmentSelected', handleSegmentSelected as EventListener);
      document.removeEventListener('updateSegmentStart', handleUpdateSegmentStart as EventListener);
      document.removeEventListener('updateSegmentEnd', handleUpdateSegmentEnd as EventListener);
      document.removeEventListener('forceResetSegmentSelection', handleForceResetSelection as EventListener);
    };
  }, []);

  // Set up seekTo in the context
  useEffect(() => {
    if (playerRef.current) {
      const seekToFunc = (time: number) => {
        playerRef.current?.seekTo(time);
      };
      
      // Expose the seekTo function to be used via the context
      (window as any).seekToFunction = seekToFunc;
    }
  }, [playerRef.current]);
  
  // Handle video player's play/pause state changes
  const handlePlay = () => {
    setPlaying(true);
    console.log("Play state changed:", true);
  };

  const handlePause = () => {
    setPlaying(false);
    console.log("Play state changed:", false);
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    setProgress(state.playedSeconds);

    // When playing, check if we need to deselect a segment when playhead moves outside of it
    if (playing) {
      // If a segment is selected, check if playhead is still within it
      if (selectedSegmentId && !creatingNewSegment) {
        const selectedSegment = trimRanges.find(segment => segment.id === selectedSegmentId);
        if (selectedSegment) {
          // If playhead is outside the selected segment, deselect it
          if (state.playedSeconds < selectedSegment.start || state.playedSeconds > selectedSegment.end) {
            console.log("Playhead outside selected segment - deselecting");
            setSelectedSegmentId(null);
            setActiveSegmentId(null);
            setCurrentRange([state.playedSeconds, state.playedSeconds]);
          }
        }
      }
      
      // Only update active segment when mouse isn't controlling it
      // And we're not creating a new segment
      if (activeSegmentId === null && !creatingNewSegment) {
        const newActiveSegment = findActiveSegment(state.playedSeconds);
        if (newActiveSegment !== activeSegmentId) {
          setActiveSegmentId(newActiveSegment);
        }
      }
    }

    if (isPreviewMode && trimRanges.length > 0) {
      const currentSegment = trimRanges[currentSegmentIndex];

      // Skip ahead if we're before the segment starts
      if (state.playedSeconds < currentSegment.start) {
        if (playerRef.current) {
          playerRef.current.seekTo(currentSegment.start);
        }
        return;
      }

      // In preview mode, handle segment transitions
      if (state.playedSeconds >= currentSegment.end) {
        // Current segment finished
        if (currentSegmentIndex < trimRanges.length - 1) {
          // Move to next segment
          const nextIndex = currentSegmentIndex + 1;
          setCurrentSegmentIndex(nextIndex);
          if (playerRef.current) {
            playerRef.current.seekTo(trimRanges[nextIndex].start);
          }
        } else {
          // End of all segments
          setPlaying(false);
          setIsPreviewMode(false);
          setCurrentSegmentIndex(0);
          // Return to the start of the first segment
          if (trimRanges.length > 0 && playerRef.current) {
            playerRef.current.seekTo(trimRanges[0].start);
          }
        }
      }
    } else {
      // Regular playback mode
      // Don't stop playing at segment boundaries - only in preview mode
      // No additional conditions needed here, just let the video play
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
    setCurrentRange([0, duration]);

    // Create an initial segment that spans the entire video if no segments exist
    if (trimRanges.length === 0) {
      const fullVideoSegment: TrimRange = {
        id: "initial",
        start: 0,
        end: duration,
        title: "Full Video",
      };
      setTrimRanges([fullVideoSegment]);
    }
  };

  const handleSliderChange = (newRange: number[]) => {
    // In preview mode, respect the segment boundaries
    // In regular mode, allow full video playback
    if (isPreviewMode) {
      setCurrentRange([newRange[0], newRange[1]]);
      if (playerRef.current) {
        playerRef.current.seekTo(newRange[0]);
      }
    } else {
      // For regular playback, we'll still set currentRange for visual indication
      // but the playback will continue through the entire video
      setCurrentRange([newRange[0], newRange[1]]);
      if (playerRef.current) {
        playerRef.current.seekTo(newRange[0]);
      }
    }
  };

  // This function modifies existing segments or creates new ones based on the current selection
  const addTrimRange = () => {
    const start = currentRange[0];
    const end = currentRange[1];

    // Check if we have the initial full segment
    if (trimRanges.length === 1 && trimRanges[0].id === "initial") {
      // Modify the initial segment instead of creating a new one
      const updatedInitialSegment: TrimRange = {
        ...trimRanges[0],
        start: start,
        end: trimRanges[0].end,
      };
      setTrimRanges([updatedInitialSegment]);
      return;
    }

    // Always create a new segment when adding via the trim buttons
    // This allows creating segments in any area
    const newRange: TrimRange = {
      id: Math.random().toString(36).substring(7),
      start: start,
      end: end,
      title: `Segment ${trimRanges.length + 1}`,
    };
    setTrimRanges([...trimRanges, newRange]);
  };

  const removeTrimRange = (id: string) => {
    // If this is the last segment, replace it with the full video segment
    if (trimRanges.length <= 1) {
      const fullVideoSegment: TrimRange = {
        id: "initial",
        start: 0,
        end: duration,
        title: "Full Video",
      };
      setTrimRanges([fullVideoSegment]);
    } else {
      setTrimRanges(trimRanges.filter((range) => range.id !== id));
    }
  };

  const previewRange = (range: TrimRange) => {
    setCurrentRange([range.start, range.end]);
    if (playerRef.current) {
      playerRef.current.seekTo(range.start);
    }
    setPlaying(true);
  };

  const togglePreviewMode = () => {
    if (isPreviewMode) {
      // Cancel preview mode
      setIsPreviewMode(false);
      setPlaying(false);
      return;
    }

    if (trimRanges.length === 0) {
      alert("Please create at least one segment to preview.");
      return;
    }

    // Sort segments by start time to play them in chronological order
    const sortedRanges = [...trimRanges].sort((a, b) => a.start - b.start);
    setTrimRanges(sortedRanges);

    setCurrentSegmentIndex(0);
    setIsPreviewMode(true);

    // Start playing from the first segment
    if (playerRef.current) {
      playerRef.current.seekTo(sortedRanges[0].start);
    }
    setPlaying(true);
  };

  // When preview mode or current segment changes, update the current range
  useEffect(() => {
    if (isPreviewMode && trimRanges.length > 0) {
      const segment = trimRanges[currentSegmentIndex];
      setCurrentRange([segment.start, segment.end]);
    }
  }, [isPreviewMode, currentSegmentIndex, trimRanges]);

  const handleSubmitTrim = (saveType: "save_and_replace" | "save_as_new" = "save_and_replace") => {
    if (trimRanges.length < 1) {
      alert("Please select at least one clip to trim.");
      return;
    }

    // Create a simplified version of trimRanges with only id, start, and end properties
    const simplifiedRanges = trimRanges.map(({ id, start, end }) => ({ id, start, end }));
    
    // Include the action type in the JSON output
    const outputData = {
      action: saveType === "save_and_replace" ? "replace_video" : "create_new_video",
      segments: simplifiedRanges
    };

    alert(
      `Preparing to export ${trimRanges.length} segments with type ${saveType}:\n${JSON.stringify(outputData, null, 2)}`,
    );
  };

  // Calculate total duration of all segments
  const totalDuration = trimRanges.reduce((acc, range) => acc + (range.end - range.start), 0);

  return (
    <div className="w-full mx-auto">
      {/* Main content with video and segments */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left side - Video player and timeline */}
        <div className="flex-1 space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <ReactPlayer
              ref={playerRef}
              url={sampleVideoUrl}
              width="100%"
              height="100%"
              playing={playing}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onPlay={handlePlay}
              onPause={handlePause}
              controls={true}
              config={{
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                    disablePictureInPicture: true,
                  }
                }
              }}
              progressInterval={30}
            />
          </div>

          <div className="space-y-2">
            

            {/* New Trim Timeline */}
            {duration > 0 && (
              <TrimTimeline 
                duration={duration}
                currentTime={progress}
                trimStart={currentRange[0]}
                trimEnd={currentRange[1]}
                playing={playing}
                creatingNewSegment={creatingNewSegment}
                segments={trimRanges}
                activeSegmentId={activeSegmentId}
                isPreviewMode={isPreviewMode}
                currentSegmentIndex={currentSegmentIndex}
                onTrimStartChange={(time) => {
                  console.log("onTrimStartChange called with time:", time);
                  console.log("Current creatingNewSegment flag:", creatingNewSegment);

                  // Always create a new segment when using the left-hand button
                  // This is a simpler approach that prevents confusion
                  console.log("Left hand clicked, current time:", time);
                  
                  // CRITICAL: First force clear all segment selection state
                  // This prevents modifying an existing segment when we want to create a new one
                  console.log("Clearing segment selection completely");
                  setSelectedSegmentId(null);
                  setActiveSegmentId(null);

                  // Start a new segment creation process
                  console.log("Starting new segment creation from time:", time);
                  
                  // Set segment creation mode to lock out other selection operations
                  setCreatingNewSegment(true);
                  setNewSegmentStartTime(time);
                  
                  // Immediately update the initial segment if it exists and it's the only segment
                  if (trimRanges.length === 1 && trimRanges[0].id === "initial") {
                    // Create a temporary segment with start at current time and end at video duration
                    const tempSegment: TrimRange = {
                      id: "creating-" + Math.random().toString(36).substring(7), // Add random suffix to prevent duplicate keys
                      start: time,
                      end: duration,
                      title: "New Segment"
                    };
                    
                    // Replace the initial segment with this temporary one
                    setTrimRanges([tempSegment]);
                  } else if (trimRanges.length > 0) {
                    // When we already have segments, add a temporary one so we see the start position
                    const tempSegment: TrimRange = {
                      id: "creating-" + Math.random().toString(36).substring(7), // Add random suffix to prevent duplicate keys
                      start: time,
                      end: Math.min(time + 5, duration), // Short temporary segment
                      title: "New Segment"
                    };
                    
                    // Add to existing segments (will be filtered out when finalizing)
                    setTrimRanges([...trimRanges, tempSegment]);
                  }
                  
                  setCurrentRange([time, time]); // Only show the start point, no temporary end
                  
                  // Additional cleanup operation to reset any UI state
                  document.dispatchEvent(new CustomEvent('forceResetSegmentSelection'));
                  
                  // Show a toast notification for step 1
                  const toast = document.createElement("div");
                  toast.className = "fixed bottom-4 right-4 p-3 rounded-md shadow-lg bg-blue-500 text-white z-50 animate-fadeIn";
                  toast.textContent = `Started segment at ${formatTime(time, true)} - Now click the right hand button to set end time`;
                  document.body.appendChild(toast);

                  setTimeout(() => {
                    toast.style.animation = "fadeOut 0.3s ease-in-out";
                    toast.style.opacity = "0";
                    setTimeout(() => document.body.removeChild(toast), 300);
                  }, 3000);
                }}
                onTrimEndChange={(time) => {
                  console.log("onTrimEndChange called with time:", time);

                  if (creatingNewSegment) {
                    console.log("Completing segment creation by setting end time");
                    // Complete the new segment creation
                    let segmentStart = newSegmentStartTime;
                    let segmentEnd = time;

                    // Make sure start is before end
                    if (segmentStart > segmentEnd) {
                      console.log("Swapping start/end times because start > end");
                      [segmentStart, segmentEnd] = [segmentEnd, segmentStart];
                    }

                    // Ensure minimum segment length
                    if (Math.abs(segmentEnd - segmentStart) < 0.5) {
                      segmentEnd = segmentStart + 2.0;
                    }

                    // Check if we need to update an existing segment instead of creating a new one
                    const existingSegmentIndex = trimRanges.findIndex(segment => 
                      segment.id !== "initial" && segmentStart === segment.start
                    );

                    if (existingSegmentIndex >= 0) {
                      // Update the existing segment
                      const updatedRanges = [...trimRanges];
                      updatedRanges[existingSegmentIndex].end = segmentEnd;
                      setTrimRanges(updatedRanges);

                      // Keep this segment as selected
                      setSelectedSegmentId(updatedRanges[existingSegmentIndex].id);
                      setActiveSegmentId(updatedRanges[existingSegmentIndex].id);

                      // Show update notification
                      const toast = document.createElement("div");
                      toast.className = "fixed bottom-4 right-4 p-3 rounded-md shadow-lg bg-green-500 text-white z-50 animate-fadeIn";
                      toast.textContent = `Segment updated: ${formatTime(segmentStart, true)} - ${formatTime(segmentEnd, true)}`;
                      document.body.appendChild(toast);

                      setTimeout(() => {
                        toast.style.animation = "fadeOut 0.3s ease-in-out";
                        toast.style.opacity = "0";
                        setTimeout(() => document.body.removeChild(toast), 300);
                      }, 3000);
                    } else {
                      // Create a new segment
                      const newSegment: TrimRange = {
                        id: Math.random().toString(36).substring(7),
                        start: segmentStart,
                        end: segmentEnd,
                        title: `Segment ${trimRanges.length + 1}`,
                      };

                      console.log("Creating new segment with:", newSegment);

                      // Add segment to the list
                      setTrimRanges((prevRanges) => {
                        // Replace the initial segment when it's the only segment
                        if (prevRanges.length === 1 && prevRanges[0].id === "initial") {
                          console.log("Replacing initial segment with first user segment");
                          return [newSegment]; // Replace initial with the first user segment
                        }
                        // If this is a temporary "creating" segment replacing itself with a permanent ID
                        else if (prevRanges.length === 1 && (prevRanges[0].id === "creating" || prevRanges[0].id.startsWith("creating-"))) {
                          console.log("Replacing temporary segment with permanent segment");
                          return [newSegment]; // Replace temporary with permanent
                        }
                        // If we already have segments with real IDs, add to them
                        else {
                          console.log("Adding segment to existing segments");
                          // Filter out any temporary segments before adding the new one
                          const filteredRanges = prevRanges.filter(r => !r.id.startsWith("creating-") && r.id !== "creating" && r.id !== "initial");
                          return [...filteredRanges, newSegment];
                        }
                      });

                      // Store the last segment end time
                      setLastSegmentEnd(segmentEnd);

                      // Select the newly created segment
                      setSelectedSegmentId(newSegment.id);
                      setActiveSegmentId(newSegment.id);

                      // Show success notification
                      const toast = document.createElement("div");
                      toast.className = "fixed bottom-4 right-4 p-3 rounded-md shadow-lg bg-green-500 text-white z-50 animate-fadeIn";
                      toast.textContent = `New segment created: ${formatTime(segmentStart, true)} - ${formatTime(segmentEnd, true)}`;
                      document.body.appendChild(toast);

                      setTimeout(() => {
                        toast.style.animation = "fadeOut 0.3s ease-in-out";
                        toast.style.opacity = "0";
                        setTimeout(() => document.body.removeChild(toast), 300);
                      }, 3000);
                    }

                    // MOST IMPORTANT FIX: First reset creation state
                    setCreatingNewSegment(false);
                    
                    // Set the current range to the completed segment temporarily
                    setCurrentRange([segmentStart, segmentEnd]);
                    
                    // CRITICAL: Force clear all selection state after creating a segment
                    // This ensures no segment remains selected when creating a new one
                    setSelectedSegmentId(null);
                    setActiveSegmentId(null);
                    
                    // After a short delay, reset cursor position to current playhead
                    // This ensures we're ready for the next segment creation
                    setTimeout(() => {
                      setCurrentRange([progress, progress]);
                      // Double-check that selection is cleared
                      setSelectedSegmentId(null);
                      setActiveSegmentId(null);
                    }, 300);

                  } else if (activeSegmentId) {
                    // Update the end time of an existing segment
                    const event = new CustomEvent('updateSegmentEnd', { 
                      detail: { id: activeSegmentId, newEnd: time } 
                    });
                    document.dispatchEvent(event);
                  } else {
                    console.log("No conditions met for right hand click");
                  }
                }}
                onSeek={(time) => {
                  if (playerRef.current) {
                    playerRef.current.seekTo(time);
                  }
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            )}
          </div>

          {/* Playback controls */}
          <div className="flex justify-end gap-2 video-controls timeline-controls-container">
            {trimRanges.length > 0 && (
              <Button 
                variant="outline" 
                onClick={togglePreviewMode}
                title="Preview the video before save"
                className={`opacity-100 hover:opacity-100 mr-auto ${isPreviewMode ? "border-red-500 text-red-500" : "text-red-500"}`}
              >
                {playing && isPreviewMode ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {playing && isPreviewMode ? "Preview in action" : "Preview"}
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => handleSubmitTrim("save_and_replace")}
              disabled={trimRanges.length < 1}
              className="bg-gray-800 hover:bg-gray-700 text-white opacity-100 hover:opacity-100"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Replace Video
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmitTrim("save_as_new")}
              disabled={trimRanges.length < 1}
              className="opacity-100 hover:opacity-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Replace as New
            </Button>
          </div>

          {/* Timeline with segments has been removed in favor of the TrimTimeline component */}

          {/* Preview mode indicator */}
          {isPreviewMode && (
            <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded-md text-green-800 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Film className="h-4 w-4 mr-2" />
                  <span>Preview Mode: Playing segment {currentSegmentIndex + 1} of {trimRanges.length}</span>
                </div>
                <span className="font-mono">
                  {formatTime(trimRanges[currentSegmentIndex]?.start || 0, true)} - {formatTime(trimRanges[currentSegmentIndex]?.end || 0, true)}
                </span>
              </div>
            </div>
          )}

          {/* Time codes removed as requested */}
        </div>

        {/* Right side - Segments panel */}
        <div className="w-full md:w-80 bg-gray-800 rounded-md text-white">
          <div className="p-3 font-medium border-b border-gray-700">
            <h3>Segments to export:</h3>
          </div>

          <ScrollArea.Root className="h-[500px] overflow-hidden">
            <ScrollArea.Viewport className="w-full h-full">
              <div className="p-3 space-y-3">
                {trimRanges.length === 0 ? (
                  <div className="text-gray-400 text-center p-4">
                    No segments created yet. Use the timeline and the trim handles (left and right arrows) to create segments.
                  </div>
                ) : (
                  <>
                    {[...trimRanges]
                      .sort((a, b) => a.start - b.start) // Sort segments by start time
                      .map((range, idx) => {
                      const isActive = range.id === activeSegmentId;
                      // Find the original index to use with currentSegmentIndex
                      const originalIndex = trimRanges.findIndex(r => r.id === range.id);
                      // Calculate the background color for the circle - defined outside hover effects
                      const circleBackgroundColor = isActive ? '#D3B965' : 
                        ['#5C4536', '#D3B965', '#4A7C4C', '#76A7C5', '#7E5DAA', '#5C4536', '#D3B965', '#4A7C4C'][idx % 8];
                      
                      return (
                        <div 
                          key={range.id} 
                          className={`bg-gray-700 rounded-md overflow-hidden ${isActive ? 'ring-2 ring-[#D3B965]' : ''} hover:ring-1 hover:ring-[#D3B965] cursor-pointer`}
                          onMouseEnter={() => setActiveSegmentId(range.id)}
                          onMouseLeave={() => setActiveSegmentId(null)}
                          onClick={() => {
                            // Seek to the start of this segment when clicked
                            if (playerRef.current) {
                              playerRef.current.seekTo(range.start);
                            }
                          }}
                        >
                          <div className="flex items-center p-2 gap-2">
                            <div 
                              className={`flex-shrink-0 w-6 h-6 rounded-full ${
                                isPreviewMode && currentSegmentIndex === originalIndex ? 'animate-pulse' : ''
                              } flex items-center justify-center text-sm font-bold`}
                              style={{
                                backgroundColor: circleBackgroundColor
                              }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-small text-cyan-400 flex space-x-1">
                                <span className="bg-gray-900 rounded px-1 py-1 w-26 text-center">
                                  {formatTime(range.start, true)}
                                </span>
                                <span> - </span>
                                <span className="bg-gray-900 rounded px-1 py-1 w-26 text-center">
                                  {formatTime(range.end, true)}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTrimRange(range.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-gray-800 px-3 py-2 text-xs">
                            <div>Duration: {formatTime(range.end - range.start, true)}</div>
                            <div>{calculateFrames(range.end - range.start)} ms, {Math.round((range.end - range.start) * 30)} frames</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar 
              className="flex select-none touch-none p-0.5 bg-gray-700 transition-colors duration-150 ease-out hover:bg-gray-600 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5" 
              orientation="vertical"
            >
              <ScrollArea.Thumb className="flex-1 bg-gray-500 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {trimRanges.length > 0 && (
            <div className="p-3 border-t border-gray-700">
              <div className="text-sm mb-2">Segments total: {formatTime(totalDuration, true)}</div>
              <Button
                variant="default"
                onClick={() => handleSubmitTrim("save_and_replace")}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white opacity-100 hover:opacity-100"
              >
                <Scissors className="h-4 w-4 mr-2" />
                Replace with {trimRanges.length} Segments
              </Button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .thumb {
          height: 20px;
          width: 20px;
          background-color: #ffffff;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          cursor: grab;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          z-index: 10;
          opacity: 1 !important;
          transition: none;
          pointer-events: auto !important;
        }

        .track {
          height: 6px;
          background-color: #e5e7eb;
          border-radius: 3px;
          opacity: 1 !important;
          transition: none;
        }

        .track-1 {
          background-color: #3b82f6;
          opacity: 1 !important;
        }

        /* Always display controls without hover required */
        .video-controls {
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateY(0) !important;
          transition: none !important;
        }

        /* Override ReactPlayer control settings */
        .video-player-always-visible video::-webkit-media-controls-overlay-play-button,
        .video-player-always-visible video::-webkit-media-controls-play-button,
        .video-player-always-visible video::-webkit-media-controls-timeline,
        .video-player-always-visible video::-webkit-media-controls-current-time-display,
        .video-player-always-visible video::-webkit-media-controls-time-remaining-display,
        .video-player-always-visible video::-webkit-media-controls-time-remaining-display,
        .video-player-always-visible video::-webkit-media-controls-fullscreen-button,
        .video-player-always-visible video::-webkit-media-controls-mute-button,
        .video-player-always-visible video::-webkit-media-controls-toggle-closed-captions-button,
        .video-player-always-visible video::-webkit-media-controls-panel {
          display: block !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        /* Control container */
        .timeline-controls-container {
          opacity: 1 !important;
          visibility: visible !important;
          transition: none !important;
        }

        /* Toast animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(20px); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }        }
      `}</style>
    </div>
  );
}