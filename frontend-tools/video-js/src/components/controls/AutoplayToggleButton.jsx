import React from 'react';
import { ReactComponent as PlayIcon } from '/autoplay-video-js-play.svg';
import { ReactComponent as PauseIcon } from '/autoplay-video-js-pause.svg';

const AutoplayToggleButton = ({ isAutoplayEnabled, onToggle, className = '' }) => {
    const handleClick = () => {
        onToggle(!isAutoplayEnabled);
    };

    return (
        <button
            className={`vjs-autoplay-toggle vjs-control vjs-button ${className}`}
            type="button"
            title={isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off'}
            aria-label={isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off'}
            onClick={handleClick}
        >
            <span aria-hidden="true" className="vjs-autoplay-icon">
                {isAutoplayEnabled ? (
                    <PlayIcon style={{ width: '26px', height: '26px' }} />
                ) : (
                    <PauseIcon style={{ width: '26px', height: '26px' }} />
                )}
            </span>
            <span className="vjs-control-text">{isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off'}</span>
        </button>
    );
};

export default AutoplayToggleButton;
