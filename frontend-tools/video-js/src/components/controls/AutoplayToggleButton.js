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
            console.log('Autoplay button initialized with saved preference:', this.isAutoplayEnabled);
        } else {
            this.isAutoplayEnabled = false;
            console.log('Autoplay button initialized with default (no userPreferences):', this.isAutoplayEnabled);
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
        console.log('AutoplayToggleButton createEl: isAutoplayEnabled =', this.isAutoplayEnabled);
        if (this.isAutoplayEnabled) {
            this.iconSpan.innerHTML = `<span style="font-size: 1.2em; color: #ff4444;">●</span>`;
            console.log('Setting RED icon (autoplay ON)');
        } else {
            this.iconSpan.innerHTML = `<span style="font-size: 1.2em; color: #ccc;">○</span>`;
            console.log('Setting GRAY icon (autoplay OFF)');
        }

        // Create control text span
        const controlTextSpan = videojs.dom.createEl('span', {
            className: 'vjs-control-text',
        });
        controlTextSpan.textContent = this.isAutoplayEnabled ? 'Autoplay is on' : 'Autoplay is off';

        // Append both spans to button
        button.appendChild(this.iconSpan);
        button.appendChild(controlTextSpan);

        return button;
    }

    updateIcon() {
        if (this.isAutoplayEnabled) {
            // Simple text icon for now
            this.iconSpan.innerHTML = `<span style=" transform: inherit !important; margin: 20px 0 0; font-size: 1.2em; color: #ff4444;"><svg width="198" height="100" viewBox="0 0 198 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="18" y="18" width="180" height="64" rx="32" fill="white"/>
<rect width="100" height="100" rx="50" fill="white"/>
<path d="M53.5714 75V25H75V75H53.5714ZM25 75V25H46.4286V75H25ZM60.7143 67.8571H67.8571V32.1429H60.7143V67.8571ZM32.1429 67.8571H39.2857V32.1429H32.1429V67.8571Z" fill="#1C1B1F"/>
</svg></span>`;
            // Only update element properties if element exists
            if (this.el()) {
                this.el().title = 'Autoplay is on';
                this.el().setAttribute('aria-label', 'Autoplay is on');
                const controlText = this.el().querySelector('.vjs-control-text');
                if (controlText) {
                    controlText.textContent = 'Autoplay is on';
                }
            }
        } else {
            // Simple text icon for now
            this.iconSpan.innerHTML = `<span style="transform: inherit !important; margin: 20px 0 0; font-size: 1.2em; color: #ccc;">
               <svg width="198" height="100" viewBox="0 0 198 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect y="18" width="180" height="64" rx="32" fill="white"/>
<rect x="98" width="100" height="100" rx="50" fill="white"/>
<path d="M129 75L168 50L129 25V75ZM136.091 61.9643V38.0357L154.705 50L136.091 61.9643Z" fill="#1C1B1F"/>
</svg></span>`;
            // Only update element properties if element exists
            if (this.el()) {
                this.el().title = 'Autoplay is off';
                this.el().setAttribute('aria-label', 'Autoplay is off');
                const controlText = this.el().querySelector('.vjs-control-text');
                if (controlText) {
                    controlText.textContent = 'Autoplay is off';
                }
            }
        }
    }

    handleClick() {
        // Toggle autoplay state
        this.isAutoplayEnabled = !this.isAutoplayEnabled;

        // Save preference if userPreferences is available
        if (this.userPreferences) {
            this.userPreferences.setAutoplayPreference(this.isAutoplayEnabled);
            console.log('Autoplay preference saved to localStorage:', this.isAutoplayEnabled);
        }

        // Update icon and accessibility attributes
        this.updateIcon();

        console.log('Autoplay toggled:', this.isAutoplayEnabled ? 'ON' : 'OFF');

        // Trigger custom event for other components to listen to
        this.player().trigger('autoplayToggle', { autoplay: this.isAutoplayEnabled });
    }

    // Method to update button state from external sources
    setAutoplayState(enabled) {
        this.isAutoplayEnabled = enabled;
        this.updateIcon();
    }
}

// Register the component
videojs.registerComponent('AutoplayToggleButton', AutoplayToggleButton);

export default AutoplayToggleButton;
