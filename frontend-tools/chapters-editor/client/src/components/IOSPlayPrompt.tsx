import React, { useState, useEffect } from 'react';
import '../styles/IOSPlayPrompt.css';

interface MobilePlayPromptProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    onPlay: () => void;
}

const MobilePlayPrompt: React.FC<MobilePlayPromptProps> = ({ videoRef, onPlay }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Check if the device is mobile
    useEffect(() => {
        const checkIsMobile = () => {
            // More comprehensive check for mobile/tablet devices
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
                navigator.userAgent
            );
        };

        // Always show for mobile devices on each visit
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
                {/* <h3>Mobile Device Notice</h3>
        
        <p>
          For the best video editing experience on mobile devices, you need to <strong>play the video first</strong> before 
          using the timeline controls.
        </p>
        
        <div className="mobile-prompt-instructions">
          <p>Please follow these steps:</p>
          <ol>
            <li>Tap the button below to start the video</li>
            <li>After the video starts, you can pause it</li>
            <li>Then you'll be able to use all timeline controls</li>
          </ol>
        </div> */}

                <button className="mobile-play-button" onClick={handlePlayClick}>
                    Click to start editing...
                </button>
            </div>
        </div>
    );
};

export default MobilePlayPrompt;
