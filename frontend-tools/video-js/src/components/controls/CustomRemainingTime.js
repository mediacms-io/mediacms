// components/controls/CustomRemainingTime.js
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
            className: 'vjs-remaining-time vjs-time-control vjs-control custom-remaining-time',
        });

        // Add ARIA accessibility
        el.innerHTML = `
            <span class="vjs-control-text" role="presentation">Time Display&nbsp;</span>
            <span class="vjs-remaining-time-display" role="presentation">0:00 / 0:00</span>
        `;

        return el;
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
     * Add click handler for additional functionality
     */
    handleClick() {
        // Example: Toggle between different time formats
        console.log('Time display clicked');
        // Could toggle between current/duration vs remaining time
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
CustomRemainingTime.prototype.controlText_ = 'Time Display';

// Register the component with Video.js
videojs.registerComponent('CustomRemainingTime', CustomRemainingTime);

export default CustomRemainingTime;
