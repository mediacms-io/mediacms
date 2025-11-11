import { useEffect, useState, useRef } from 'react';
import { formatTime } from '@/lib/timeUtils';
import { AUDIO_POSTER_URL } from '@/assets/audioPosterUrl';
import '../styles/IOSVideoPlayer.css';

interface IOSVideoPlayerProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    currentTime: number;
    duration: number;
}

const IOSVideoPlayer = ({ videoRef, currentTime, duration }: IOSVideoPlayerProps) => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [iosVideoRef, setIosVideoRef] = useState<HTMLVideoElement | null>(null);
    const [posterImage, setPosterImage] = useState<string | undefined>(undefined);
    const [isAudioFile, setIsAudioFile] = useState(false);

    // Refs for hold-to-continue functionality
    const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up intervals on unmount
    useEffect(() => {
        return () => {
            if (incrementIntervalRef.current) clearInterval(incrementIntervalRef.current);
            if (decrementIntervalRef.current) clearInterval(decrementIntervalRef.current);
        };
    }, []);

    // Get the video source URL from the main player
    useEffect(() => {
        let url = '';
        if (videoRef.current && videoRef.current.querySelector('source')) {
            const source = videoRef.current.querySelector('source') as HTMLSourceElement;
            if (source && source.src) {
                url = source.src;
            }
        } else {
            // Fallback to sample video if needed
            url = '/videos/sample-video.mp4';
        }
        setVideoUrl(url);

        // Check if the media is an audio file and set poster image
        const audioFile = url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) !== null;
        setIsAudioFile(audioFile);
        
        // Get posterUrl from MEDIA_DATA, or use audio-poster.jpg as fallback for audio files when posterUrl is empty, null, or "None"
        const mediaPosterUrl = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.posterUrl) || '';
        const isValidPoster = mediaPosterUrl && mediaPosterUrl !== 'None' && mediaPosterUrl.trim() !== '';
        setPosterImage(isValidPoster ? mediaPosterUrl : (audioFile ? AUDIO_POSTER_URL : undefined));
    }, [videoRef]);

    // Function to jump 15 seconds backward
    const jumpBackward15 = () => {
        if (iosVideoRef) {
            const newTime = Math.max(0, iosVideoRef.currentTime - 15);
            iosVideoRef.currentTime = newTime;
        }
    };

    // Function to jump 15 seconds forward
    const jumpForward15 = () => {
        if (iosVideoRef) {
            const newTime = Math.min(iosVideoRef.duration, iosVideoRef.currentTime + 15);
            iosVideoRef.currentTime = newTime;
        }
    };

    // Start continuous 50ms increment when button is held
    const startIncrement = (e: React.MouseEvent | React.TouchEvent) => {
        // Prevent default to avoid text selection
        e.preventDefault();

        if (!iosVideoRef) return;
        if (incrementIntervalRef.current) clearInterval(incrementIntervalRef.current);

        // First immediate adjustment
        iosVideoRef.currentTime = Math.min(iosVideoRef.duration, iosVideoRef.currentTime + 0.05);

        // Setup continuous adjustment
        incrementIntervalRef.current = setInterval(() => {
            if (iosVideoRef) {
                iosVideoRef.currentTime = Math.min(iosVideoRef.duration, iosVideoRef.currentTime + 0.05);
            }
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

        if (!iosVideoRef) return;
        if (decrementIntervalRef.current) clearInterval(decrementIntervalRef.current);

        // First immediate adjustment
        iosVideoRef.currentTime = Math.max(0, iosVideoRef.currentTime - 0.05);

        // Setup continuous adjustment
        decrementIntervalRef.current = setInterval(() => {
            if (iosVideoRef) {
                iosVideoRef.currentTime = Math.max(0, iosVideoRef.currentTime - 0.05);
            }
        }, 100);
    };

    // Stop continuous decrement
    const stopDecrement = () => {
        if (decrementIntervalRef.current) {
            clearInterval(decrementIntervalRef.current);
            decrementIntervalRef.current = null;
        }
    };

    return (
        <div className="ios-video-player-container">
            {/* Current Time / Duration Display */}
            <div className="ios-time-display mb-2">
                <span className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>

            {/* Video container with persistent background for audio files */}
            <div className="ios-video-wrapper">
                {/* Persistent background image for audio files (Safari fix) */}
                {isAudioFile && posterImage && (
                    <div 
                        className="ios-audio-poster-background" 
                        style={{ backgroundImage: `url(${posterImage})` }}
                        aria-hidden="true"
                    />
                )}
                
                {/* iOS-optimized Video Element with Native Controls */}
                <video
                    ref={(ref) => setIosVideoRef(ref)}
                    className={`w-full rounded-md ${isAudioFile && posterImage ? 'audio-with-poster' : ''}`}
                    src={videoUrl}
                    controls
                    playsInline
                    webkit-playsinline="true"
                    x-webkit-airplay="allow"
                    preload="auto"
                    crossOrigin="anonymous"
                    poster={posterImage}
                >
                    <source src={videoUrl} type="video/mp4" />
                    <p>Your browser doesn't support HTML5 video.</p>
                </video>
            </div>

            {/* iOS Video Skip Controls */}
            <div className="ios-skip-controls mt-3 flex justify-center gap-4">
                <button
                    onClick={jumpBackward15}
                    className="ios-control-btn flex items-center justify-center bg-purple-500 text-white py-2 px-4 rounded-md"
                >
                    -15s
                </button>
                <button
                    onClick={jumpForward15}
                    className="ios-control-btn flex items-center justify-center bg-purple-500 text-white py-2 px-4 rounded-md"
                >
                    +15s
                </button>
            </div>

            {/* iOS Fine Control Buttons */}
            <div className="ios-fine-controls mt-2 flex justify-center gap-4">
                <button
                    onMouseDown={startDecrement}
                    onTouchStart={startDecrement}
                    onMouseUp={stopDecrement}
                    onMouseLeave={stopDecrement}
                    onTouchEnd={stopDecrement}
                    onTouchCancel={stopDecrement}
                    className="ios-control-btn flex items-center justify-center bg-indigo-600 text-white py-2 px-4 rounded-md no-select"
                >
                    -50ms
                </button>
                <button
                    onMouseDown={startIncrement}
                    onTouchStart={startIncrement}
                    onMouseUp={stopIncrement}
                    onMouseLeave={stopIncrement}
                    onTouchEnd={stopIncrement}
                    onTouchCancel={stopIncrement}
                    className="ios-control-btn flex items-center justify-center bg-indigo-600 text-white py-2 px-4 rounded-md no-select"
                >
                    +50ms
                </button>
            </div>

            <div className="ios-note mt-2 text-xs text-gray-500">
                <p>This player uses native iOS controls for better compatibility with iOS devices.</p>
            </div>
        </div>
    );
};

export default IOSVideoPlayer;
