import '../styles/EditingTools.css';
import { useEffect, useState } from 'react';
import logger from '@/lib/logger';

interface EditingToolsProps {
    onSplit: () => void;
    onReset: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onPlay: () => void;
    canUndo: boolean;
    canRedo: boolean;
    isPlaying?: boolean;
}

const EditingTools = ({
    onSplit,
    onReset,
    onUndo,
    onRedo,
    onPlay,
    canUndo,
    canRedo,
    isPlaying = false,
}: EditingToolsProps) => {
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth <= 640);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Handle play button click with iOS fix
    const handlePlay = () => {
        // Ensure lastSeekedPosition is used when play is clicked
        if (typeof window !== 'undefined') {
            logger.debug('Play button clicked, current lastSeekedPosition:', window.lastSeekedPosition);
        }

        // Call the original handler
        onPlay();
    };

    return (
        <div className="editing-tools-container">
            <div className="flex-container single-row">
                {/* Left side - Play buttons group */}
                <div className="button-group play-buttons-group">

                    {/* Play Preview button */}
                    {/* <button 
            className="button preview-button"
            onClick={onPreview}
            data-tooltip={isPreviewMode ? "Stop preview playback" : "Play only segments (skips gaps between segments)"}
            style={{ fontSize: '0.875rem' }}
          >
            {isPreviewMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="10" y1="15" x2="10" y2="9" />
                  <line x1="14" y1="15" x2="14" y2="9" />
                </svg>
                <span className="full-text">Stop Preview</span>
                <span className="short-text">Stop</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                <span className="full-text">Play Preview</span>
                <span className="short-text">Preview</span>
              </>
            )}
          </button> */}

                    {/* Standard Play button */}
                    <button
                        className="button play-button"
                        onClick={handlePlay}
                        data-tooltip={isPlaying ? 'Pause video' : 'Play full video'}
                        style={{ fontSize: '0.875rem' }}
                    >
                        {isPlaying ? (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="10" y1="15" x2="10" y2="9" />
                                    <line x1="14" y1="15" x2="14" y2="9" />
                                </svg>
                                <span className="full-text">Pause</span>
                                <span className="short-text">Pause</span>
                            </>
                        ) : (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polygon points="10 8 16 12 10 16 10 8" />
                                </svg>
                                <span className="full-text">Play</span>
                                <span className="short-text">Play</span>
                            </>
                        )}
                    </button>

                    {/* Segments Playback message (replaces play button during segments playback) */}
                    {/* {isPlayingSegments && !isSmallScreen && (
            <div className="segments-playback-message">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="8" />
              </svg>
              Preview Mode
            </div>
          )} */}

                    {/* Preview mode message (replaces play button) */}
                    {/* {isPreviewMode && (
            <div className="preview-mode-message">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="8" />
              </svg>
              Preview Mode
            </div>
          )} */}
                </div>

                {/* Right side - Editing tools */}
                <div className="button-group secondary">
                    <button
                        className="button"
                        aria-label="Undo"
                        data-tooltip="Undo last action"
                        disabled={!canUndo}
                        onClick={onUndo}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 14 4 9l5-5" />
                            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                        </svg>
                        <span className="button-text">Undo</span>
                    </button>
                    <button
                        className="button"
                        aria-label="Redo"
                        data-tooltip="Redo last undone action"
                        disabled={!canRedo}
                        onClick={onRedo}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="m15 14 5-5-5-5" />
                            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
                        </svg>
                        <span className="button-text">Redo</span>
                    </button>
                    <div className="divider"></div>
                    <button
                        className="button"
                        onClick={onReset}
                        data-tooltip="Reset to full video"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fillRule="evenodd"
                                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="reset-text">Reset</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditingTools;
