import videojs from 'video.js';

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
        const progressControl = this.player().getChild('controlBar').getChild('progressControl');
        if (!progressControl) return;

        const seekBar = progressControl.getChild('seekBar');
        if (!seekBar) return;

        const seekBarEl = seekBar.el();

        // Only setup if we have sprite data
        if (!this.previewSprite || !this.previewSprite.url) {
            console.log('No sprite data available for preview:', this.previewSprite);
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
                minWidth: '172px', // Accommodate 166px image + 3px border on each side
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
            console.log('No sprite data available:', this.previewSprite);
            return;
        }

        const { url, frame } = this.previewSprite;
        const { width, height } = frame;

        // Calculate which frame to show based on current time
        // Use sprite interval from frame data, fallback to 10 seconds
        const frameInterval = frame.seconds || 10;

        // Try to detect total frames based on video duration vs frame interval
        const videoDuration = this.player().duration() || 45; // fallback duration
        const calculatedMaxFrames = Math.ceil(videoDuration / frameInterval);
        const maxFrames = Math.min(calculatedMaxFrames, 6); // Cap at 6 frames to be safe

        let frameIndex = Math.floor(currentTime / frameInterval);

        // Clamp frameIndex to available frames to prevent showing empty areas
        frameIndex = Math.min(frameIndex, maxFrames - 1);

        // Based on the sprite image, it appears to have frames arranged vertically
        // Let's try a vertical layout first (1 column, multiple rows)
        const frameRow = frameIndex; // Each frame is on its own row
        const frameCol = 0; // Always first (and only) column

        // Calculate background position (negative values to shift the sprite)
        const xPos = -(frameCol * width);
        const yPos = -(frameRow * height);

        console.log(
            `Sprite Preview - Time: ${currentTime}s, Duration: ${this.player().duration()}s, Interval: ${frameInterval}s, Frame: ${frameIndex}/${maxFrames - 1}, Row: ${frameRow}, Col: ${frameCol}, Pos: ${xPos}px ${yPos}px, URL: ${url}`
        );

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

        // Fallback: if we're beyond frame 3 (30s+), try showing frame 2 instead (20-30s frame)
        if (frameIndex >= 3 && currentTime > 30) {
            const fallbackYPos = -(2 * height); // Frame 2 (20-30s range)
            this.spriteImage.style.backgroundPosition = `${xPos}px ${fallbackYPos}px`;
            console.log(`Fallback: Using frame 2 instead of frame ${frameIndex} for time ${currentTime}s`);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    dispose() {
        // Clean up event listeners
        const progressControl = this.player().getChild('controlBar')?.getChild('progressControl');
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
