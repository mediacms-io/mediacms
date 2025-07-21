import videojs from 'video.js';

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
                text: cue.text,
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
        const progressControl = this.player().getChild('controlBar').getChild('progressControl');
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
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: '1000',
                bottom: '45px',
                transform: 'translateX(-50%)',
                display: 'none',
                minWidth: '200px',
                maxWidth: '280px',
                width: 'auto',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            });

            // Create stable DOM structure to avoid trembling
            this.chapterTitle = videojs.dom.createEl('div', {
                className: 'chapter-title',
            });
            Object.assign(this.chapterTitle.style, {
                fontWeight: 'bold',
                marginBottom: '4px',
                color: '#fff',
            });

            this.chapterInfo = videojs.dom.createEl('div', {
                className: 'chapter-info',
            });
            Object.assign(this.chapterInfo.style, {
                fontSize: '11px',
                opacity: '0.8',
                marginBottom: '2px',
            });

            this.positionInfo = videojs.dom.createEl('div', {
                className: 'position-info',
            });
            Object.assign(this.positionInfo.style, {
                fontSize: '10px',
                opacity: '0.6',
            });

            this.chapterImage = videojs.dom.createEl('div', {
                className: 'chapter-image-sprite',
            });
            Object.assign(this.chapterImage.style, {
                width: '160px',
                height: '90px',
                marginTop: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'block',
                overflow: 'hidden',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'auto',
            });

            // Append all elements to tooltip
            this.tooltip.appendChild(this.chapterTitle);
            this.tooltip.appendChild(this.chapterInfo);
            this.tooltip.appendChild(this.positionInfo);
            this.tooltip.appendChild(this.chapterImage);
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
            const timeAtPosition = formatTime(currentTime);

            // Update text content without rebuilding DOM
            this.chapterTitle.textContent = currentChapter.text;
            this.chapterInfo.textContent = `Chapter: ${startTime} - ${endTime}`;
            this.positionInfo.textContent = `Position: ${timeAtPosition}`;

            // Update sprite thumbnail
            this.updateSpriteThumbnail(currentTime);
            this.chapterImage.style.display = 'block';
        } else {
            const timeAtPosition = this.formatTime(currentTime);
            this.chapterTitle.textContent = 'No Chapter';
            this.chapterInfo.textContent = '';
            this.positionInfo.textContent = `Position: ${timeAtPosition}`;

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

        // Based on the sprite image you shared, it appears to have frames arranged vertically
        // Let's try a vertical layout first (1 column, multiple rows)
        const frameRow = frameIndex; // Each frame is on its own row
        const frameCol = 0; // Always first (and only) column

        // Calculate background position (negative values to shift the sprite)
        const xPos = -(frameCol * width);
        const yPos = -(frameRow * height);

        console.log(
            `Time: ${currentTime}s, Duration: ${this.player().duration()}s, Interval: ${frameInterval}s, Frame: ${frameIndex}/${maxFrames - 1}, Row: ${frameRow}, Col: ${frameCol}, Pos: ${xPos}px ${yPos}px, URL: ${url}`
        );

        // Apply sprite background
        this.chapterImage.style.backgroundImage = `url("${url}")`;
        this.chapterImage.style.backgroundPosition = `${xPos}px ${yPos}px`;
        this.chapterImage.style.backgroundSize = 'auto';
        this.chapterImage.style.backgroundRepeat = 'no-repeat';

        // Ensure the image is visible
        this.chapterImage.style.display = 'block';

        // Fallback: if we're beyond frame 3 (30s+), try showing frame 2 instead (20-30s frame)
        if (frameIndex >= 3 && currentTime > 30) {
            const fallbackYPos = -(2 * height); // Frame 2 (20-30s range)
            this.chapterImage.style.backgroundPosition = `${xPos}px ${fallbackYPos}px`;
            console.log(`Fallback: Using frame 2 instead of frame ${frameIndex} for time ${currentTime}s`);
        }
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
        tooltip.textContent = cue.text;
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

// Register the chapter markers component
videojs.registerComponent('ChapterMarkers', ChapterMarkers);

export default ChapterMarkers;
