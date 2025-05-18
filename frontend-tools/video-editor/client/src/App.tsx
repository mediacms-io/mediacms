import { useRef, useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import TimelineControls from "@/components/TimelineControls";
import EditingTools from "@/components/EditingTools";
import ClipSegments from "@/components/ClipSegments";
import MobilePlayPrompt from "@/components/IOSPlayPrompt";
import useVideoTrimmer from "@/hooks/useVideoTrimmer";

const App = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [videoInitialized, setVideoInitialized] = useState(false);

  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isPreviewMode,
    isMuted,
    thumbnails,
    trimStart,
    trimEnd,
    splitPoints,
    zoomLevel,
    clipSegments,
    historyPosition,
    history,
    hasUnsavedChanges,
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
  } = useVideoTrimmer();

  // Refs for hold-to-continue functionality
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if we're on a mobile device and reset on each visit
  useEffect(() => {
    const checkIsMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent);
    };
    
    setIsMobile(checkIsMobile());
    setVideoInitialized(false); // Reset each time for mobile devices

    // Add an event listener to detect when the video has been played
    const video = videoRef.current;
    if (video) {
      const handlePlay = () => {
        setVideoInitialized(true);
      };
      
      video.addEventListener('play', handlePlay);
      
      return () => {
        video.removeEventListener('play', handlePlay);
      };
    }
  }, [videoRef]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (incrementIntervalRef.current) clearInterval(incrementIntervalRef.current);
      if (decrementIntervalRef.current) clearInterval(decrementIntervalRef.current);
    };
  }, []);

  // Function to play from the beginning
  const playFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      seekVideo(0);
      if (!isPlaying) {
        playPauseVideo();
      }
    }
  };

  // Function to jump 15 seconds backward
  const jumpBackward15 = () => {
    const newTime = Math.max(0, currentTime - 15);
    seekVideo(newTime);
  };

  // Function to jump 15 seconds forward
  const jumpForward15 = () => {
    const newTime = Math.min(duration, currentTime + 15);
    seekVideo(newTime);
  };

  // Start continuous 50ms increment when button is held
  const startIncrement = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to avoid text selection
    e.preventDefault();
    
    if (incrementIntervalRef.current) clearInterval(incrementIntervalRef.current);
    
    // First immediate adjustment
    seekVideo(Math.min(duration, currentTime + 0.05));
    
    // Setup continuous adjustment
    incrementIntervalRef.current = setInterval(() => {
      const currentVideoTime = videoRef.current?.currentTime || 0;
      const newTime = Math.min(duration, currentVideoTime + 0.05);
      seekVideo(newTime);
    }, 100);
  };

  // Stop continuous increment
  const stopIncrement = () => {
    if (incrementIntervalRef.current) {
      clearInterval(incrementIntervalRef.current);
      incrementIntervalRef.current = null;
    }
  };

  // Start continuous 50ms decrement when button is held
  const startDecrement = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to avoid text selection
    e.preventDefault();
    
    if (decrementIntervalRef.current) clearInterval(decrementIntervalRef.current);
    
    // First immediate adjustment
    seekVideo(Math.max(0, currentTime - 0.05));
    
    // Setup continuous adjustment
    decrementIntervalRef.current = setInterval(() => {
      const currentVideoTime = videoRef.current?.currentTime || 0;
      const newTime = Math.max(0, currentVideoTime - 0.05);
      seekVideo(newTime);
    }, 100);
  };

  // Stop continuous decrement
  const stopDecrement = () => {
    if (decrementIntervalRef.current) {
      clearInterval(decrementIntervalRef.current);
      decrementIntervalRef.current = null;
    }
  };

  // Handle seeking with mobile check
  const handleMobileSafeSeek = (time: number) => {
    // Only allow seeking if not on mobile or if video has been played
    if (!isMobile || videoInitialized) {
      seekVideo(time);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <MobilePlayPrompt 
        videoRef={videoRef}
        onPlay={playPauseVideo}
      />
      
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Video Player */}
        <VideoPlayer 
          videoRef={videoRef}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          isMuted={isMuted}
          onPlayPause={playPauseVideo}
          onSeek={handleMobileSafeSeek}
          onToggleMute={toggleMute}
        />

        {/* Editing Tools */}
        <EditingTools 
          onSplit={handleSplit}
          onReset={handleReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPreview={handlePreview}
          onPlay={handlePlay}
          isPreviewMode={isPreviewMode}
          isPlaying={isPlaying}
          canUndo={historyPosition > 0}
          canRedo={historyPosition < history.length - 1}
        />

        {/* Timeline Controls */}
        <TimelineControls 
          currentTime={currentTime}
          duration={duration}
          thumbnails={thumbnails}
          trimStart={trimStart}
          trimEnd={trimEnd}
          splitPoints={splitPoints}
          zoomLevel={zoomLevel}
          clipSegments={clipSegments}
          onTrimStartChange={handleTrimStartChange}
          onTrimEndChange={handleTrimEndChange}
          onZoomChange={handleZoomChange}
          onSeek={handleMobileSafeSeek}
          videoRef={videoRef}
          onSave={handleSave}
          onSaveACopy={handleSaveACopy}
          onSaveSegments={handleSaveSegments}
          isPreviewMode={isPreviewMode}
          hasUnsavedChanges={hasUnsavedChanges}
          isIOSUninitialized={isMobile && !videoInitialized}
        />

        {/* Clip Segments */}
        <ClipSegments segments={clipSegments} />
      </div>
    </div>
  );
};

export default App;
