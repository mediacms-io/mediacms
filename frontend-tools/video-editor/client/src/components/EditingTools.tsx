import '../styles/EditingTools.css';

interface EditingToolsProps {
  onSplit: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onPlay: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPreviewMode?: boolean;
  isPlaying?: boolean;
}

const EditingTools = ({
  onSplit,
  onReset,
  onUndo,
  onRedo,
  onPreview,
  onPlay,
  canUndo,
  canRedo,
  isPreviewMode = false,
  isPlaying = false,
}: EditingToolsProps) => {
  return (
    <div className="editing-tools-container">
      <div className="flex-container">
        {/* Left side - Play Preview button */}
        <div className="button-group preview-group">
          <button 
            className="button preview-button"
            onClick={onPreview}
            data-tooltip={isPreviewMode ? "Pause preview playback" : "Play only segments (skips gaps between segments)"}
          >
            {isPreviewMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="10" y1="15" x2="10" y2="9" />
                  <line x1="14" y1="15" x2="14" y2="9" />
                </svg>
                Pause Preview
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Play Preview
              </>
            )}
          </button>
        </div>
        
        {/* Center - Play button */}
        <div className="button-group center-play">
          <button 
            className="button play-button"
            onClick={onPlay}
            data-tooltip={isPlaying ? "Pause video" : "Play full video"}
          >
            {isPlaying ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="10" y1="15" x2="10" y2="9" />
                  <line x1="14" y1="15" x2="14" y2="9" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Play
              </>
            )}
          </button>
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5"/>
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
            </svg>
          </button>
          <button 
            className="button"
            aria-label="Redo" 
            data-tooltip="Redo last undone action"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 14 5-5-5-5"/>
              <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>
            </svg>
          </button>
          <div className="divider"></div>
          <button 
            className="button"
            onClick={onReset}
            data-tooltip="Reset to full video"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditingTools;
