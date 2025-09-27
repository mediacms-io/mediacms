import videojs from 'video.js';
import autoPlayIconUrl from '../../assets/icons/autoplay-video-js-play.svg';
import autoPauseIconUrl from '../../assets/icons/autoplay-video-js-pause.svg';

const Button = videojs.getComponent('Button');

// Custom Autoplay Toggle Button Component using modern Video.js API
class AutoplayToggleButton extends Button {
    constructor(player, options) {
        super(player, options);
        this.userPreferences = options.userPreferences;
        // Get autoplay preference from localStorage, default to false if not set
        if (this.userPreferences) {
            const savedAutoplay = this.userPreferences.getPreference('autoplay');
            this.isAutoplayEnabled = savedAutoplay === true; // Explicit boolean check
        } else {
            this.isAutoplayEnabled = false;
        }

        // Bind methods
        this.updateIcon = this.updateIcon.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    createEl() {
        const button = super.createEl('button', {
            className: 'vjs-autoplay-toggle vjs-control vjs-button',
            type: 'button',
            title: this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off',
            'aria-label': this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off',
        });

        // Create simple text-based icon for now to ensure it works
        this.iconSpan = videojs.dom.createEl('span', {
            'aria-hidden': 'true',
            className: 'vjs-autoplay-icon',
        });

        // Set initial icon state directly
        if (this.isAutoplayEnabled) {
            this.iconSpan.innerHTML = `<img src="${autoPauseIconUrl}" alt="Autoplay on" style="width: 26px; height: 26px;" />`;
        } else {
            this.iconSpan.innerHTML = `<img src="${autoPlayIconUrl}" alt="Autoplay off" style="width: 26px; height: 26px;" />`;
        }

        // Create control text span
        const controlTextSpan = videojs.dom.createEl('span', {
            className: 'vjs-control-text',
        });
        controlTextSpan.textContent = this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off';

        // Append both spans to button
        button.appendChild(this.iconSpan);
        button.appendChild(controlTextSpan);

        // Add touch support for mobile tooltips
        this.addTouchSupport(button);

        return button;
    }

    updateIcon() {
        // Add transition and start fade-out
        this.iconSpan.style.transition = 'opacity 0.1s ease';
        this.iconSpan.style.opacity = '0';

        // After fade-out complete, update innerHTML and fade back in
        setTimeout(() => {
            if (this.isAutoplayEnabled) {
                this.iconSpan.innerHTML = `<img src="${autoPauseIconUrl}" alt="Autoplay on" style="width: 26px; height: 26px;" />`;
                if (this.el()) {
                    this.el().title = 'Autoplay is on';
                    this.el().setAttribute('aria-label', 'Autoplay is on');
                    const controlText = this.el().querySelector('.vjs-control-text');
                    if (controlText) controlText.textContent = 'Autoplay is on';
                }
            } else {
                this.iconSpan.innerHTML = `<img src="${autoPlayIconUrl}" alt="Autoplay off" style="width: 26px; height: 26px;" />`;
                if (this.el()) {
                    this.el().title = 'Autoplay is off';
                    this.el().setAttribute('aria-label', 'Autoplay is off');
                    const controlText = this.el().querySelector('.vjs-control-text');
                    if (controlText) controlText.textContent = 'Autoplay is off';
                }
            }

            // Fade back in
            this.iconSpan.style.opacity = '1';
        }, 100);
    }

    handleClick() {
        // Toggle autoplay state
        this.isAutoplayEnabled = !this.isAutoplayEnabled;

        // Save preference if userPreferences is available
        if (this.userPreferences) {
            this.userPreferences.setAutoplayPreference(this.isAutoplayEnabled);
        }

        // Update icon and accessibility attributes
        this.updateIcon();

        // Trigger custom event for other components to listen to
        this.player().trigger('autoplayToggle', { autoplay: this.isAutoplayEnabled });
    }

    // Method to update button state from external sources
    setAutoplayState(enabled) {
        this.isAutoplayEnabled = enabled;
        this.updateIcon();
    }

    // Add touch support for mobile tooltips
    addTouchSupport(button) {
        // Check if device is touch-enabled
        const isTouchDevice =
            this.options_.isTouchDevice ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;

        // Only add touch tooltip support on actual touch devices
        if (!isTouchDevice) {
            return;
        }

        let touchStartTime = 0;
        let touchHandled = false;

        // Touch start
        button.addEventListener(
            'touchstart',
            (e) => {
                touchStartTime = Date.now();
                touchHandled = false;
            },
            { passive: true }
        );

        // Touch end
        button.addEventListener(
            'touchend',
            (e) => {
                const touchDuration = Date.now() - touchStartTime;

                // Only show tooltip for quick taps (not swipes) and only on mobile screens
                const isMobileScreen = window.innerWidth <= 767;
                if (touchDuration < 500 && isMobileScreen) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Show tooltip briefly
                    button.classList.add('touch-active');
                    touchHandled = true;

                    // Hide tooltip after shorter delay on mobile
                    setTimeout(() => {
                        button.classList.remove('touch-active');
                    }, 1500);
                }
            },
            { passive: false }
        );
    }
}

// Register the component
videojs.registerComponent('AutoplayToggleButton', AutoplayToggleButton);

export default AutoplayToggleButton;
