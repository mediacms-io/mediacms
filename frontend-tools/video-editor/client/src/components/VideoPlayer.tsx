import { useRef, useEffect } from "react";
import { formatTime } from "@/lib/timeUtils";
import '../styles/VideoPlayer.css';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMuted?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onToggleMute?: () => void;
}

const VideoPlayer = ({
  videoRef,
  currentTime,
  duration,
  isPlaying,
  isMuted = false,
  onPlayPause,
  onSeek,
  onToggleMute
}: VideoPlayerProps) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const sampleVideoUrl = typeof window !== 'undefined' && 
    (window as any).MEDIA_DATA?.videoUrl || 
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  
  // Add iOS-specific attributes to prevent fullscreen playback
  useEffect(() => {
    if (videoRef.current) {
      // These attributes need to be set directly on the DOM element
      // for iOS Safari to respect inline playback
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.setAttribute('x-webkit-airplay', 'allow');
    }
  }, [videoRef]);
  
  // Jump 10 seconds forward
  const handleForward = () => {
    onSeek(Math.min(currentTime + 10, duration));
  };

  // Jump 10 seconds backward
  const handleBackward = () => {
    onSeek(Math.max(currentTime - 10, 0));
  };
  
  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle click on progress bar
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      onSeek(duration * clickPosition);
    }
  };

  // Handle toggling fullscreen
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="video-player-container">
      <video
        ref={videoRef}
        preload="auto"
        crossOrigin="anonymous"
        onClick={onPlayPause}
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        controls={false}
        muted={isMuted}
      >
        <source src={sampleVideoUrl} type="video/mp4" />
        <p>Your browser doesn't support HTML5 video.</p>
      </video>
      
      {/* Play/Pause Indicator (shows based on current state) */}
      <div className={`play-pause-indicator ${isPlaying ? 'pause-icon' : 'play-icon'}`}></div>
      
      {/* Video Controls Overlay */}
      <div className="video-controls">
        {/* Time and Duration */}
        <div className="video-time-display">
          <span className="video-current-time">{formatTime(currentTime)}</span>
          <span className="video-duration">/ {formatTime(duration)}</span>
        </div>
        
        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className="video-progress"
          onClick={handleProgressClick}
        >
          <div 
            className="video-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          ></div>
          <div 
            className="video-scrubber"
            style={{ left: `${progressPercentage}%` }}
          ></div>
        </div>
        
        {/* Controls - Mute and Fullscreen buttons */}
        <div className="video-controls-buttons">
          {/* Mute/Unmute Button */}
          {onToggleMute && (
            <button 
              className="mute-button" 
              aria-label={isMuted ? "Unmute" : "Mute"}
              onClick={onToggleMute}
              data-tooltip={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              )}
            </button>
          )}
          
          {/* Fullscreen Button */}
          <button 
            className="fullscreen-button" 
            aria-label="Fullscreen"
            onClick={handleFullscreen}
            data-tooltip="Toggle fullscreen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
