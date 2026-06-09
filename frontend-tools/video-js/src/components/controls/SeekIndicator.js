import videojs from 'video.js';
// import './SeekIndicator.css';

const Component = videojs.getComponent('Component');

// Custom Seek Indicator Component for showing visual feedback during arrow key seeking
class SeekIndicator extends Component {
    constructor(player, options) {
        super(player, options);
        this.seekAmount = options.seekAmount || 5; // Default seek amount in seconds
        this.isEmbedPlayer = options.isEmbedPlayer || false; // Store embed mode flag
        this.showTimeout = null;

        // Detect touch devices - if touch is supported, native browser controls will handle icons
        this.isTouchDevice = this.detectTouchDevice();
    }

    /**
     * Detect if the device supports touch
     * @returns {boolean} True if touch is supported
     */
    detectTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }

    createEl() {
        const el = super.createEl('div', {
            className: 'vjs-seek-indicator',
        });

        // Create the indicator content
        el.innerHTML = `
            <div class="vjs-seek-indicator-content">
                <div class="vjs-seek-indicator-icon"></div>
                <div class="vjs-seek-indicator-text"></div>
            </div>
        `;

        // Initially hide the indicator completely
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.visibility = 'hidden';

        return el;
    }

    /**
     * Show seek indicator with direction and amount
     * @param {string} direction - 'forward', 'backward', 'play', or 'pause'
     * @param {number} seconds - Number of seconds to seek (only used for forward/backward)
     */
    show(direction, seconds = this.seekAmount) {
        // Skip showing icons on touch devices as native browser controls handle them
        /*       if (this.isTouchDevice) {
            return;
        } */

        const el = this.el();
        const iconEl = el.querySelector('.vjs-seek-indicator-icon');
        const textEl = el.querySelector('.vjs-seek-indicator-text');

        // Clear any existing timeout
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }

        // Get responsive size based on screen width for all directions
        const isMobile = window.innerWidth <= 480;
        const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;

        let circleSize, iconSize, textSize;
        if (isMobile) {
            circleSize = '50px';
            iconSize = '20';
            textSize = '8px';
        } else if (isTablet) {
            circleSize = '60px';
            iconSize = '22';
            textSize = '9px';
        } else {
            circleSize = '80px';
            iconSize = '24';
            textSize = '10px';
        }

        // Set content based on direction - YouTube-style circular design
        if (direction === 'forward') {
            iconEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
                    <div style="
                        width: ${circleSize}; 
                        height: ${circleSize}; 
                        border-radius: 50%; 
                        background: rgba(0, 0, 0, 0.3); 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center;
                        border: none;
                        outline: none;
                        box-sizing: border-box;
                        overflow: hidden;
                        -webkit-border-radius: 50%;
                        -moz-border-radius: 50%;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                            <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
                                <path d="M8 5v14l11-7z"/>
                                <path d="M13 5v14l11-7z" opacity="0.6"/>
                            </svg>
                        </div>
                        <div style="
                            color: white; 
                            font-size: ${textSize}; 
                            font-weight: 500; 
                            text-align: center; 
                            line-height: 1.2; 
                            opacity: 0.9; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">${seconds} seconds</div>
                    </div>
                </div>
            `;
        } else if (direction === 'backward') {
            iconEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
                    <div style="
                        width: ${circleSize};
                        height: ${circleSize};
                        border-radius: 50%;
                        background: rgba(0, 0, 0, 0.3);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        border: none;
                        outline: none;
                        box-sizing: border-box;
                        overflow: hidden;
                        -webkit-border-radius: 50%;
                        -moz-border-radius: 50%;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                            <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
                                <path d="M16 19V5l-11 7z"/>
                                <path d="M11 19V5L0 12z" opacity="0.6"/>
                            </svg>
                        </div>
                        <div style="
                            color: white; 
                            font-size: ${textSize}; 
                            font-weight: 500; 
                            text-align: center; 
                            line-height: 1.2; 
                            opacity: 0.9; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">${seconds} seconds</div>
                    </div>
                </div>
            `;
        } else if (direction === 'play') {
            iconEl.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
      <div style="
          width: ${circleSize};
          height: ${circleSize};
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          outline: none;
          box-sizing: border-box;
          overflow: hidden;
      ">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
  `;
            textEl.textContent = 'Play';
        } else if (direction === 'pause' || direction === 'pause-mobile') {
            iconEl.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
      <div style="
          width: ${circleSize};
          height: ${circleSize};
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          outline: none;
          box-sizing: border-box;
          overflow: hidden;
      ">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      </div>
    </div>
  `;
            textEl.textContent = 'Pause';
        } else if (direction === 'copy-url') {
            iconEl.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
      <div style="
          width: ${circleSize};
          height: ${circleSize};
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          outline: none;
          box-sizing: border-box;
          overflow: hidden;
      ">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    </div>
  `;
            textEl.textContent = '';
        } else if (direction === 'copy-embed') {
            iconEl.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
      <div style="
          width: ${circleSize};
          height: ${circleSize};
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          outline: none;
          box-sizing: border-box;
          overflow: hidden;
      ">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
          <path d="M16 18l6-6-6-6"/>
          <path d="M8 6l-6 6 6 6"/>
        </svg>
      </div>
    </div>
  `;
            textEl.textContent = '';
        }

        // Clear any text content in the text element
        textEl.textContent = '';

        // Position relative to video player container, not viewport
        el.style.cssText = `
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 10000 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: none !important;
                width: auto !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
            `;

        // Auto-hide timing based on action type
        if (direction === 'forward' || direction === 'backward') {
            // Seek operations: 1 second
            this.showTimeout = setTimeout(() => {
                this.hide();
            }, 1000);
        } else if (direction === 'play' || direction === 'pause' || direction === 'pause-mobile') {
            // Play/pause operations: 500ms
            this.showTimeout = setTimeout(() => {
                this.hide();
            }, 500);
        } else if (direction === 'copy-url' || direction === 'copy-embed') {
            // Copy operations: 500ms (same as play/pause)
            this.showTimeout = setTimeout(() => {
                this.hide();
            }, 500);
        }
    }

    /**
     * Show pause icon for mobile (uses 500ms from main show method)
     */
    showMobilePauseIcon() {
        // Skip showing icons on touch devices as native browser controls handle them
        if (this.isTouchDevice) {
            return;
        }

        this.show('pause-mobile'); // This will auto-hide after 500ms

        // Make the icon clickable for mobile
        const el = this.el();
        el.style.pointerEvents = 'auto !important';

        // Add click handler for the center icon
        const handleCenterIconClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.player().paused()) {
                this.player().play();
            } else {
                this.player().pause();
            }

            // Hide immediately after click
            this.hide();
        };

        el.addEventListener('click', handleCenterIconClick);
        el.addEventListener('touchend', handleCenterIconClick);

        // Store handlers for cleanup
        this.mobileClickHandler = handleCenterIconClick;
    }

    /**
     * Hide mobile pause icon and clean up
     */
    hideMobileIcon() {
        const el = this.el();

        // Remove click handlers
        const allClickHandlers = el.cloneNode(true);
        el.parentNode.replaceChild(allClickHandlers, el);

        // Reset pointer events
        allClickHandlers.style.pointerEvents = 'none !important';

        // Hide the icon
        this.hide();

        // Clear timeout
        if (this.mobileTimeout) {
            clearTimeout(this.mobileTimeout);
            this.mobileTimeout = null;
        }
    }

    /**
     * Hide the seek indicator
     */
    hide() {
        const el = this.el();
        el.style.opacity = '0';

        setTimeout(() => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
        }, 200); // Wait for fade out animation

        // Clear any existing timeout
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }

        // Clean up mobile click handlers if they exist
        if (this.mobileClickHandler) {
            el.removeEventListener('click', this.mobileClickHandler);
            el.removeEventListener('touchend', this.mobileClickHandler);
            this.mobileClickHandler = null;
        }

        // Reset pointer events
        el.style.pointerEvents = 'none !important';
    }

    /**
     * Clean up when component is disposed
     */
    dispose() {
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }
        super.dispose();
    }
}

// Register the component with Video.js
videojs.registerComponent('SeekIndicator', SeekIndicator);

export default SeekIndicator;
