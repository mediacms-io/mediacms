import videojs from 'video.js';
import PlayerConfig from '../../config/playerConfig';
import './AutoplayToggleButton.css';

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
        /* 
        if (isTouchDevice) {
            // Hide the button on touch devices
            this.hide();
            return;
        } */

        // Store the appropriate font size based on device type
        // PlayerConfig values are in em units, convert to pixels for SVG dimensions
        const baseFontSize = isTouchDevice ? PlayerConfig.controlBar.mobileFontSize : PlayerConfig.controlBar.fontSize;
        this.iconSize = Math.round((baseFontSize || 14) * 1.2); // Scale and default to 14em if undefined

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
        // Ensure iconSize is a valid number (defensive check)
        if (!this.iconSize || isNaN(this.iconSize)) {
            this.iconSize = 16; // Default to 16px if undefined or NaN
        }
        
        // Remove existing icon classes
        this.iconSpan.className = 'vjs-icon-placeholder vjs-svg-icon vjs-autoplay-icon__OFFF';
        this.iconSpan.style.position = 'relative';
        this.iconSpan.style.top = '2px';

        // Add appropriate icon class based on state
        // Add appropriate icon class based on state
        if (this.isAutoplayEnabled) {
            // this.iconSpan.classList.add('vjs-icon-spinner');
            this.iconSpan.innerHTML = `
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${this.iconSize + 12}" height="${this.iconSize + 12}" viewBox="0 0 300 300">
<path d="M0 0 C5.28 0.66 10.56 1.32 16 2 C11.67407494 30.83950041 -0.70166324 55.71110206 -24 74 C-47.86506837 91.08769673 -76.02581328 98.52206834 -105.125 93.8125 C-135.12151624 88.48114449 -157.27092449 72.37747882 -175 48 C-175.33 57.57 -175.66 67.14 -176 77 C-181.28 77 -186.56 77 -192 77 C-192 56.54 -192 36.08 -192 15 C-171.54 15 -151.08 15 -130 15 C-130 20.28 -130 25.56 -130 31 C-147.325 31.495 -147.325 31.495 -165 32 C-159.82225386 40.13645822 -155.56278318 46.32892007 -149 53 C-148.23945313 53.7734375 -147.47890625 54.546875 -146.6953125 55.34375 C-129.22175893 72.07252916 -106.1048424 78.80708624 -82.37109375 78.31640625 C-58.0970353 77.28060908 -37.04807338 65.00089922 -20.75390625 47.6015625 C-9.130597 33.96173371 -3.40740768 17.34680275 0 0 Z " fill="#FFFFFF  " transform="translate(216,137)"/>
<path d="M0 0 C4.65174076 0.93034815 8.20079246 2.396823 12.3605957 4.51000977 C13.08309006 4.8710379 13.80558441 5.23206604 14.54997253 5.60403442 C16.92813231 6.79415607 19.30193243 7.99271217 21.67578125 9.19140625 C23.32747078 10.02004975 24.97942673 10.84816241 26.63163757 11.67576599 C30.97273819 13.85203468 35.31018622 16.03548755 39.64691162 18.22045898 C44.07557427 20.45015317 48.5076553 22.67303021 52.93945312 24.89648438 C61.62966021 29.25765972 70.31602362 33.62643276 79 38 C79 38.66 79 39.32 79 40 C69.14617359 44.96162844 59.28913947 49.9168183 49.42792797 54.86375427 C44.84935432 57.16087773 40.27192652 59.46022616 35.69702148 61.76464844 C31.28411887 63.98736649 26.86833299 66.20425375 22.45046425 68.41708374 C20.76327244 69.26345678 19.07714036 70.11194566 17.39208031 70.96255493 C15.03651482 72.15118441 12.67733497 73.33231761 10.31713867 74.51171875 C9.61726837 74.86704681 8.91739807 75.22237488 8.19631958 75.58847046 C5.2698443 77.04233211 3.31399908 78 0 78 C0 52.26 0 26.52 0 0 Z " fill="#FFFFFF" transform="translate(101,89)"/>
<path d="M0 0 C3.93734082 1.31244694 5.13320072 3.704147 7.25 7.0625 C7.84107544 7.99654663 7.84107544 7.99654663 8.4440918 8.94946289 C17.02365138 22.89969848 21.97119979 37.76959832 24 54 C16.08 54.99 16.08 54.99 8 56 C7.731875 54.75347656 7.46375 53.50695312 7.1875 52.22265625 C3.79455275 37.20289327 -0.86894382 22.90399101 -11 11 C-9.52934075 7.41477124 -7.59934458 5.55613904 -4.5625 3.1875 C-3.78003906 2.56230469 -2.99757812 1.93710938 -2.19140625 1.29296875 C-1.10666016 0.65294922 -1.10666016 0.65294922 0 0 Z " fill="#FFFFFF" transform="translate(208,63)"/>
<path d="M0 0 C3.03852705 1.40976705 5.5939595 3.08870228 8.25 5.125 C8.95640625 5.66382812 9.6628125 6.20265625 10.390625 6.7578125 C10.92171875 7.16773437 11.4528125 7.57765625 12 8 C11.43955571 12.083237 10.15904551 14.5756721 7.8125 17.9375 C0.01687433 29.91848207 -3.33162527 42.15584402 -6 56 C-11.28 55.34 -16.56 54.68 -22 54 C-21.13158398 35.76326355 -13.18328895 13.18328895 0 0 Z " fill="#FFFFFF" transform="translate(47,63)"/>
<path d="M0 0 C1.41634833 2.83269666 1.3463005 5.47466438 1.5625 8.625 C1.64628906 9.81351563 1.73007813 11.00203125 1.81640625 12.2265625 C1.87699219 13.14179687 1.93757813 14.05703125 2 15 C-1.44710477 15.99301114 -4.89276768 16.97144628 -8.359375 17.89453125 C-19.05592132 20.79048561 -28.35317355 24.737212 -37.7109375 30.66796875 C-40 32 -40 32 -45 34 C-47.97 30.37 -50.94 26.74 -54 23 C-41.09500976 10.09500976 -18.79835248 -0.91254138 0 0 Z " fill="#FFFFFF" transform="translate(117,25)"/>
<path d="M0 0 C19.88289553 0.81154676 38.33025864 9.04911431 54 21 C53.39665691 24.70503641 51.77525763 26.85968148 49.4375 29.75 C48.79683594 30.54921875 48.15617187 31.3484375 47.49609375 32.171875 C47.00238281 32.77515625 46.50867188 33.3784375 46 34 C42.37628388 33.36101526 39.96402788 31.80037235 36.9375 29.75 C27.14097225 23.41335705 17.23151733 19.99071799 6 17 C3.66402352 16.34221393 1.33200831 15.67178412 -1 15 C-1.09038099 9.84828377 -0.84681133 5.08086796 0 0 Z " fill="#FFFFFF" transform="translate(139,25)"/>
</svg>`;
        } else {
            // this.iconSpan.classList.add('vjs-icon-play-circle');
            this.iconSpan.innerHTML = `
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${this.iconSize + 12}" height="${this.iconSize + 12}" viewBox="0 0 300 300">
<path d="M0 0 C5.28 0.66 10.56 1.32 16 2 C11.67407494 30.83950041 -0.70166324 55.71110206 -24 74 C-47.86506837 91.08769673 -76.02581328 98.52206834 -105.125 93.8125 C-135.12151624 88.48114449 -157.27092449 72.37747882 -175 48 C-175.33 57.57 -175.66 67.14 -176 77 C-181.28 77 -186.56 77 -192 77 C-192 56.54 -192 36.08 -192 15 C-171.54 15 -151.08 15 -130 15 C-130 20.28 -130 25.56 -130 31 C-147.325 31.495 -147.325 31.495 -165 32 C-159.82225386 40.13645822 -155.56278318 46.32892007 -149 53 C-148.23945313 53.7734375 -147.47890625 54.546875 -146.6953125 55.34375 C-129.22175893 72.07252916 -106.1048424 78.80708624 -82.37109375 78.31640625 C-58.0970353 77.28060908 -37.04807338 65.00089922 -20.75390625 47.6015625 C-9.130597 33.96173371 -3.40740768 17.34680275 0 0 Z " fill="#b5bac4  " transform="translate(216,137)"/>
<path d="M0 0 C4.65174076 0.93034815 8.20079246 2.396823 12.3605957 4.51000977 C13.08309006 4.8710379 13.80558441 5.23206604 14.54997253 5.60403442 C16.92813231 6.79415607 19.30193243 7.99271217 21.67578125 9.19140625 C23.32747078 10.02004975 24.97942673 10.84816241 26.63163757 11.67576599 C30.97273819 13.85203468 35.31018622 16.03548755 39.64691162 18.22045898 C44.07557427 20.45015317 48.5076553 22.67303021 52.93945312 24.89648438 C61.62966021 29.25765972 70.31602362 33.62643276 79 38 C79 38.66 79 39.32 79 40 C69.14617359 44.96162844 59.28913947 49.9168183 49.42792797 54.86375427 C44.84935432 57.16087773 40.27192652 59.46022616 35.69702148 61.76464844 C31.28411887 63.98736649 26.86833299 66.20425375 22.45046425 68.41708374 C20.76327244 69.26345678 19.07714036 70.11194566 17.39208031 70.96255493 C15.03651482 72.15118441 12.67733497 73.33231761 10.31713867 74.51171875 C9.61726837 74.86704681 8.91739807 75.22237488 8.19631958 75.58847046 C5.2698443 77.04233211 3.31399908 78 0 78 C0 52.26 0 26.52 0 0 Z " fill="#b5bac4" transform="translate(101,89)"/>
<path d="M0 0 C3.93734082 1.31244694 5.13320072 3.704147 7.25 7.0625 C7.84107544 7.99654663 7.84107544 7.99654663 8.4440918 8.94946289 C17.02365138 22.89969848 21.97119979 37.76959832 24 54 C16.08 54.99 16.08 54.99 8 56 C7.731875 54.75347656 7.46375 53.50695312 7.1875 52.22265625 C3.79455275 37.20289327 -0.86894382 22.90399101 -11 11 C-9.52934075 7.41477124 -7.59934458 5.55613904 -4.5625 3.1875 C-3.78003906 2.56230469 -2.99757812 1.93710938 -2.19140625 1.29296875 C-1.10666016 0.65294922 -1.10666016 0.65294922 0 0 Z " fill="#b5bac4" transform="translate(208,63)"/>
<path d="M0 0 C3.03852705 1.40976705 5.5939595 3.08870228 8.25 5.125 C8.95640625 5.66382812 9.6628125 6.20265625 10.390625 6.7578125 C10.92171875 7.16773437 11.4528125 7.57765625 12 8 C11.43955571 12.083237 10.15904551 14.5756721 7.8125 17.9375 C0.01687433 29.91848207 -3.33162527 42.15584402 -6 56 C-11.28 55.34 -16.56 54.68 -22 54 C-21.13158398 35.76326355 -13.18328895 13.18328895 0 0 Z " fill="#b5bac4" transform="translate(47,63)"/>
<path d="M0 0 C1.41634833 2.83269666 1.3463005 5.47466438 1.5625 8.625 C1.64628906 9.81351563 1.73007813 11.00203125 1.81640625 12.2265625 C1.87699219 13.14179687 1.93757813 14.05703125 2 15 C-1.44710477 15.99301114 -4.89276768 16.97144628 -8.359375 17.89453125 C-19.05592132 20.79048561 -28.35317355 24.737212 -37.7109375 30.66796875 C-40 32 -40 32 -45 34 C-47.97 30.37 -50.94 26.74 -54 23 C-41.09500976 10.09500976 -18.79835248 -0.91254138 0 0 Z " fill="#b5bac4" transform="translate(117,25)"/>
<path d="M0 0 C19.88289553 0.81154676 38.33025864 9.04911431 54 21 C53.39665691 24.70503641 51.77525763 26.85968148 49.4375 29.75 C48.79683594 30.54921875 48.15617187 31.3484375 47.49609375 32.171875 C47.00238281 32.77515625 46.50867188 33.3784375 46 34 C42.37628388 33.36101526 39.96402788 31.80037235 36.9375 29.75 C27.14097225 23.41335705 17.23151733 19.99071799 6 17 C3.66402352 16.34221393 1.33200831 15.67178412 -1 15 C-1.09038099 9.84828377 -0.84681133 5.08086796 0 0 Z " fill="#b5bac4" transform="translate(139,25)"/>
</svg>`;
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
