import videojs from 'video.js';

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
            this.iconSpan.innerHTML = `<span style="font-size: 1.2em; color: #ff4444;">●</span>`;
        } else {
            this.iconSpan.innerHTML = `<span style="font-size: 1.2em; color: #ccc;">○</span>`;
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
                this.iconSpan.innerHTML = `<span style="transform: inherit !important; margin: 20px 0 0; font-size: 1.2em; color: #ff4444;">
                <svg width="198" height="100" viewBox="0 0 198 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect y="18" width="180" height="64" rx="32" fill="white"/>
                    <rect x="98" width="100" height="100" rx="50" fill="white"/>
                    <path d="M133 69L163 50L133 31V69ZM138.455 59.0929V40.9071L152.773 50L138.455 59.0929Z" fill="#1C1B1F"/>
                </svg>
            </span>`;
                if (this.el()) {
                    this.el().title = 'Autoplay is on';
                    this.el().setAttribute('aria-label', 'Autoplay is on');
                    const controlText = this.el().querySelector('.vjs-control-text');
                    if (controlText) controlText.textContent = 'Autoplay is on';
                }
            } else {
                this.iconSpan.innerHTML = `<span style="transform: inherit !important; margin: 20px 0 0; font-size: 1.2em; color: #ccc;">
                <svg width="198" height="100" viewBox="0 0 198 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="18" y="18" width="180" height="64" rx="32" fill="white"/>
                    <rect width="100" height="100" rx="50" fill="white"/>
                    <path d="M52.1429 65V35H65V65H52.1429ZM35 65V35H47.8571V65H35ZM56.4286 60.7143H60.7143V39.2857H56.4286V60.7143ZM39.2857 60.7143H43.5714V39.2857H39.2857V60.7143Z" fill="#1C1B1F"/>
                </svg>
            </span>`;
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

                // Only show tooltip for quick taps (not swipes)
                if (touchDuration < 500) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Show tooltip
                    button.classList.add('touch-active');
                    touchHandled = true;

                    // Hide tooltip after delay
                    setTimeout(() => {
                        button.classList.remove('touch-active');
                    }, 2000);
                }
            },
            { passive: false }
        );
    }
}

// Register the component
videojs.registerComponent('AutoplayToggleButton', AutoplayToggleButton);

export default AutoplayToggleButton;
