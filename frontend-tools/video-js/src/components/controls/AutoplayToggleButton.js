import videojs from 'video.js';
// import './AutoplayToggleButton.css';

const Button = videojs.getComponent('Button');

// Custom Autoplay Toggle Button Component using modern Video.js API
class AutoplayToggleButton extends Button {
    constructor(player, options) {
        super(player, options);

        // Check if this is a touch device - don't create button on touch devices
        const isTouchDevice =
            options.isTouchDevice ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;

        if (isTouchDevice) {
            // Hide the button on touch devices
            this.hide();
            return;
        }

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

        // Create icon placeholder using VideoJS icon system
        this.iconSpan = videojs.dom.createEl('span', {
            'aria-hidden': 'true',
            className: 'vjs-icon-placeholder vjs-autoplay-icon',
        });

        // Set initial icon state using font icons
        this.updateIconClass();

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

    updateIconClass() {
        // Remove existing icon classes
        this.iconSpan.className = 'vjs-icon-placeholder vjs-autoplay-icon';

        // Add appropriate icon class based on state
        if (this.isAutoplayEnabled) {
            this.iconSpan.classList.add('vjs-icon-spinner');
        } else {
            this.iconSpan.classList.add('vjs-icon-play-circle');
        }
    }

    updateIcon() {
        // Add transition and start fade-out
        this.iconSpan.style.transition = 'opacity 0.1s ease';
        this.iconSpan.style.opacity = '0';

        // After fade-out complete, update icon class and fade back in
        setTimeout(() => {
            this.updateIconClass();

            if (this.el()) {
                this.el().title = this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off';
                this.el().setAttribute('aria-label', this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off');
                const controlText = this.el().querySelector('.vjs-control-text');
                if (controlText)
                    controlText.textContent = this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off';
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

        // Touch start
        button.addEventListener(
            'touchstart',
            () => {
                touchStartTime = Date.now();
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
