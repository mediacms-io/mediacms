import videojs from 'video.js';
import './SpritePreview.css';

const Component = videojs.getComponent('Component');

// Sprite Preview Component for seekbar hover thumbnails (used when no chapters exist)
class SpritePreview extends Component {
    constructor(player, options) {
        super(player, options);
        this.tooltip = null;
        this.isHovering = false;
        this.previewSprite = options.previewSprite || null;
    }

    createEl() {
        const el = super.createEl('div', {
            className: 'vjs-sprite-preview-track',
        });

        // Initialize tooltip as null - will be created when needed
        this.tooltip = null;

        return el;
    }

    setupProgressBarHover() {
        // Check if device is touch-enabled (tablet/mobile)
        const isTouchDevice =
            this.options_.isTouchDevice ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0;

        // Skip tooltip setup on touch devices
        if (isTouchDevice) {
            return;
        }

        // Try to get progress control from control bar first, then from moved location
        let progressControl = this.player().getChild('controlBar').getChild('progressControl');

        // If not found in control bar, it might have been moved to a wrapper
        if (!progressControl) {
            // Look for moved progress control in custom components
            const customComponents = this.player().customComponents || {};
            progressControl = customComponents.movedProgressControl;
        }

        if (!progressControl) {
            return;
        }

        const seekBar = progressControl.getChild('seekBar');
        if (!seekBar) return;

        const seekBarEl = seekBar.el();

        // Only setup if we have sprite data
        if (!this.previewSprite || !this.previewSprite.url) {
            return;
        }

        // Ensure tooltip is properly created and add to seekBar if not already added
        if (!this.tooltip || !this.tooltip.nodeType) {
            // Create tooltip if it's not a proper DOM node
            this.tooltip = videojs.dom.createEl('div', {
                className: 'vjs-sprite-preview-tooltip',
            });

            // Style the floating tooltip
            Object.assign(this.tooltip.style, {
                position: 'absolute',
                zIndex: '1000',
                bottom: '45px',
                transform: 'translateX(-50%)',
                display: 'none',
                minWidth: '172px',
                maxWidth: '172px',
                width: '172px',
            });

            // Create stable DOM structure
            this.spriteImage = videojs.dom.createEl('div', {
                className: 'sprite-image-preview',
            });
            Object.assign(this.spriteImage.style, {
                display: 'block',
                overflow: 'hidden',
            });

            // Append sprite image to tooltip (no time info)
            this.tooltip.appendChild(this.spriteImage);
        }

        // Add tooltip to seekBar if not already added
        if (!seekBarEl.querySelector('.vjs-sprite-preview-tooltip')) {
            try {
                seekBarEl.appendChild(this.tooltip);
            } catch (error) {
                console.warn('Could not append sprite preview tooltip:', error);
                return;
            }
        }

        // Get the progress control element for larger hover area
        const progressControlEl = progressControl.el();

        // Remove existing listeners to prevent duplicates
        progressControlEl.removeEventListener('mouseenter', this.handleMouseEnter);
        progressControlEl.removeEventListener('mouseleave', this.handleMouseLeave);
        progressControlEl.removeEventListener('mousemove', this.handleMouseMove);

        // Bind methods to preserve context
        this.handleMouseEnter = () => {
            this.isHovering = true;
            this.tooltip.style.display = 'block';
        };

        this.handleMouseLeave = () => {
            this.isHovering = false;
            this.tooltip.style.display = 'none';
        };

        this.handleMouseMove = (e) => {
            if (!this.isHovering) return;
            this.updateSpriteTooltip(e, seekBarEl, progressControlEl);
        };

        // Add event listeners to the entire progress control area
        progressControlEl.addEventListener('mouseenter', this.handleMouseEnter);
        progressControlEl.addEventListener('mouseleave', this.handleMouseLeave);
        progressControlEl.addEventListener('mousemove', this.handleMouseMove);
    }

    updateSpriteTooltip(event, seekBarEl, progressControlEl) {
        if (!this.tooltip || !this.isHovering) return;

        const duration = this.player().duration();
        if (!duration) return;

        // Calculate time position based on mouse position relative to seekBar
        const seekBarRect = seekBarEl.getBoundingClientRect();
        const progressControlRect = progressControlEl.getBoundingClientRect();

        // Use seekBar for horizontal calculation but allow vertical tolerance
        const offsetX = event.clientX - seekBarRect.left;
        const percentage = Math.max(0, Math.min(1, offsetX / seekBarRect.width));
        const currentTime = percentage * duration;

        // Position tooltip relative to progress control area
        const tooltipOffsetX = event.clientX - progressControlRect.left;

        // Update sprite thumbnail
        this.updateSpriteThumbnail(currentTime);

        // Position tooltip with smart boundary detection
        // Force tooltip to be visible momentarily to get accurate dimensions
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.display = 'block';

        const tooltipWidth = this.tooltip.offsetWidth || 172; // Fallback width matches our fixed width
        const progressControlWidth = progressControlRect.width;
        const halfTooltipWidth = tooltipWidth / 2;

        // Calculate ideal position (where mouse is)
        let idealLeft = tooltipOffsetX;

        // Check and adjust boundaries
        if (idealLeft - halfTooltipWidth < 0) {
            // Too far left - align to left edge with small margin
            idealLeft = halfTooltipWidth + 5;
        } else if (idealLeft + halfTooltipWidth > progressControlWidth) {
            // Too far right - align to right edge with small margin
            idealLeft = progressControlWidth - halfTooltipWidth - 5;
        }

        // Apply position and make visible
        this.tooltip.style.left = `${idealLeft}px`;
        this.tooltip.style.visibility = 'visible';
        this.tooltip.style.display = 'block';
    }

    updateSpriteThumbnail(currentTime) {
        if (!this.previewSprite || !this.previewSprite.url) {
            // Hide image if no sprite data available
            this.spriteImage.style.display = 'none';
            return;
        }

        const { url, frame } = this.previewSprite;
        const { width, height } = frame;

        // Calculate which frame to show based on current time
        // Use sprite interval from frame data, fallback to 10 seconds
        const frameInterval = frame.seconds || 10;

        // Calculate total frames based on video duration vs frame interval
        const videoDuration = this.player().duration();
        if (!videoDuration) return;

        const maxFrames = Math.ceil(videoDuration / frameInterval);
        let frameIndex = Math.floor(currentTime / frameInterval);

        // Clamp frameIndex to available frames to prevent showing empty areas
        frameIndex = Math.min(frameIndex, maxFrames - 1);
        frameIndex = Math.max(frameIndex, 0);

        // Frames are arranged vertically (1 column, multiple rows)
        const frameRow = frameIndex;
        const frameCol = 0;

        // Calculate background position (negative values to shift the sprite)
        const xPos = -(frameCol * width);
        const yPos = -(frameRow * height);

        // Apply sprite background
        this.spriteImage.style.backgroundImage = `url("${url}")`;
        this.spriteImage.style.backgroundPosition = `${xPos}px ${yPos}px`;
        this.spriteImage.style.backgroundSize = 'auto';
        this.spriteImage.style.backgroundRepeat = 'no-repeat';
        // Use CSS-defined dimensions (166x96) to match chapter styling
        this.spriteImage.style.width = '166px';
        this.spriteImage.style.height = '96px';

        // Ensure the image is visible
        this.spriteImage.style.display = 'block';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    dispose() {
        // Clean up event listeners
        let progressControl = this.player().getChild('controlBar')?.getChild('progressControl');

        // If not found in control bar, it might have been moved to a wrapper
        if (!progressControl) {
            const customComponents = this.player().customComponents || {};
            progressControl = customComponents.movedProgressControl;
        }

        if (progressControl) {
            const progressControlEl = progressControl.el();
            progressControlEl.removeEventListener('mouseenter', this.handleMouseEnter);
            progressControlEl.removeEventListener('mouseleave', this.handleMouseLeave);
            progressControlEl.removeEventListener('mousemove', this.handleMouseMove);
        }

        // Remove tooltip
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }

        super.dispose();
    }
}

// Register the sprite preview component
videojs.registerComponent('SpritePreview', SpritePreview);

export default SpritePreview;
