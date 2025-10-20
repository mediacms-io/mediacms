import videojs from 'video.js';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class CustomRemainingTime extends Component {
    constructor(player, options) {
        super(player, options);

        // Bind methods to ensure correct 'this' context
        this.updateContent = this.updateContent.bind(this);

        // Set up event listeners
        this.on(player, 'timeupdate', this.updateContent);
        this.on(player, 'durationchange', this.updateContent);
        this.on(player, 'loadedmetadata', this.updateContent);

        // Store custom options
        this.options_ = {
            displayNegative: false,
            customPrefix: '',
            customSuffix: '',
            ...options,
        };
    }

    /**
     * Create the component's DOM element
     */
    createEl() {
        const el = videojs.dom.createEl('div', {
            className: 'vjs-remaining-time vjs-time-control vjs-control',
        });

        // Add ARIA accessibility
        el.innerHTML = `
            <span class="vjs-remaining-time-display" role="timer" aria-live="off">0:00 / 0:00</span>
        `;

        return el;
    }

    /**
     * Add touch tooltip support for mobile devices
     */
    addTouchTooltipSupport(element) {
        // Check if device is touch-enabled
        const isTouchDevice =
            'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

        // Only add touch tooltip support on actual touch devices
        if (!isTouchDevice) {
            return;
        }

        let touchStartTime = 0;
        let tooltipTimeout = null;

        // Touch start
        element.addEventListener(
            'touchstart',
            () => {
                touchStartTime = Date.now();
            },
            { passive: true }
        );

        // Touch end
        element.addEventListener(
            'touchend',
            (e) => {
                const touchDuration = Date.now() - touchStartTime;

                // Only show tooltip for quick taps (not swipes)
                if (touchDuration < 300) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Show tooltip briefly
                    element.classList.add('touch-tooltip-active');

                    // Clear any existing timeout
                    if (tooltipTimeout) {
                        clearTimeout(tooltipTimeout);
                    }

                    // Hide tooltip after delay
                    tooltipTimeout = setTimeout(() => {
                        element.classList.remove('touch-tooltip-active');
                    }, 2000);
                }
            },
            { passive: false }
        );
    }

    /**
     * Update the time display
     */
    updateContent() {
        const player = this.player();
        const currentTime = player.currentTime();
        const duration = player.duration();

        const display = this.el().querySelector('.vjs-remaining-time-display');

        if (display) {
            const formattedCurrentTime = this.formatTime(isNaN(currentTime) ? 0 : currentTime);
            const formattedDuration = this.formatTime(isNaN(duration) ? 0 : duration);
            display.textContent = `${formattedCurrentTime} / ${formattedDuration}`;
        }
    }

    /**
     * Format time with custom logic
     */
    formatTime(seconds) {
        const { customPrefix, customSuffix } = this.options_;

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        let timeString;
        if (hours > 0) {
            timeString = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        return `${customPrefix}${timeString}${customSuffix}`;
    }

    /**
     * Component disposal cleanup
     */
    dispose() {
        // Clean up any additional resources if needed
        super.dispose();
    }
}

// Set component name for Video.js
CustomRemainingTime.prototype.controlText_ = '';

// Register the component with Video.js
videojs.registerComponent('CustomRemainingTime', CustomRemainingTime);

export default CustomRemainingTime;
