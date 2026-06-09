import React, { useRef, useEffect, useState } from 'react';
import { formatTime, formatDetailedTime } from '@/lib/timeUtils';
import { AUDIO_POSTER_URL } from '@/assets/audioPosterUrl';
import logger from '../lib/logger';
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

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isMuted = false,
    onPlayPause,
    onSeek,
    onToggleMute,
}) => {
    const progressRef = useRef<HTMLDivElement>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [lastPosition, setLastPosition] = useState<number | null>(null);
    const [isDraggingProgress, setIsDraggingProgress] = useState(false);
    const isDraggingProgressRef = useRef(false);
    const [tooltipPosition, setTooltipPosition] = useState({
        x: 0,
    });
    const [tooltipTime, setTooltipTime] = useState(0);

    const sampleVideoUrl =
        (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.videoUrl) || '/videos/sample-video.mp3';

    // Check if the media is an audio file
    const isAudioFile = sampleVideoUrl.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) !== null;
    
    // Get posterUrl from MEDIA_DATA, or use audio-poster.jpg as fallback for audio files when posterUrl is empty, null, or "None"
    const mediaPosterUrl = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.posterUrl) || '';
    const isValidPoster = mediaPosterUrl && mediaPosterUrl !== 'None' && mediaPosterUrl.trim() !== '';
    const posterImage = isValidPoster ? mediaPosterUrl : (isAudioFile ? AUDIO_POSTER_URL : undefined);

    // Detect iOS device and Safari browser
    useEffect(() => {
        const checkIOS = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        };

        const checkSafari = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            return /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
        };

        setIsIOS(checkIOS());
        
        // Store Safari detection globally for other components
        if (typeof window !== 'undefined') {
            (window as any).isSafari = checkSafari();
        }

        // Check if video was previously initialized
        if (typeof window !== 'undefined') {
            const wasInitialized = localStorage.getItem('video_initialized') === 'true';
            setHasInitialized(wasInitialized);
        }
    }, []);

    // Update initialized state when video plays
    useEffect(() => {
        if (isPlaying && !hasInitialized) {
            setHasInitialized(true);
            if (typeof window !== 'undefined') {
                localStorage.setItem('video_initialized', 'true');
            }
        }
    }, [isPlaying, hasInitialized]);

    // Add iOS-specific attributes to prevent fullscreen playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // These attributes need to be set directly on the DOM element
        // for iOS Safari to respect inline playback
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x-webkit-airplay', 'allow');

        // Store the last known good position for iOS
        const handleTimeUpdate = () => {
            if (!isDraggingProgressRef.current) {
                setLastPosition(video.currentTime);
                if (typeof window !== 'undefined') {
                    window.lastSeekedPosition = video.currentTime;
                }
            }
        };

        // Handle iOS-specific play/pause state
        const handlePlay = () => {
            logger.debug('Video play event fired');
            if (isIOS) {
                setHasInitialized(true);
                localStorage.setItem('video_initialized', 'true');
            }
        };

        const handlePause = () => {
            logger.debug('Video pause event fired');
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
        };
    }, [videoRef, isIOS, isDraggingProgressRef]);

    // Save current time to lastPosition when it changes (from external seeking)
    useEffect(() => {
        setLastPosition(currentTime);
    }, [currentTime]);

    // Jump 10 seconds forward
    const handleForward = () => {
        const newTime = Math.min(currentTime + 10, duration);
        onSeek(newTime);
        setLastPosition(newTime);
    };

    // Jump 10 seconds backward
    const handleBackward = () => {
        const newTime = Math.max(currentTime - 10, 0);
        onSeek(newTime);
        setLastPosition(newTime);
    };

    // Calculate progress percentage
    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Handle start of progress bar dragging
    const handleProgressDragStart = (e: React.MouseEvent) => {
        e.preventDefault();

        setIsDraggingProgress(true);
        isDraggingProgressRef.current = true;

        // Get initial position
        handleProgressDrag(e);

        // Set up document-level event listeners for mouse movement and release
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (isDraggingProgressRef.current) {
                handleProgressDrag(moveEvent);
            }
        };

        const handleMouseUp = () => {
            setIsDraggingProgress(false);
            isDraggingProgressRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle progress dragging for both mouse and touch events
    const handleProgressDrag = (e: MouseEvent | React.MouseEvent) => {
        if (!progressRef.current) return;

        const rect = progressRef.current.getBoundingClientRect();
        const clickPosition = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = duration * clickPosition;

        // Update tooltip position and time
        setTooltipPosition({
            x: e.clientX,
        });
        setTooltipTime(seekTime);

        // Store position locally for iOS Safari - critical for timeline seeking
        setLastPosition(seekTime);

        // Also store globally for integration with other components
        if (typeof window !== 'undefined') {
            (window as any).lastSeekedPosition = seekTime;
        }

        onSeek(seekTime);
    };

    // Handle touch events for progress bar
    const handleProgressTouchStart = (e: React.TouchEvent) => {
        if (!progressRef.current || !e.touches[0]) return;
        e.preventDefault();

        setIsDraggingProgress(true);
        isDraggingProgressRef.current = true;

        // Get initial position using touch
        handleProgressTouchMove(e);

        // Set up document-level event listeners for touch movement and release
        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (isDraggingProgressRef.current) {
                handleProgressTouchMove(moveEvent);
            }
        };

        const handleTouchEnd = () => {
            setIsDraggingProgress(false);
            isDraggingProgressRef.current = false;
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);
        };

        document.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchcancel', handleTouchEnd);
    };

    // Handle touch dragging on progress bar
    const handleProgressTouchMove = (e: TouchEvent | React.TouchEvent) => {
        if (!progressRef.current) return;

        // Get the touch coordinates
        const touch = 'touches' in e ? e.touches[0] : null;
        if (!touch) return;

        e.preventDefault(); // Prevent scrolling while dragging

        const rect = progressRef.current.getBoundingClientRect();
        const touchPosition = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        const seekTime = duration * touchPosition;

        // Update tooltip position and time
        setTooltipPosition({
            x: touch.clientX,
        });
        setTooltipTime(seekTime);

        // Store position for iOS Safari
        setLastPosition(seekTime);

        // Also store globally for integration with other components
        if (typeof window !== 'undefined') {
            (window as any).lastSeekedPosition = seekTime;
        }

        onSeek(seekTime);
    };

    // Handle click on progress bar (for non-drag interactions)
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // If we're already dragging, don't handle the click
        if (isDraggingProgress) return;

        if (progressRef.current) {
            const rect = progressRef.current.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            const seekTime = duration * clickPosition;

            // Store position locally for iOS Safari - critical for timeline seeking
            setLastPosition(seekTime);

            // Also store globally for integration with other components
            if (typeof window !== 'undefined') {
                (window as any).lastSeekedPosition = seekTime;
            }

            onSeek(seekTime);
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

    // Handle click on video to play/pause
    const handleVideoClick = () => {
        const video = videoRef.current;
        if (!video) return;

        // If the video is paused, we want to play it
        if (video.paused) {
            // For iOS Safari: Before playing, explicitly seek to the remembered position
            if (isIOS && lastPosition !== null && lastPosition > 0) {
                logger.debug('iOS: Explicitly setting position before play:', lastPosition);

                // First, seek to the position
                video.currentTime = lastPosition;

                // Use a small timeout to ensure seeking is complete before play
                setTimeout(() => {
                    if (videoRef.current) {
                        // Try to play with proper promise handling
                        videoRef.current
                            .play()
                            .then(() => {
                                logger.debug(
                                    'iOS: Play started successfully at position:',
                                    videoRef.current?.currentTime
                                );
                                onPlayPause(); // Update parent state after successful play
                            })
                            .catch((err) => {
                                console.error('iOS: Error playing video:', err);
                            });
                    }
                }, 50);
            } else {
                // Normal play (non-iOS or no remembered position)
                video
                    .play()
                    .then(() => {
                        logger.debug('Normal: Play started successfully');
                        onPlayPause(); // Update parent state after successful play
                    })
                    .catch((err) => {
                        console.error('Error playing video:', err);
                    });
            }
        } else {
            // If playing, pause and update state
            video.pause();
            onPlayPause();
        }
    };

    return (
        <div className="video-player-container">
            {/* Persistent background image for audio files (Safari fix) */}
            {isAudioFile && posterImage && (
                <div 
                    className="audio-poster-background" 
                    style={{ backgroundImage: `url(${posterImage})` }}
                    aria-hidden="true"
                />
            )}
            
            <video
                ref={videoRef}
                className={isAudioFile && posterImage ? 'audio-with-poster' : ''}
                preload="metadata"
                crossOrigin="anonymous"
                onClick={handleVideoClick}
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                controls={false}
                muted={isMuted}
                poster={posterImage}
            >
                <source src={sampleVideoUrl} type="video/mp4" />
                {/* Safari fallback for audio files */}
                <source src={sampleVideoUrl} type="audio/mp4" />
                <source src={sampleVideoUrl} type="audio/mpeg" />
                <p>Your browser doesn't support HTML5 video or audio.</p>
            </video>

            {/* iOS First-play indicator - only shown on first visit for iOS devices when not initialized */}
            {isIOS && !hasInitialized && !isPlaying && (
                <div className="ios-first-play-indicator">
                    <div className="ios-play-message">Tap Play to initialize video controls</div>
                </div>
            )}

            {/* Play/Pause Indicator (shows based on current state) */}
            <div className={`play-pause-indicator ${isPlaying ? 'pause-icon' : 'play-icon'}`}></div>

            {/* Video Controls Overlay */}
            <div className="video-controls">
                {/* Time and Duration */}
                <div className="video-time-display">
                    <span className="video-current-time">{formatTime(currentTime)}</span>
                    <span className="video-duration">/ {formatTime(duration)}</span>
                </div>

                {/* Progress Bar with enhanced dragging */}
                <div
                    ref={progressRef}
                    className={`video-progress ${isDraggingProgress ? 'dragging' : ''}`}
                    onClick={handleProgressClick}
                    onMouseDown={handleProgressDragStart}
                    onTouchStart={handleProgressTouchStart}
                >
                    <div
                        className="video-progress-fill"
                        style={{
                            width: `${progressPercentage}%`,
                        }}
                    ></div>
                    <div
                        className="video-scrubber"
                        style={{
                            left: `${progressPercentage}%`,
                        }}
                    ></div>

                    {/* Floating time tooltip when dragging */}
                    {isDraggingProgress && (
                        <div
                            className="video-time-tooltip"
                            style={{
                                left: `${tooltipPosition.x}px`,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            {formatDetailedTime(tooltipTime)}
                        </div>
                    )}
                </div>

                {/* Controls - Mute and Fullscreen buttons */}
                <div className="video-controls-buttons">
                    {/* Mute/Unmute Button */}
                    {onToggleMute && (
                        <button
                            className="mute-button"
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                            onClick={onToggleMute}
                            data-tooltip={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
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
                            <path
                                fillRule="evenodd"
                                d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
