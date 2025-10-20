import React, { useState, useEffect } from 'react';
import '../styles/IOSPlayPrompt.css';

interface MobilePlayPromptProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    onPlay: () => void;
}

const MobilePlayPrompt: React.FC<MobilePlayPromptProps> = ({ videoRef, onPlay }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Check if the device is mobile or Safari browser
    useEffect(() => {
        const checkIsMobile = () => {
            // More comprehensive check for mobile/tablet devices
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
                navigator.userAgent
            );
        };

        // Only show for mobile devices
        const isMobile = checkIsMobile();
        setIsVisible(isMobile);
    }, []);

    // Close the prompt when video plays
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => {
            // Just close the prompt when video plays
            setIsVisible(false);
        };

        video.addEventListener('play', handlePlay);
        return () => {
            video.removeEventListener('play', handlePlay);
        };
    }, [videoRef]);

    const handlePlayClick = () => {
        onPlay();
        // Prompt will be closed by the play event handler
    };

    if (!isVisible) return null;

    return (
        <div className="mobile-play-prompt-overlay">
            <div className="mobile-play-prompt">
                <button className="mobile-play-button" onClick={handlePlayClick}>
                    Click to start editing...
                </button>
            </div>
        </div>
    );
};

export default MobilePlayPrompt;
