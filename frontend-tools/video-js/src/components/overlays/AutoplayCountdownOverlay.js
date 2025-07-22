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
        this.countdownInterval = null;
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
        const nextVideoThumbnail = this.nextVideoData?.thumbnail || '';

        overlay.innerHTML = `
            <div class="autoplay-countdown-content">
                <div class="autoplay-countdown-header">
                    <h3>Up next in <span class="countdown-timer">${this.countdownSeconds}</span></h3>
                </div>
                
                <div class="autoplay-countdown-video-info">
                    ${
                        nextVideoThumbnail
                            ? `<div class="next-video-thumbnail">
                        <img src="${nextVideoThumbnail}" alt="${nextVideoTitle}" />
                    </div>`
                            : ''
                    }
                    <div class="next-video-details">
                        <h4 class="next-video-title">${nextVideoTitle}</h4>
                        ${this.nextVideoData?.author ? `<p class="next-video-author">${this.nextVideoData.author}</p>` : ''}
                        ${this.nextVideoData?.duration ? `<p class="next-video-duration">${this.formatDuration(this.nextVideoData.duration)}</p>` : ''}
                    </div>
                </div>

                <div class="autoplay-countdown-actions">
                    <button class="autoplay-play-button" type="button">
                        <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Play Now
                    </button>
                    <button class="autoplay-cancel-button" type="button">
                        <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                        Cancel
                    </button>
                </div>
            </div>
        `;

        // Add event listeners with explicit binding
        const playButton = overlay.querySelector('.autoplay-play-button');
        const cancelButton = overlay.querySelector('.autoplay-cancel-button');

        if (playButton) {
            playButton.addEventListener('click', (e) => {
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

        // Initially hide the overlay
        overlay.style.display = 'none';

        return overlay;
    }

    startCountdown() {
        this.isActive = true;
        this.currentCountdown = this.countdownSeconds;
        this.show();
        this.updateCountdownDisplay();

        // Start countdown interval
        this.countdownInterval = setInterval(() => {
            this.currentCountdown--;
            this.updateCountdownDisplay();

            if (this.currentCountdown <= 0) {
                this.stopCountdown();
                // Auto-play next video when countdown reaches 0
                this.handlePlayNext();
            }
        }, 1000);

        console.log('Autoplay countdown started:', this.countdownSeconds, 'seconds');
    }

    stopCountdown() {
        this.isActive = false;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.hide();
        console.log('Autoplay countdown stopped');
    }

    updateCountdownDisplay() {
        const timerElement = this.el().querySelector('.countdown-timer');
        if (timerElement) {
            timerElement.textContent = this.currentCountdown;
        }
    }

    handlePlayNext() {
        console.log('Autoplay: Playing next video immediately');
        try {
            this.stopCountdown();
            this.onPlayNext();
        } catch (error) {
            console.error('Error in handlePlayNext:', error);
        }
    }

    handleCancel() {
        console.log('Autoplay: Cancelled by user');
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
            // Add animation class for smooth entrance
            this.el().classList.add('autoplay-countdown-show');
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
            const nextVideoThumbnail = this.nextVideoData?.thumbnail || '';

            const videoInfoElement = this.el().querySelector('.autoplay-countdown-video-info');
            if (videoInfoElement) {
                videoInfoElement.innerHTML = `
                    ${
                        nextVideoThumbnail
                            ? `<div class="next-video-thumbnail">
                        <img src="${nextVideoThumbnail}" alt="${nextVideoTitle}" />
                    </div>`
                            : ''
                    }
                    <div class="next-video-details">
                        <h4 class="next-video-title">${nextVideoTitle}</h4>
                        ${this.nextVideoData?.author ? `<p class="next-video-author">${this.nextVideoData.author}</p>` : ''}
                        ${this.nextVideoData?.duration ? `<p class="next-video-duration">${this.formatDuration(this.nextVideoData.duration)}</p>` : ''}
                    </div>
                `;
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
