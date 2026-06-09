import videojs from 'video.js';
import './AutoplayCountdownOverlay.css';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class AutoplayCountdownOverlay extends Component {
    constructor(player, options) {
        super(player, options);

        this.nextVideoData = options.nextVideoData || null;
        this.countdownSeconds = options.countdownSeconds || 5;
        this.onPlayNext = options.onPlayNext || (() => {});
        this.onCancel = options.onCancel || (() => {});

        this.currentCountdown = this.countdownSeconds;
        this.startTime = null;
        this.isActive = false;

        // Bind methods
        this.startCountdown = this.startCountdown.bind(this);
        this.stopCountdown = this.stopCountdown.bind(this);
        this.handlePlayNext = this.handlePlayNext.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.updateCountdownDisplay = this.updateCountdownDisplay.bind(this);
    }

    createEl() {
        const overlay = super.createEl('div', {
            className: 'vjs-autoplay-countdown-overlay',
        });

        // Get next video title or fallback
        const nextVideoTitle = this.nextVideoData?.title || 'Next Video';

        overlay.innerHTML = `
            <button class="autoplay-close-button" aria-label="Cancel autoplay" title="Cancel">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="autoplay-countdown-content">
                <div class="countdown-label">Up Next</div>
                
                <div class="next-video-title">${nextVideoTitle}</div>
                ${this.nextVideoData?.author ? `<div class="next-video-author">${this.nextVideoData.author}</div>` : ''}
                
                <div class="circular-countdown">
                    <svg class="countdown-circle" viewBox="0 0 100 100" width="100" height="100">
                        <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.2)" stroke-width="3" fill="none"/>
                        <circle class="countdown-progress" cx="50" cy="50" r="45" stroke="white" stroke-width="3" fill="none" 
                                stroke-dasharray="282.74" stroke-dashoffset="282.74" transform="rotate(-90 50 50)"/>
                        <g class="play-icon">
                            <circle cx="50" cy="50" r="20" fill="rgba(255,255,255,0.9)" stroke="none"/>
                            <path d="M45 40l15 10-15 10z" fill="#000"/>
                        </g>
                    </svg>
                </div>

                <span class="autoplay-cancel-button">
                    CANCEL
                </span>
            </div>
        `;

        // Add event listeners with explicit binding
        const circularCountdown = overlay.querySelector('.circular-countdown');
        const cancelButton = overlay.querySelector('.autoplay-cancel-button');
        const closeButton = overlay.querySelector('.autoplay-close-button');

        if (circularCountdown) {
            circularCountdown.addEventListener('click', (e) => {
                e.preventDefault();
                this.handlePlayNext();
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCancel();
            });
        }

        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCancel();
            });
        }

        // Initially hide the overlay
        overlay.style.display = 'none';

        return overlay;
    }

    startCountdown() {
        this.isActive = true;
        this.currentCountdown = this.countdownSeconds;
        this.startTime = Date.now();

        // Show immediately and start countdown without delay
        this.show();
        this.updateCountdownDisplay();

        // Use requestAnimationFrame for smooth animation
        const animate = () => {
            if (!this.isActive) return;

            const elapsed = (Date.now() - this.startTime) / 1000;
            this.currentCountdown = Math.max(0, this.countdownSeconds - elapsed);
            this.updateCountdownDisplay();

            if (this.currentCountdown <= 0) {
                this.stopCountdown();
                // Auto-play next video when countdown reaches 0
                this.handlePlayNext();
            } else {
                requestAnimationFrame(animate);
            }
        };

        // Start the animation
        requestAnimationFrame(animate);
    }

    stopCountdown() {
        this.isActive = false;
        this.hide();
    }

    updateCountdownDisplay() {
        const progressCircle = this.el().querySelector('.countdown-progress');
        if (progressCircle) {
            // Calculate progress (282.74 is the circumference of the circle with radius 45)
            const circumference = 2 * Math.PI * 45; // 282.74
            const progress = (this.countdownSeconds - this.currentCountdown) / this.countdownSeconds;
            const offset = circumference - circumference * progress;

            // Apply the animation
            progressCircle.style.strokeDashoffset = offset;
        }
    }

    handlePlayNext() {
        try {
            this.stopCountdown();
            this.onPlayNext();
        } catch (error) {
            console.error('Error in handlePlayNext:', error);
        }
    }

    handleCancel() {
        try {
            this.stopCountdown();
            this.onCancel();
        } catch (error) {
            console.error('Error in handleCancel:', error);
        }
    }

    show() {
        if (this.el()) {
            this.el().style.display = 'flex';
            // Force immediate display and add animation class
            requestAnimationFrame(() => {
                if (this.el()) {
                    this.el().classList.add('autoplay-countdown-show');
                }
            });
        }
    }

    hide() {
        if (this.el()) {
            this.el().style.display = 'none';
            this.el().classList.remove('autoplay-countdown-show');
        }
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Update next video data
    updateNextVideoData(nextVideoData) {
        this.nextVideoData = nextVideoData;

        // Re-render the content if the overlay exists
        if (this.el()) {
            const nextVideoTitle = this.nextVideoData?.title || 'Next Video';
            const titleElement = this.el().querySelector('.next-video-title');
            const authorElement = this.el().querySelector('.next-video-author');

            if (titleElement) {
                titleElement.textContent = nextVideoTitle;
            }

            if (authorElement && this.nextVideoData?.author) {
                authorElement.textContent = this.nextVideoData.author;
            }
        }
    }

    // Cleanup method
    dispose() {
        this.stopCountdown();
        super.dispose();
    }
}

// Register the component
videojs.registerComponent('AutoplayCountdownOverlay', AutoplayCountdownOverlay);

export default AutoplayCountdownOverlay;
