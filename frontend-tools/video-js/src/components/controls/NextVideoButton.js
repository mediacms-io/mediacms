import videojs from 'video.js';

const Button = videojs.getComponent('Button');

// Custom Next Video Button Component using modern Video.js API
class NextVideoButton extends Button {
    constructor(player, options) {
        super(player, options);
        // this.nextLink = options.nextLink || '';
    }

    createEl() {
        const button = super.createEl('button', {
            className: 'vjs-next-video-control vjs-control vjs-button',
            type: 'button',
            title: 'Next Video',
            'aria-label': 'Next Video',
        });

        // Create the icon span using Video.js core icon
        const iconSpan = videojs.dom.createEl('span', {
            'aria-hidden': 'true',
        });

        // Create SVG that matches Video.js icon dimensions
        iconSpan.innerHTML = `
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 34L28.1667 24L14 14V34ZM30.6667 14V34H34V14H30.6667Z" fill="currentColor"/>
        </svg>

    `;

        // Create control text span
        const controlTextSpan = videojs.dom.createEl('span', {
            className: 'vjs-control-text',
        });
        controlTextSpan.textContent = 'Next Video';

        // Append both spans to button
        button.appendChild(iconSpan);
        button.appendChild(controlTextSpan);

        return button;
    }

    handleClick() {
        this.player().trigger('nextVideo');
    }
}

// Register the component
videojs.registerComponent('NextVideoButton', NextVideoButton);

export default NextVideoButton;
