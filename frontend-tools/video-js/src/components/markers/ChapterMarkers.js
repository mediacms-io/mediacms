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
        const progressControl = this.player()
            .getChild('controlBar')
            .getChild('progressControl');
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
                maxWidth: '250px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            });
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
        progressControlEl.removeEventListener(
            'mouseenter',
            this.handleMouseEnter
        );
        progressControlEl.removeEventListener(
            'mouseleave',
            this.handleMouseLeave
        );
        progressControlEl.removeEventListener(
            'mousemove',
            this.handleMouseMove
        );

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
        const percentage = Math.max(
            0,
            Math.min(1, offsetX / seekBarRect.width)
        );
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

            this.tooltip.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px; color: #fff;">${currentChapter.text}</div>
                <div style="font-size: 11px; opacity: 0.8; margin-bottom: 2px;">Chapter: ${startTime} - ${endTime}</div>
                <div style="font-size: 10px; opacity: 0.6;">Position: ${timeAtPosition}</div>
            `;
        } else {
            const timeAtPosition = this.formatTime(currentTime);
            this.tooltip.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 2px;">No Chapter</div>
                <div style="font-size: 10px; opacity: 0.6;">Position: ${timeAtPosition}</div>
            `;
        }

        // Position tooltip relative to progress control container
        this.tooltip.style.left = `${tooltipOffsetX}px`;
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
        const progressControl = this.player()
            .getChild('controlBar')
            ?.getChild('progressControl');
        if (progressControl) {
            const progressControlEl = progressControl.el();
            progressControlEl.removeEventListener(
                'mouseenter',
                this.handleMouseEnter
            );
            progressControlEl.removeEventListener(
                'mouseleave',
                this.handleMouseLeave
            );
            progressControlEl.removeEventListener(
                'mousemove',
                this.handleMouseMove
            );
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
