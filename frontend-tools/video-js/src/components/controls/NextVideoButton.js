import videojs from 'video.js';
import PlayerConfig from '../../config/playerConfig';
// import './NextVideoButton.css';

const Button = videojs.getComponent('Button');

// Custom Next Video Button Component using modern Video.js API
class NextVideoButton extends Button {
    constructor(player, options) {
        super(player, options);
        // this.nextLink = options.nextLink || '';
        // Check if this is a touch device
        const isTouchDevice =
            options.isTouchDevice ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;

        // Store the appropriate font size based on device type
        this.iconSize = isTouchDevice ? PlayerConfig.controlBar.mobileFontSize : PlayerConfig.controlBar.fontSize;
    }

    createEl() {
        // Create button element directly without wrapper div
        const button = videojs.dom.createEl('button', {
            className: 'vjs-next-video-button vjs-control vjs-button',
            type: 'button',
            'aria-label': 'Next Video',
            'aria-disabled': 'false',
        });
        button.style.width = '2.5em';

        // Create the icon placeholder span (Video.js standard structure)
        const iconPlaceholder = videojs.dom.createEl('span', {
            className: 'vjs-icon-placeholder',
            'aria-hidden': 'true',
        });

        // Create control text span (Video.js standard structure)
        const controlTextSpan = videojs.dom.createEl('span', {
            className: 'vjs-control-text',
            'aria-live': 'polite',
        });
        controlTextSpan.textContent = 'Next Video';

        // Create custom icon span with SVG
        const customIconSpan = videojs.dom.createEl('span');
        setTimeout(() => {
            customIconSpan.innerHTML = `
            <svg width="${this.iconSize}" height="${this.iconSize}" viewBox="14 14 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 34L28.1667 24L14 14V34ZM30.6667 14V34H34V14H30.6667Z" fill="currentColor"></path>
            </svg>`;
        }, 0);

        // Append spans to button in Video.js standard order
        button.appendChild(iconPlaceholder);
        button.appendChild(controlTextSpan);
        button.appendChild(customIconSpan);

        // Add touch tooltip support
        this.addTouchTooltipSupport(button);

        return button;
    }

    // Add touch tooltip support for mobile devices
    addTouchTooltipSupport(button) {
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

                // Only show tooltip for quick taps (not swipes)
                if (touchDuration < 300) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Show tooltip briefly
                    button.classList.add('touch-tooltip-active');

                    // Clear any existing timeout
                    if (tooltipTimeout) {
                        clearTimeout(tooltipTimeout);
                    }

                    // Hide tooltip after delay
                    tooltipTimeout = setTimeout(() => {
                        button.classList.remove('touch-tooltip-active');
                    }, 2000);
                }
            },
            { passive: false }
        );
    }

    handleClick() {
        this.player().trigger('nextVideo');
    }
}

// Register the component
videojs.registerComponent('NextVideoButton', NextVideoButton);

export default NextVideoButton;
