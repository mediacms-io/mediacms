import { useState, useRef, useEffect } from "react";
import { generateThumbnail } from "@/lib/videoUtils";
import { formatDetailedTime } from "@/lib/timeUtils";
import type { Segment } from "@/components/ClipSegments";

// Represents a state of the editor for undo/redo
interface EditorState {
  trimStart: number;
  trimEnd: number;
  splitPoints: number[];
  clipSegments: Segment[];
}

const useVideoTrimmer = () => {
  // Video element reference and state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Preview mode state for playing only segments
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSegmentIndex, setPreviewSegmentIndex] = useState(0);
  
  // Timeline state
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1); // Start with 1x zoom level
  
  // Clip segments state
  const [clipSegments, setClipSegments] = useState<Segment[]>([]);
  
  // History state for undo/redo
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyPosition, setHistoryPosition] = useState(-1);
  
  // Initialize video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setTrimEnd(video.duration);
      
      // Generate placeholders and create initial segment
      const initializeEditor = async () => {
        // Generate thumbnail for initial segment
        const segmentThumbnail = await generateThumbnail(video, video.duration / 2);
        
        // Create an initial segment that spans the entire video
        const initialSegment: Segment = {
          id: 1,
          name: "segment",
          startTime: 0,
          endTime: video.duration,
          thumbnail: segmentThumbnail
        };
        
        // Initialize history state with the full-length segment
        const initialState: EditorState = {
          trimStart: 0,
          trimEnd: video.duration,
          splitPoints: [],
          clipSegments: [initialSegment]
        };
        
        setHistory([initialState]);
        setHistoryPosition(0);
        setClipSegments([initialSegment]);
        
        // Generate timeline thumbnails
        const count = 6;
        const interval = video.duration / count;
        const placeholders: string[] = [];
        
        for (let i = 0; i < count; i++) {
          const time = interval * i + interval / 2;
          const thumbnail = await generateThumbnail(video, time);
          placeholders.push(thumbnail);
        }
        
        setThumbnails(placeholders);
      };
      
      initializeEditor();
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handlePlay = () => {
      // Only update isPlaying if we're not in preview mode
      if (!isPreviewMode) {
        setIsPlaying(true);
      }
    };
    
    const handlePause = () => {
      // Only update isPlaying if we're not in preview mode
      if (!isPreviewMode) {
        setIsPlaying(false);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      video.currentTime = trimStart;
    };
    
    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      // Remove event listeners
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isPreviewMode]);
  
  // Play/pause video
  const playPauseVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      // If at the end of the trim range, reset to the beginning
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
    }
  };
  
  // Seek to a specific time
  const seekVideo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = time;
    setCurrentTime(time);
  };
  
  // Save the current state to history
  const saveState = () => {
    const newState: EditorState = {
      trimStart,
      trimEnd,
      splitPoints: [...splitPoints],
      clipSegments: [...clipSegments]
    };
    
    // If we're not at the end of the history, truncate
    if (historyPosition < history.length - 1) {
      const newHistory = history.slice(0, historyPosition + 1);
      setHistory([...newHistory, newState]);
    } else {
      setHistory([...history, newState]);
    }
    
    setHistoryPosition(historyPosition + 1);
  };
  
  // Listen for segment update events and split-at-time events
  useEffect(() => {
    const handleUpdateSegments = (e: CustomEvent) => {
      if (e.detail && e.detail.segments) {
        setClipSegments(e.detail.segments);
        saveState();
      }
    };
    
    const handleSplitSegment = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && 
          typeof customEvent.detail.time === 'number' && 
          typeof customEvent.detail.segmentId === 'number') {
        
        // Get the time and segment ID from the event
        const timeToSplit = customEvent.detail.time;
        const segmentId = customEvent.detail.segmentId;
        
        // Move the current time to the split position
        seekVideo(timeToSplit);
        
        // Find the segment to split
        const segmentToSplit = clipSegments.find(seg => seg.id === segmentId);
        if (!segmentToSplit) return;
        
        // Make sure the split point is within the segment
        if (timeToSplit <= segmentToSplit.startTime || timeToSplit >= segmentToSplit.endTime) {
          return; // Can't split outside segment boundaries
        }
        
        // Create two new segments from the split
        const newSegments = [...clipSegments];
        
        // Remove the original segment
        const segmentIndex = newSegments.findIndex(seg => seg.id === segmentId);
        if (segmentIndex === -1) return;
        
        newSegments.splice(segmentIndex, 1);
        
        // Create first half of the split segment - no thumbnail needed
        const firstHalf: Segment = {
          id: Date.now(),
          name: `${segmentToSplit.name}-A`,
          startTime: segmentToSplit.startTime,
          endTime: timeToSplit,
          thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
        };
        
        // Create second half of the split segment - no thumbnail needed
        const secondHalf: Segment = {
          id: Date.now() + 1,
          name: `${segmentToSplit.name}-B`,
          startTime: timeToSplit,
          endTime: segmentToSplit.endTime,
          thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
        };
        
        // Add the new segments
        newSegments.push(firstHalf, secondHalf);
        
        // Sort segments by start time
        newSegments.sort((a, b) => a.startTime - b.startTime);
        
        // Update state
        setClipSegments(newSegments);
        saveState();
      }
    };
    
    // Handle delete segment event
    const handleDeleteSegment = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.segmentId === 'number') {
        const segmentId = customEvent.detail.segmentId;
        
        // Find and remove the segment
        const newSegments = clipSegments.filter(segment => segment.id !== segmentId);
        
        if (newSegments.length !== clipSegments.length) {
          // If all segments are deleted, create a new full video segment
          if (newSegments.length === 0 && videoRef.current) {
            // Create a new default segment that spans the entire video
            // No need to generate a thumbnail - we'll use dynamic colors
            const defaultSegment: Segment = {
              id: Date.now(),
              name: "segment",
              startTime: 0,
              endTime: videoRef.current.duration,
              thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
            };
            
            // Reset the trim points as well
            setTrimStart(0);
            setTrimEnd(videoRef.current.duration);
            setSplitPoints([]);
            setClipSegments([defaultSegment]);
          } else {
            // Just update the segments normally
            setClipSegments(newSegments);
          }
          saveState();
        }
      }
    };
    
    document.addEventListener('update-segments', handleUpdateSegments as EventListener);
    document.addEventListener('split-segment', handleSplitSegment as EventListener);
    document.addEventListener('delete-segment', handleDeleteSegment as EventListener);
    
    return () => {
      document.removeEventListener('update-segments', handleUpdateSegments as EventListener);
      document.removeEventListener('split-segment', handleSplitSegment as EventListener);
      document.removeEventListener('delete-segment', handleDeleteSegment as EventListener);
    };
  }, [clipSegments, duration]);
  
  // Preview mode effect to handle playing only segments
  useEffect(() => {
    if (!isPreviewMode || !videoRef.current) return;
    
    // Sort segments by start time
    const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    
    // Check if we've reached the end of the current segment
    const handleSegmentPlayback = () => {
      if (!isPreviewMode || !videoRef.current) return;
      
      const currentSegment = orderedSegments[previewSegmentIndex];
      if (!currentSegment) return;
      
      // If we've reached the end of the current segment
      if (videoRef.current.currentTime >= currentSegment.endTime) {
        // Move to the next segment if available
        if (previewSegmentIndex < orderedSegments.length - 1) {
          const nextSegment = orderedSegments[previewSegmentIndex + 1];
          videoRef.current.currentTime = nextSegment.startTime;
          setPreviewSegmentIndex(previewSegmentIndex + 1);
        } else {
          // End of all segments, stop preview mode
          setIsPreviewMode(false);
          videoRef.current.pause();
        }
      }
    };
    
    // Add event listener for timeupdate to check segment boundaries
    videoRef.current.addEventListener('timeupdate', handleSegmentPlayback);
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleSegmentPlayback);
      }
    };
  }, [isPreviewMode, previewSegmentIndex, clipSegments]);
  
  // Handle trim start change
  const handleTrimStartChange = (time: number) => {
    setTrimStart(time);
    saveState();
  };
  
  // Handle trim end change
  const handleTrimEndChange = (time: number) => {
    setTrimEnd(time);
    saveState();
  };
  
  // Handle split at current position
  const handleSplit = async () => {
    if (!videoRef.current) return;
    
    // Add current time to split points if not already present
    if (!splitPoints.includes(currentTime)) {
      const newSplitPoints = [...splitPoints, currentTime].sort((a, b) => a - b);
      setSplitPoints(newSplitPoints);
      
      // Generate segments based on split points
      const newSegments: Segment[] = [];
      let startTime = 0;
      
      for (let i = 0; i <= newSplitPoints.length; i++) {
        const endTime = i < newSplitPoints.length ? newSplitPoints[i] : duration;
        
        if (startTime < endTime) {
          // No need to generate thumbnails - we'll use dynamic colors
          newSegments.push({
            id: Date.now() + i,
            name: `Segment ${i + 1}`,
            startTime,
            endTime,
            thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
          });
          
          startTime = endTime;
        }
      }
      
      setClipSegments(newSegments);
      saveState();
    }
  };
  
  // Handle reset of all edits
  const handleReset = async () => {
    setTrimStart(0);
    setTrimEnd(duration);
    setSplitPoints([]);
    
    // Create a new default segment that spans the entire video
    if (!videoRef.current) return;
    
    // No need to generate thumbnails - we'll use dynamic colors
    const defaultSegment: Segment = {
      id: Date.now(),
      name: "segment",
      startTime: 0,
      endTime: duration,
      thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
    };
    
    setClipSegments([defaultSegment]);
    saveState();
  };
  
  // Handle undo
  const handleUndo = () => {
    if (historyPosition > 0) {
      const previousState = history[historyPosition - 1];
      setTrimStart(previousState.trimStart);
      setTrimEnd(previousState.trimEnd);
      setSplitPoints(previousState.splitPoints);
      setClipSegments(previousState.clipSegments);
      setHistoryPosition(historyPosition - 1);
    }
  };
  
  // Handle redo
  const handleRedo = () => {
    if (historyPosition < history.length - 1) {
      const nextState = history[historyPosition + 1];
      setTrimStart(nextState.trimStart);
      setTrimEnd(nextState.trimEnd);
      setSplitPoints(nextState.splitPoints);
      setClipSegments(nextState.clipSegments);
      setHistoryPosition(historyPosition + 1);
    }
  };
  
  // Handle playing the preview of all segments
  const handlePreview = () => {
    const video = videoRef.current;
    if (!video || clipSegments.length === 0) return;
    
    // If preview is already active, turn it off
    if (isPreviewMode) {
      setIsPreviewMode(false);
      
      // If we were previously in normal play mode before entering preview, 
      // restore that state instead of pausing
      if (!isPlaying) {
        video.pause();
      }
      return;
    }
    
    // If normal playback is happening, remember that state but pause it
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      video.pause();
    }
    
    // Sort segments by start time to ensure proper playback order
    const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    setPreviewSegmentIndex(0);
    
    // Start preview mode by playing the first segment
    setIsPreviewMode(true);
    video.currentTime = orderedSegments[0].startTime;
    video.play();
  };
  
  // Handle zoom level change
  const handleZoomChange = (level: number) => {
    setZoomLevel(level);
  };
  
  // Handle play/pause of the full video
  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // If in preview mode, exit it before toggling normal play
    if (isPreviewMode) {
      setIsPreviewMode(false);
      // Don't immediately start playing when exiting preview mode
      // Just update the state and return
      setIsPlaying(false);
      video.pause();
      return;
    }
    
    if (isPlaying) {
      // Pause the video
      video.pause();
      setIsPlaying(false);
    } else {
      // Play the video from current position
      video.play().catch(error => console.error("Error playing video:", error));
      setIsPlaying(true);
    }
  };
  
  // Toggle mute state
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };
  
  // Handle save action
  const handleSave = () => {
    // Sort segments chronologically by start time before saving
    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    
    // Create the JSON data for saving
    const saveData = {
      type: "save",
      segments: sortedSegments.map(segment => ({
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime)
      }))
    };
    
    // Display JSON in alert (for demonstration purposes)
    alert(JSON.stringify(saveData, null, 2));
    
    // In a real implementation, this would make a POST request to save the data
    console.log("Save data:", saveData);
  };
  
  // Handle save a copy action
  const handleSaveACopy = () => {
    // Sort segments chronologically by start time before saving
    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    
    // Create the JSON data for saving as a copy
    const saveData = {
      type: "save_as_a_copy",
      segments: sortedSegments.map(segment => ({
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime)
      }))
    };
    
    // Display JSON in alert (for demonstration purposes)
    alert(JSON.stringify(saveData, null, 2));
    
    // In a real implementation, this would make a POST request to save the data as a copy
    console.log("Save as copy data:", saveData);
  };
  
  // Handle save segments individually action
  const handleSaveSegments = () => {
    // Sort segments chronologically by start time before saving
    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    
    // Create the JSON data for saving individual segments
    const saveData = {
      type: "save_segments",
      segments: sortedSegments.map(segment => ({
        name: segment.name,
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime)
      }))
    };
    
    // Display JSON in alert (for demonstration purposes)
    alert(JSON.stringify(saveData, null, 2));
    
    // In a real implementation, this would make a POST request to save each segment as a separate file
    console.log("Save segments data:", saveData);
  };
  
  return {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isPreviewMode,
    thumbnails,
    trimStart,
    trimEnd,
    splitPoints,
    zoomLevel,
    clipSegments,
    historyPosition,
    history,
    isMuted,
    playPauseVideo,
    seekVideo,
    handleTrimStartChange,
    handleTrimEndChange,
    handleSplit,
    handleReset,
    handleUndo,
    handleRedo,
    handlePreview,
    handlePlay,
    handleZoomChange,
    toggleMute,
    handleSave,
    handleSaveACopy,
    handleSaveSegments,
  };
};

export default useVideoTrimmer;
