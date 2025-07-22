import videojs from 'video.js';

const Component = videojs.getComponent('Component');

// Custom Seek Indicator Component for showing visual feedback during arrow key seeking
class SeekIndicator extends Component {
    constructor(player, options) {
        super(player, options);
        this.seekAmount = options.seekAmount || 5; // Default seek amount in seconds
        this.showTimeout = null;
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
     * @param {string} direction - 'forward' or 'backward'
     * @param {number} seconds - Number of seconds to seek
     */
    show(direction, seconds = this.seekAmount) {
        const el = this.el();
        const iconEl = el.querySelector('.vjs-seek-indicator-icon');
        const textEl = el.querySelector('.vjs-seek-indicator-text');

        // Clear any existing timeout
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }

        // Set content based on direction - YouTube-style circular design
        if (direction === 'forward') {
            iconEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
                    <div style="
                        width: 80px; 
                        height: 80px; 
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
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
                                <path d="M8 5v14l11-7z"/>
                                <path d="M13 5v14l11-7z" opacity="0.6"/>
                            </svg>
                        </div>
                        <div style="
                            color: white; 
                            font-size: 10px; 
                            font-weight: 500; 
                            text-align: center; 
                            line-height: 1.2; 
                            opacity: 0.9; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">${seconds} seconds</div>
                    </div>
                </div>
            `;
        } else {
            iconEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; animation: youtubeSeekPulse 0.3s ease-out;">
                    <div style="
                        width: 80px; 
                        height: 80px; 
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
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="white" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));">
                                <path d="M16 19V5l-11 7z"/>
                                <path d="M11 19V5L0 12z" opacity="0.6"/>
                            </svg>
                        </div>
                        <div style="
                            color: white; 
                            font-size: 10px; 
                            font-weight: 500; 
                            text-align: center; 
                            line-height: 1.2; 
                            opacity: 0.9; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">${seconds} seconds</div>
                    </div>
                </div>
            `;
        }

        // Clear any text content in the text element
        textEl.textContent = '';

        // Force show the element with YouTube-style positioning
        el.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: none !important;
            width: auto !important;
            height: auto !important;
        `;

        // Auto-hide after 1 second
        this.showTimeout = setTimeout(() => {
            this.hide();
        }, 1000);
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
