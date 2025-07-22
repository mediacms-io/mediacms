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
        <svg viewBox="0 0 24 24" width="2em" height="2em" fill="currentColor" style="position: relative; top: 3px; left: 8px; right: 0; bottom: 0; margin: auto; cursor: pointer;">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
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
        // console.log('NextVideoButton handleClick', this.nextLink);
        this.player().trigger('nextVideo');
    }
}

// Register the component
videojs.registerComponent('NextVideoButton', NextVideoButton);

export default NextVideoButton;
