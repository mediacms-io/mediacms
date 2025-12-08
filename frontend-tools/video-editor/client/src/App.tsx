import { useRef, useEffect, useState } from "react";
import { formatTime, formatDetailedTime } from "./lib/timeUtils";
import logger from "./lib/logger";
import VideoPlayer from "@/components/VideoPlayer";
import TimelineControls from "@/components/TimelineControls";
import EditingTools from "@/components/EditingTools";
import ClipSegments from "@/components/ClipSegments";
import MobilePlayPrompt from "@/components/IOSPlayPrompt";
import useVideoTrimmer from "@/hooks/useVideoTrimmer";

const App = () => {
  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    setIsPlaying,
    isMuted,
    thumbnails,
    trimStart,
    trimEnd,
    splitPoints,
    zoomLevel,
    clipSegments,
    hasUnsavedChanges,
    historyPosition,
    history,
    handleTrimStartChange,
    handleTrimEndChange,
    handleZoomChange,
    handleMobileSafeSeek,
    handleSplit,
    handleReset,
    handleUndo,
    handleRedo,
    toggleMute,
    handleSave,
    handleSaveACopy,
    handleSaveSegments,
    isMobile,
    videoInitialized,
    setVideoInitialized,
    isPlayingSegments,
    handlePlaySegments
  } = useVideoTrimmer();

  // Function to play from the beginning
  const playFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      handleMobileSafeSeek(0);
      if (!isPlaying) {
        handlePlay();
      }
    }
  };

  // Function to jump 15 seconds backward
  const jumpBackward15 = () => {
    const newTime = Math.max(0, currentTime - 15);
    handleMobileSafeSeek(newTime);
  };

  // Function to jump 15 seconds forward
  const jumpForward15 = () => {
    const newTime = Math.min(duration, currentTime + 15);
    handleMobileSafeSeek(newTime);
  };

  const handlePlay = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    // If already playing, just pause the video
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    const currentPosition = Number(video.currentTime.toFixed(6)); // Fix to microsecond precision

    // Find the next stopping point based on current position
    let stopTime = duration;
    let currentSegment = null;
    let nextSegment = null;

    // Sort segments by start time to ensure correct order
    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

    // First, check if we're inside a segment or exactly at its start/end
    currentSegment = sortedSegments.find((seg) => {
      const segStartTime = Number(seg.startTime.toFixed(6));
      const segEndTime = Number(seg.endTime.toFixed(6));

      // Check if we're inside the segment
      if (currentPosition > segStartTime && currentPosition < segEndTime) {
        return true;
      }
      // Check if we're exactly at the start
      if (currentPosition === segStartTime) {
        return true;
      }
      // Check if we're exactly at the end
      if (currentPosition === segEndTime) {
        // If we're at the end of a segment, we should look for the next one
        return false;
      }
      return false;
    });

    // If we're not in a segment, find the next segment
    if (!currentSegment) {
      nextSegment = sortedSegments.find((seg) => {
        const segStartTime = Number(seg.startTime.toFixed(6));
        return segStartTime > currentPosition;
      });
    }

    // Determine where to stop based on position
    if (currentSegment) {
      // If we're in a segment, stop at its end
      stopTime = Number(currentSegment.endTime.toFixed(6));
    } else if (nextSegment) {
      // If we're in a cutaway and there's a next segment, stop at its start
      stopTime = Number(nextSegment.startTime.toFixed(6));
    }

    // Create a boundary checker function with high precision
    const checkBoundary = () => {
      if (!video) return;

      const currentPosition = Number(video.currentTime.toFixed(6));
      const timeLeft = Number((stopTime - currentPosition).toFixed(6));

      // If we've reached or passed the boundary
      if (timeLeft <= 0 || currentPosition >= stopTime) {
        // First pause playback
        video.pause();

        // Force exact position with multiple verification attempts
        const setExactPosition = () => {
          if (!video) return;

          // Set to exact boundary time
          video.currentTime = stopTime;
          handleMobileSafeSeek(stopTime);

          const actualPosition = Number(video.currentTime.toFixed(6));
          const difference = Number(Math.abs(actualPosition - stopTime).toFixed(6));

          logger.debug("Position verification:", {
            target: formatDetailedTime(stopTime),
            actual: formatDetailedTime(actualPosition),
            difference: difference
          });

          // If we're not exactly at the target position, try one more time
          if (difference > 0) {
            video.currentTime = stopTime;
            handleMobileSafeSeek(stopTime);
          }
        };

        // Multiple attempts to ensure precision, with increasing delays
        setExactPosition();
        setTimeout(setExactPosition, 5); // Quick first retry
        setTimeout(setExactPosition, 10); // Second retry
        setTimeout(setExactPosition, 20); // Third retry if needed
        setTimeout(setExactPosition, 50); // Final verification

        // Remove our boundary checker
        video.removeEventListener("timeupdate", checkBoundary);
        setIsPlaying(false);

        // Log the final position for debugging
        logger.debug("Stopped at position:", {
          target: formatDetailedTime(stopTime),
          actual: formatDetailedTime(video.currentTime),
          type: currentSegment
            ? "segment end"
            : nextSegment
              ? "next segment start"
              : "end of video",
          segment: currentSegment
            ? {
                id: currentSegment.id,
                start: formatDetailedTime(currentSegment.startTime),
                end: formatDetailedTime(currentSegment.endTime)
              }
            : null,
          nextSegment: nextSegment
            ? {
                id: nextSegment.id,
                start: formatDetailedTime(nextSegment.startTime),
                end: formatDetailedTime(nextSegment.endTime)
              }
            : null
        });

        return;
      }
    };

    // Start our boundary checker
    video.addEventListener("timeupdate", checkBoundary);

    // Start playing
    video
      .play()
      .then(() => {
        setIsPlaying(true);
        setVideoInitialized(true);
        logger.debug("Playback started:", {
          from: formatDetailedTime(currentPosition),
          to: formatDetailedTime(stopTime),
          currentSegment: currentSegment
            ? {
                id: currentSegment.id,
                start: formatDetailedTime(currentSegment.startTime),
                end: formatDetailedTime(currentSegment.endTime)
              }
            : "None",
          nextSegment: nextSegment
            ? {
                id: nextSegment.id,
                start: formatDetailedTime(nextSegment.startTime),
                end: formatDetailedTime(nextSegment.endTime)
              }
            : "None"
        });
      })
      .catch((err) => {
        console.error("Error playing video:", err);
      });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault(); // Prevent default spacebar behavior (scrolling, button activation)
          handlePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (videoRef.current) {
            // Use the video element's current time directly to avoid stale state
            const newTime = Math.max(videoRef.current.currentTime - 10, 0);
            handleMobileSafeSeek(newTime);
            logger.debug('Jumped backward 10 seconds to:', formatDetailedTime(newTime));
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (videoRef.current) {
            // Use the video element's current time directly to avoid stale state
            const newTime = Math.min(videoRef.current.currentTime + 10, duration);
            handleMobileSafeSeek(newTime);
            logger.debug('Jumped forward 10 seconds to:', formatDetailedTime(newTime));
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlay, handleMobileSafeSeek, duration, videoRef]);

  return (
    <div className="bg-background min-h-screen">
      <MobilePlayPrompt videoRef={videoRef} onPlay={handlePlay} />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Video Player */}
        <VideoPlayer
          videoRef={videoRef}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          isMuted={isMuted}
          onPlayPause={handlePlay}
          onSeek={handleMobileSafeSeek}
          onToggleMute={toggleMute}
        />

        {/* Editing Tools */}
        <EditingTools
          onSplit={handleSplit}
          onReset={handleReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPlaySegments={handlePlaySegments}
          onPlay={handlePlay}
          isPlaying={isPlaying}
          isPlayingSegments={isPlayingSegments}
          canUndo={historyPosition > 0}
          canRedo={historyPosition < history.length - 1}
        />

                 {/* Timeline Header */}
                 <div className="timeline-header-container">
                     <h2 className="timeline-header-title">Trim or Split</h2>
                 </div>

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
          hasUnsavedChanges={hasUnsavedChanges}
          isIOSUninitialized={isMobile && !videoInitialized}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onPlayPause={handlePlay}
          isPlayingSegments={isPlayingSegments}
        />

        {/* Clip Segments */}
        <ClipSegments segments={clipSegments} />
      </div>
    </div>
  );
};

export default App;
