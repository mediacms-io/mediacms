import videojs from 'video.js';

const TransientButton = videojs.getComponent('TransientButton');

class TestButton extends TransientButton {
    constructor(player, options) {
        super(player, {
            controlText: 'Test Button',
            position: ['bottom', 'right'],
            className: 'test-button',
            ...options,
        });
        this.setupVisibilityHandling();
    }

    setupVisibilityHandling() {
        // Add CSS transition for smooth fade out like control bar
        this.el().style.transition = 'opacity 0.3s ease';

        this.player().on('mouseenter', () => {
            this.showWithFade();
        });

        this.player().on('mouseleave', () => {
            // Only hide if video is playing
            setTimeout(() => {
                if (!this.player().paused()) {
                    this.hideWithFade();
                }
            }, 3000); // Hide after 3 seconds delay like control bar
        });

        // Add touch events
        this.player().on('touchstart', () => {
            this.showWithFade();
        });

        this.player().on('touchend', () => {
            // Hide after a delay to allow for interaction, but only if playing
            setTimeout(() => {
                if (!this.player().paused()) {
                    this.hideWithFade();
                }
            }, 3000); // Hide after 3 seconds delay
        });

        // Alternative: Use user activity events (recommended)
        this.player().on('useractive', () => {
            this.showWithFade();
        });

        this.player().on('userinactive', () => {
            // Only hide if video is playing
            if (!this.player().paused()) {
                this.hideWithFade();
            }
        });

        // Show when paused, hide when playing
        this.player().on('pause', () => {
            this.showWithFade();
        });

        this.player().on('play', () => {
            // Hide when playing starts, unless user is actively interacting
            if (!this.player().userActive()) {
                this.hideWithFade();
            }
        });
    }

    showWithFade() {
        this.show();
        this.el().style.opacity = '1';
        this.el().style.visibility = 'visible';
    }

    hideWithFade() {
        // Start fade out transition
        this.el().style.opacity = '0';

        // Hide element after transition completes (300ms like control bar)
        setTimeout(() => {
            if (this.el().style.opacity === '0') {
                this.hide();
            }
        }, 300);
    }

    handleClick() {
        alert('testButton - controls were hidden');
        // Add your custom functionality here
    }
}

videojs.registerComponent('TestButton', TestButton);
export default TestButton;
