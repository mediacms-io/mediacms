import videojs from 'video.js';
import './ChapterMarkers.css';

const Component = videojs.getComponent('Component');

// Enhanced Chapter Markers Component with continuous chapter display
class ChapterMarkers extends Component {
    constructor(player, options) {
        super(player, options);
        this.on(player, 'loadedmetadata', this.updateChapterMarkers);
        this.on(player, 'texttrackchange', this.updateChapterMarkers);
        this.chaptersData = [];
        this.tooltip = null;
        this.isHovering = false;
        this.previewSprite = options.previewSprite || null;
    }

    createEl() {
        const el = super.createEl('div', {
            className: 'vjs-chapter-markers-track',
        });

        // Initialize tooltip as null - will be created when needed
        this.tooltip = null;

        return el;
    }

    updateChapterMarkers() {
        const player = this.player();
        const textTracks = player.textTracks();
        let chaptersTrack = null;

        // Find the chapters track
        for (let i = 0; i < textTracks.length; i++) {
            if (textTracks[i].kind === 'chapters') {
                chaptersTrack = textTracks[i];
                break;
            }
        }

        if (!chaptersTrack || !chaptersTrack.cues) {
            return;
        }

        // Store chapters data for tooltip lookup
        this.chaptersData = [];
        for (let i = 0; i < chaptersTrack.cues.length; i++) {
            const cue = chaptersTrack.cues[i];
            this.chaptersData.push({
                startTime: cue.startTime,
                endTime: cue.endTime,
                chapterTitle: cue.text,
            });
        }

        // Clear existing markers
        this.el().innerHTML = '';

        const duration = player.duration();
        if (!duration || duration === Infinity) {
            return;
        }

        // Create markers for each chapter
        for (let i = 0; i < chaptersTrack.cues.length; i++) {
            const cue = chaptersTrack.cues[i];
            const marker = this.createMarker(cue, duration);
            this.el().appendChild(marker);
        }

        // Setup progress bar hover for continuous chapter display
        this.setupProgressBarHover();
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

        if (!progressControl) return;

        const seekBar = progressControl.getChild('seekBar');
        if (!seekBar) return;

        const seekBarEl = seekBar.el();

        // Ensure tooltip is properly created and add to seekBar if not already added
        if (!this.tooltip || !this.tooltip.nodeType) {
            // Recreate tooltip if it's not a proper DOM node
            this.tooltip = videojs.dom.createEl('div', {
                className: 'vjs-chapter-floating-tooltip',
            });

            // Style the floating tooltip
            Object.assign(this.tooltip.style, {
                position: 'absolute',
                zIndex: '1000',
                bottom: '25px',
                transform: 'translateX(-50%)',
                display: 'none',
                minWidth: '160px',
                maxWidth: '200px',
                width: 'auto',
            });

            // Create stable DOM structure to avoid trembling
            this.chapterTitle = videojs.dom.createEl('div', {
                className: 'chapter-title',
            });
            // Object.assign(this.chapterTitle.style, {
            //     fontWeight: 'bold',
            //     marginBottom: '4px',
            //     color: '#fff',
            // });

            this.chapterInfo = videojs.dom.createEl('div', {
                className: 'chapter-info',
            });
            // Object.assign(this.chapterInfo.style, {
            //     fontSize: '11px',
            //     opacity: '0.8',
            //     marginBottom: '2px',
            // });

            this.positionInfo = videojs.dom.createEl('div', {
                className: 'position-info',
            });
            // Object.assign(this.positionInfo.style, {
            //     fontSize: '10px',
            //     opacity: '0.6',
            // });

            this.chapterImage = videojs.dom.createEl('div', {
                className: 'chapter-image-sprite',
            });
            Object.assign(this.chapterImage.style, {
                display: 'block',
                overflow: 'hidden',
            });

            // Append all elements to tooltip - duration after title, then image
            this.tooltip.appendChild(this.chapterTitle);
            this.tooltip.appendChild(this.chapterInfo);
            this.tooltip.appendChild(this.chapterImage);
            this.tooltip.appendChild(this.positionInfo);
        }

        // Add tooltip to seekBar if not already added
        if (!seekBarEl.querySelector('.vjs-chapter-floating-tooltip')) {
            try {
                seekBarEl.appendChild(this.tooltip);
            } catch {
                // console.warn('Could not append chapter tooltip:', error);
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
            this.updateChapterTooltip(e, seekBarEl, progressControlEl);
        };

        // Add event listeners to the entire progress control area (includes gray area above)
        progressControlEl.addEventListener('mouseenter', this.handleMouseEnter);
        progressControlEl.addEventListener('mouseleave', this.handleMouseLeave);
        progressControlEl.addEventListener('mousemove', this.handleMouseMove);
    }

    updateChapterTooltip(event, seekBarEl, progressControlEl) {
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

        // Find current chapter
        const currentChapter = this.findChapterAtTime(currentTime);

        if (currentChapter) {
            // Format time for display
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };

            const startTime = formatTime(currentChapter.startTime);
            const endTime = formatTime(currentChapter.endTime);
            // const timeAtPosition = formatTime(currentTime);

            // Update text content without rebuilding DOM - truncate if too long
            const truncatedTitle =
                currentChapter.chapterTitle.length > 30
                    ? currentChapter.chapterTitle.substring(0, 30) + '...'
                    : currentChapter.chapterTitle;
            this.chapterTitle.textContent = truncatedTitle;
            this.chapterInfo.textContent = `${startTime} - ${endTime}`;
            // this.positionInfo.textContent = `Position: ${timeAtPosition}`;

            // Update sprite thumbnail
            this.updateSpriteThumbnail(currentTime);
            this.chapterImage.style.display = 'block';
        } else {
            // const timeAtPosition = this.formatTime(currentTime);
            this.chapterTitle.textContent = '';
            this.chapterInfo.textContent = '';
            // this.positionInfo.textContent = `Position: ${timeAtPosition}`;

            // Still show sprite thumbnail even when not in a chapter
            this.updateSpriteThumbnail(currentTime);
            this.chapterImage.style.display = 'block';
        }

        // Position tooltip with smart boundary detection
        // Force tooltip to be visible momentarily to get accurate dimensions
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.display = 'block';

        const tooltipWidth = this.tooltip.offsetWidth || 240; // Fallback width
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

    findChapterAtTime(time) {
        for (const chapter of this.chaptersData) {
            if (time >= chapter.startTime && time < chapter.endTime) {
                return chapter;
            }
        }
        return null;
    }

    updateSpriteThumbnail(currentTime) {
        if (!this.previewSprite || !this.previewSprite.url) {
            // Hide image if no sprite data available
            this.chapterImage.style.display = 'none';
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
        this.chapterImage.style.backgroundImage = `url("${url}")`;
        this.chapterImage.style.backgroundPosition = `${xPos}px ${yPos}px`;
        this.chapterImage.style.backgroundSize = 'auto';
        this.chapterImage.style.backgroundRepeat = 'no-repeat';

        // Ensure the image is visible
        this.chapterImage.style.display = 'block';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    createMarker(cue, duration) {
        const marker = videojs.dom.createEl('div', {
            className: 'vjs-chapter-marker',
        });

        // Calculate position as percentage
        const position = (cue.startTime / duration) * 100;
        marker.style.left = position + '%';

        // Create static tooltip for chapter start points
        const tooltip = videojs.dom.createEl('div', {
            className: 'vjs-chapter-marker-tooltip',
        });
        // Truncate tooltip text if too long
        const truncatedTooltipTitle = cue.text.length > 30 ? cue.text.substring(0, 30) + '...' : cue.text;
        tooltip.textContent = truncatedTooltipTitle;
        marker.appendChild(tooltip);

        // Add click handler to jump to chapter
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            this.player().currentTime(cue.startTime);
        });

        // Make marker interactive
        marker.style.pointerEvents = 'auto';
        marker.style.cursor = 'pointer';

        return marker;
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

// Register the chapter markers component
videojs.registerComponent('ChapterMarkers', ChapterMarkers);

export default ChapterMarkers;
