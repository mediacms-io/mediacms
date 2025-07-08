import React, { useEffect, useRef, useState, useMemo } from 'react';
import videojs from 'video.js';

// import './assets/css/mediacms-player.css';
// import './assets/css/VideoPlayer.scss';
import 'video.js/dist/video-js.css';

// Define EndScreenOverlay outside the component to avoid re-definition
const Component = videojs.getComponent('Component');

class EndScreenOverlay extends Component {
    constructor(player, options) {
        // Store relatedVideos in options before calling super
        // so it's available during createEl()
        if (options && options.relatedVideos) {
            options._relatedVideos = options.relatedVideos;
        }

        super(player, options);

        // Now set the instance property after super() completes
        this.relatedVideos =
            options && options.relatedVideos ? options.relatedVideos : [];

        // console.log(
        //     'EndScreenOverlay created with',
        //     this.relatedVideos.length,
        //     'related videos'
        // );
    }

    createEl() {
        // Get relatedVideos from options since createEl is called during super()
        const relatedVideos =
            this.options_ && this.options_._relatedVideos
                ? this.options_._relatedVideos
                : [];

        // console.log(
        //     'Creating end screen with',
        //     relatedVideos.length,
        //     'related videos'
        // );

        const overlay = super.createEl('div', {
            className: 'vjs-end-screen-overlay',
        });

        // Create grid container
        const grid = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-grid',
        });

        // Create video items
        if (
            relatedVideos &&
            Array.isArray(relatedVideos) &&
            relatedVideos.length > 0
        ) {
            relatedVideos.forEach((video) => {
                const videoItem = this.createVideoItem(video);
                grid.appendChild(videoItem);
            });
        } else {
            // Fallback message if no related videos
            const noVideos = videojs.dom.createEl('div', {
                className: 'vjs-no-related-videos',
            });
            noVideos.textContent = 'No related videos available';
            noVideos.style.color = 'white';
            noVideos.style.textAlign = 'center';
            grid.appendChild(noVideos);
        }

        overlay.appendChild(grid);

        return overlay;
    }

    createVideoItem(video) {
        const item = videojs.dom.createEl('div', {
            className: 'vjs-related-video-item',
        });

        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: video.thumbnail,
            alt: video.title,
        });

        const overlay = videojs.dom.createEl('div', {
            className: 'vjs-related-video-overlay',
        });

        const title = videojs.dom.createEl('div', {
            className: 'vjs-related-video-title',
        });
        title.textContent = video.title;

        const author = videojs.dom.createEl('div', {
            className: 'vjs-related-video-author',
        });
        author.textContent = video.author;

        const views = videojs.dom.createEl('div', {
            className: 'vjs-related-video-views',
        });
        views.textContent = video.views;

        overlay.appendChild(title);
        overlay.appendChild(author);
        overlay.appendChild(views);

        item.appendChild(thumbnail);
        item.appendChild(overlay);

        // Add click handler
        item.addEventListener('click', () => {
            window.location.href = `/view?m=${video.id}`;
        });

        return item;
    }

    show() {
        this.el().style.display = 'flex';
    }

    hide() {
        this.el().style.display = 'none';
    }
}

// Register the component once
videojs.registerComponent('EndScreenOverlay', EndScreenOverlay);

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

function VideoJS() {
    const videoRef = useRef(null);
    const playerRef = useRef(null); // Track the player instance
    // const [chapters] = useState([]); // Track chapters for display

    // Safely access window.MEDIA_DATA with fallback using useMemo
    const mediaData = useMemo(
        () =>
            typeof window !== 'undefined' && window.MEDIA_DATA
                ? window.MEDIA_DATA
                : {
                      data: {},
                      siteUrl: '',
                  },
        []
    );
    console.log('window.MEDIA_DATA hasNextLink', mediaData.hasNextLink);

    // Define chapters as JSON object
    // Note: The sample-chapters.vtt file is no longer needed as chapters are now loaded from this JSON
    const chaptersData = [
        { startTime: 0, endTime: 5, text: 'Start111' },
        { startTime: 5, endTime: 10, text: 'Introduction - EuroHPC' },
        { startTime: 10, endTime: 15, text: 'Planning - EuroHPC' },
        { startTime: 15, endTime: 20, text: 'Parcel Discounts - EuroHPC' },
        { startTime: 20, endTime: 25, text: 'Class Studies - EuroHPC' },
        { startTime: 25, endTime: 30, text: 'Sustainability - EuroHPC' },
        { startTime: 30, endTime: 35, text: 'Funding and Finance - EuroHPC' },
        { startTime: 35, endTime: 40, text: 'Virtual HPC Academy - EuroHPC' },
        { startTime: 40, endTime: 45, text: 'Wrapping up - EuroHPC' },
    ];

    // Get video data from mediaData
    const currentVideo = useMemo(
        () => ({
            id: mediaData.data?.friendly_token || 'default-video',
            title: mediaData.data?.title || 'Video',
            poster: mediaData.siteUrl + mediaData.data?.poster_url || '',
            sources: mediaData.data?.original_media_url
                ? [
                      {
                          src:
                              mediaData.siteUrl +
                              mediaData.data.original_media_url,
                          type: 'video/mp4',
                      },
                  ]
                : [
                      {
                          src: 'https://vjs.zencdn.net/v/oceans.mp4',
                          type: 'video/mp4',
                      },
                  ],
        }),
        [mediaData]
    );

    // Mock related videos data (would come from API)
    const [relatedVideos] = useState([
        {
            id: 'Otbc37Yj4',
            title: 'Amazing Ocean Depths',
            author: 'Marine Explorer',
            views: '2.1M views',
            thumbnail: 'https://picsum.photos/320/180?random=1',
            category: 'nature',
        },
        {
            id: 'Kt9m2Pv8x',
            title: 'Deep Sea Creatures',
            author: 'Aquatic Life',
            views: '854K views',
            thumbnail: 'https://picsum.photos/320/180?random=2',
            category: 'nature',
        },
        {
            id: 'Ln5q8Bw3r',
            title: 'Coral Reef Paradise',
            author: 'Ocean Films',
            views: '1.7M views',
            thumbnail: 'https://picsum.photos/320/180?random=3',
            category: 'nature',
        },
        {
            id: 'Mz4x7Cy9p',
            title: 'Underwater Adventure',
            author: 'Sea Documentaries',
            views: '3.2M views',
            thumbnail: 'https://picsum.photos/320/180?random=4',
            category: 'nature',
        },
        {
            id: 'Nx8v2Fk6w',
            title: 'Marine Wildlife',
            author: 'Nature Plus',
            views: '967K views',
            thumbnail: 'https://picsum.photos/320/180?random=5',
            category: 'nature',
        },
        {
            id: 'Py7t4Mn1q',
            title: 'Ocean Mysteries',
            author: 'Discovery Zone',
            views: '1.4M views',
            thumbnail: 'https://picsum.photos/320/180?random=6',
            category: 'nature',
        },
        {
            id: 'Qw5e8Rt2n',
            title: 'Whales and Dolphins',
            author: 'Ocean Planet',
            views: '2.8M views',
            thumbnail: 'https://picsum.photos/320/180?random=7',
            category: 'nature',
        },
        {
            id: 'Uv3k9Lp7m',
            title: 'Tropical Fish Paradise',
            author: 'Aquatic World',
            views: '1.2M views',
            thumbnail: 'https://picsum.photos/320/180?random=8',
            category: 'nature',
        },
        {
            id: 'Zx6c4Mn8b',
            title: 'Deep Ocean Exploration',
            author: 'Marine Science',
            views: '3.7M views',
            thumbnail: 'https://picsum.photos/320/180?random=9',
            category: 'nature',
        },
    ]);

    // Custom Next Video Button Component using modern Video.js API
    const Button = videojs.getComponent('Button');

    class NextVideoButton extends Button {
        constructor(player, options) {
            super(player, options);
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
            this.player().trigger('nextVideo');
        }
    }

    // Register the component
    videojs.registerComponent('NextVideoButton', NextVideoButton);

    // Function to navigate to next video (disabled for single video)
    const goToNextVideo = () => {
        // console.log('Next video functionality disabled for single video mode');
    };

    useEffect(() => {
        // Only initialize if we don't already have a player and element exists
        if (videoRef.current && !playerRef.current) {
            // Check if element is already a Video.js player
            if (videoRef.current.player) {
                // console.log('Video.js already initialized on this element');
                return;
            }

            const timer = setTimeout(() => {
                // Double-check that we still don't have a player and element exists
                if (
                    !playerRef.current &&
                    videoRef.current &&
                    !videoRef.current.player
                ) {
                    playerRef.current = videojs(videoRef.current, {
                        // ===== STANDARD <video> ELEMENT OPTIONS =====

                        // Controls whether player has user-interactive controls
                        controls: true,

                        // Player dimensions - removed for responsive design

                        // Autoplay behavior: false, true, 'muted', 'play', 'any'
                        autoplay: true,

                        // Start video over when it ends
                        loop: false,

                        // Start video muted
                        muted: false,

                        // Poster image URL displayed before video starts
                        poster: currentVideo.poster,

                        // Preload behavior: 'auto', 'metadata', 'none'
                        preload: 'auto',

                        // Video sources from current video
                        sources: currentVideo.sources,

                        // ===== VIDEO.JS-SPECIFIC OPTIONS =====

                        // Aspect ratio for fluid mode (e.g., '16:9', '4:3')
                        aspectRatio: '16:9',

                        // Hide all components except control bar for audio-only mode
                        audioOnlyMode: false,

                        // Display poster persistently for audio poster mode
                        audioPosterMode: false,

                        // Prevent autoSetup for elements with data-setup attribute
                        autoSetup: undefined,

                        // Custom breakpoints for responsive design
                        breakpoints: {
                            tiny: 210,
                            xsmall: 320,
                            small: 425,
                            medium: 768,
                            large: 1440,
                            xlarge: 2560,
                            huge: 2561,
                        },

                        // Disable picture-in-picture mode
                        disablePictureInPicture: false,

                        // Enable document picture-in-picture API
                        enableDocumentPictureInPicture: false,

                        // Enable smooth seeking experience
                        enableSmoothSeeking: false,

                        // Use experimental SVG icons instead of font icons
                        experimentalSvgIcons: false,

                        // Make player scale to fit container
                        fluid: true,

                        // Fullscreen options
                        fullscreen: {
                            options: {
                                navigationUI: 'hide',
                            },
                        },

                        // Player element ID
                        id: undefined,

                        // Milliseconds of inactivity before user considered inactive (0 = never)
                        inactivityTimeout: 2000,

                        // Language code for player (e.g., 'en', 'es', 'fr')
                        language: 'en',

                        // Custom language definitions
                        languages: {},

                        // Enable live UI with progress bar and live edge button
                        liveui: false,

                        // Live tracker options
                        liveTracker: {
                            trackingThreshold: 20, // Seconds threshold for showing live UI
                            liveTolerance: 15, // Seconds tolerance for being "live"
                        },

                        // Force native controls for touch devices
                        nativeControlsForTouch: false,

                        // Normalize autoplay behavior
                        normalizeAutoplay: false,

                        // Custom message when media cannot be played
                        notSupportedMessage: undefined,

                        // Prevent title attributes on UI elements for better accessibility
                        noUITitleAttributes: false,

                        // Array of playback speed options (e.g., [0.5, 1, 1.5, 2])
                        playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],

                        // Prefer non-fullscreen playback on mobile
                        playsinline: true,

                        // Plugin initialization options
                        plugins: {},

                        // Control poster image display
                        posterImage: true,

                        // Prefer full window over fullscreen on some devices
                        preferFullWindow: false,

                        // Enable responsive player based on breakpoints
                        responsive: true,

                        // Restore element when player is disposed
                        restoreEl: false,

                        // Skip button configuration
                        /* skipButtons: {
                            forward: 10, // Seconds to skip forward (5, 10, or 30)
                            backward: 10, // Seconds to skip backward (5, 10, or 30)
                        }, */

                        // Suppress "not supported" error until user interaction
                        suppressNotSupportedError: false,

                        // Allow techs to override poster
                        techCanOverridePoster: false,

                        // Order of preferred playback technologies
                        techOrder: ['html5'],

                        // User interaction options
                        userActions: {
                            // Enable/disable or customize click behavior
                            click: true,

                            // Enable/disable or customize double-click behavior (fullscreen toggle)
                            doubleClick: true,

                            // Hotkey configuration
                            hotkeys: {
                                // Function to override fullscreen key (default: 'f')
                                fullscreenKey: function (event) {
                                    return event.which === 70; // 'f' key
                                },

                                // Function to override mute key (default: 'm')
                                muteKey: function (event) {
                                    return event.which === 77; // 'm' key
                                },

                                // Function to override play/pause key (default: 'k' and Space)
                                playPauseKey: function (event) {
                                    return (
                                        event.which === 75 || event.which === 32
                                    ); // 'k' or Space
                                },
                            },
                        },

                        // URL to vtt.js for WebVTT support
                        'vtt.js': undefined,

                        // Spatial navigation for smart TV/remote control navigation
                        spatialNavigation: {
                            enabled: false,
                            horizontalSeek: false,
                        },

                        // ===== CONTROL BAR OPTIONS =====
                        controlBar: {
                            // Skip buttons configuration
                            /* skipButtons: {
                                forward: 10,
                                backward: 10,
                            }, */

                            // Remaining time display configuration
                            remainingTimeDisplay: {
                                displayNegative: true,
                            },

                            // Volume panel configuration
                            volumePanel: {
                                inline: true, // Display volume control inline
                                vertical: false, // Use horizontal volume slider
                            },

                            // Fullscreen toggle button
                            fullscreenToggle: true,

                            // Picture-in-picture toggle button
                            pictureInPictureToggle: true,

                            // Playback rate menu button
                            playbackRateMenuButton: true,

                            // Descriptions button
                            descriptionsButton: true,

                            // Subtitles button
                            subtitlesButton: true,

                            // Captions button (disabled to avoid duplicate)
                            captionsButton: false,

                            // Audio track button
                            audioTrackButton: true,

                            // Live display
                            liveDisplay: true,

                            // Seek to live button
                            seekToLive: true,

                            // Custom control spacer
                            customControlSpacer: true,

                            // Chapters menu button (moved after subtitles/captions)
                            chaptersButton: true,
                        },

                        // ===== HTML5 TECH OPTIONS =====
                        html5: {
                            // Force native controls for touch devices
                            nativeControlsForTouch: false,

                            // Use native audio tracks instead of emulated
                            nativeAudioTracks: true,

                            // Use native text tracks instead of emulated
                            nativeTextTracks: true,

                            // Use native video tracks instead of emulated
                            nativeVideoTracks: true,

                            // Preload text tracks
                            preloadTextTracks: true,
                        },

                        // ===== COMPONENT CONFIGURATION =====
                        children: [
                            'mediaLoader',
                            'posterImage',
                            'textTrackDisplay',
                            'loadingSpinner',
                            'bigPlayButton',
                            'liveTracker',
                            'controlBar',
                            'errorDisplay',
                            'textTrackSettings',
                            'resizeManager',
                        ],
                    });

                    // Event listeners
                    playerRef.current.on('ready', () => {
                        // Auto-play video when navigating from next button
                        const urlParams = new URLSearchParams(
                            window.location.search
                        );
                        const hasVideoParam = urlParams.get('m');
                        if (hasVideoParam) {
                            // Small delay to ensure everything is loaded
                            setTimeout(() => {
                                if (
                                    playerRef.current &&
                                    !playerRef.current.isDisposed()
                                ) {
                                    playerRef.current.play().catch((error) => {
                                        console.log(
                                            'Autoplay was prevented:',
                                            error
                                        );
                                    });
                                }
                            }, 100);
                        }

                        // Add English subtitle track after player is ready
                        playerRef.current.addRemoteTextTrack(
                            {
                                kind: 'subtitles',
                                src: '/sample-subtitles.vtt',
                                srclang: 'en',
                                label: 'English Subtitles',
                                default: false,
                            },
                            false
                        );

                        // console.log(
                        //     'English subtitle track added:',
                        //     englishSubtitleTrack
                        // );

                        // Add Greek subtitle track
                        playerRef.current.addRemoteTextTrack(
                            {
                                kind: 'subtitles',
                                src: '/sample-subtitles-greek.vtt',
                                srclang: 'el',
                                label: 'Greek Subtitles (Ελληνικά)',
                                default: false,
                            },
                            false
                        );

                        // Set chapters from JSON data
                        // setChapters(chaptersData);

                        // Create a text track for chapters programmatically
                        const chaptersTrack = playerRef.current.addTextTrack(
                            'chapters',
                            'Chapters',
                            'en'
                        );

                        // Add cues to the chapters track
                        chaptersData.forEach((chapter) => {
                            const cue = new (window.VTTCue ||
                                window.TextTrackCue)(
                                chapter.startTime,
                                chapter.endTime,
                                chapter.text
                            );
                            chaptersTrack.addCue(cue);
                        });

                        // Force chapter markers update after chapters are loaded
                        setTimeout(() => {
                            const progressControl = playerRef.current
                                .getChild('controlBar')
                                .getChild('progressControl');
                            if (progressControl) {
                                const seekBar =
                                    progressControl.getChild('seekBar');
                                if (seekBar) {
                                    const markers =
                                        seekBar.getChild('ChapterMarkers');
                                    if (
                                        markers &&
                                        markers.updateChapterMarkers
                                    ) {
                                        markers.updateChapterMarkers();
                                    }
                                }
                            }
                        }, 500);

                        console.log(
                            'Subtitles loaded but disabled by default - use CC button to enable'
                        );
                    });

                    // Add Next Video button to control bar and reorder chapters button
                    playerRef.current.ready(() => {
                        const controlBar =
                            playerRef.current.getChild('controlBar');
                        const nextVideoButton = new NextVideoButton(
                            playerRef.current
                        );

                        // Insert after play button
                        const playToggle = controlBar.getChild('playToggle');
                        const playToggleIndex = controlBar
                            .children()
                            .indexOf(playToggle);
                        controlBar.addChild(
                            nextVideoButton,
                            {},
                            playToggleIndex + 1
                        );

                        // Remove duplicate captions button and move chapters to end
                        const cleanupControls = () => {
                            // Log all current children for debugging
                            const allChildren = controlBar.children();

                            // Try to find and remove captions/subs-caps button (but keep subtitles)
                            const possibleCaptionButtons = [
                                'captionsButton',
                                'subsCapsButton',
                            ];
                            possibleCaptionButtons.forEach((buttonName) => {
                                const button = controlBar.getChild(buttonName);
                                if (button) {
                                    try {
                                        controlBar.removeChild(button);
                                        console.log(`✓ Removed ${buttonName}`);
                                    } catch (e) {
                                        console.log(
                                            `✗ Failed to remove ${buttonName}:`,
                                            e
                                        );
                                    }
                                }
                            });

                            // Alternative: hide buttons we can't remove
                            allChildren.forEach((child, index) => {
                                const name = (
                                    child.name_ ||
                                    child.constructor.name ||
                                    ''
                                ).toLowerCase();
                                if (
                                    name.includes('caption') &&
                                    !name.includes('subtitle')
                                ) {
                                    child.hide();
                                    console.log(
                                        `✓ Hidden button at index ${index}: ${name}`
                                    );
                                }
                            });

                            // Move chapters button to the very end
                            const chaptersButton =
                                controlBar.getChild('chaptersButton');
                            if (chaptersButton) {
                                try {
                                    controlBar.removeChild(chaptersButton);
                                    controlBar.addChild(chaptersButton);
                                    console.log(
                                        '✓ Chapters button moved to last position'
                                    );
                                } catch (e) {
                                    console.log(
                                        '✗ Failed to move chapters button:',
                                        e
                                    );
                                }
                            }
                        };

                        // Try multiple times with different delays
                        setTimeout(cleanupControls, 200);
                        setTimeout(cleanupControls, 500);
                        setTimeout(cleanupControls, 1000);

                        // Make menus clickable instead of hover-only
                        setTimeout(() => {
                            const setupClickableMenus = () => {
                                // Find all menu buttons (chapters, subtitles, etc.)
                                const menuButtons = [
                                    'chaptersButton',
                                    'subtitlesButton',
                                    'playbackRateMenuButton',
                                ];

                                menuButtons.forEach((buttonName) => {
                                    const button =
                                        controlBar.getChild(buttonName);
                                    if (button && button.menuButton_) {
                                        // Override the menu button behavior
                                        const menuButton = button.menuButton_;

                                        // Disable hover events
                                        menuButton.off('mouseenter');
                                        menuButton.off('mouseleave');

                                        // Add click-to-toggle behavior
                                        menuButton.on('click', function () {
                                            if (
                                                this.menu.hasClass(
                                                    'vjs-lock-showing'
                                                )
                                            ) {
                                                this.menu.removeClass(
                                                    'vjs-lock-showing'
                                                );
                                                this.menu.hide();
                                            } else {
                                                this.menu.addClass(
                                                    'vjs-lock-showing'
                                                );
                                                this.menu.show();
                                            }
                                        });

                                        console.log(
                                            `✓ Made ${buttonName} clickable`
                                        );
                                    } else if (button) {
                                        // For buttons without menuButton_ property
                                        const buttonEl = button.el();
                                        if (buttonEl) {
                                            // Add click handler to show/hide menu
                                            buttonEl.addEventListener(
                                                'click',
                                                function (e) {
                                                    e.preventDefault();
                                                    e.stopPropagation();

                                                    const menu =
                                                        buttonEl.querySelector(
                                                            '.vjs-menu'
                                                        );
                                                    if (menu) {
                                                        if (
                                                            menu.style
                                                                .display ===
                                                            'block'
                                                        ) {
                                                            menu.style.display =
                                                                'none';
                                                        } else {
                                                            // Hide other menus first
                                                            document
                                                                .querySelectorAll(
                                                                    '.vjs-menu'
                                                                )
                                                                .forEach(
                                                                    (m) => {
                                                                        if (
                                                                            m !==
                                                                            menu
                                                                        )
                                                                            m.style.display =
                                                                                'none';
                                                                    }
                                                                );
                                                            menu.style.display =
                                                                'block';
                                                        }
                                                    }
                                                }
                                            );

                                            console.log(
                                                `✓ Added click handler to ${buttonName}`
                                            );
                                        }
                                    }
                                });
                            };

                            setupClickableMenus();
                        }, 1500);

                        // Add chapter markers to progress control
                        const progressControl =
                            controlBar.getChild('progressControl');
                        if (progressControl) {
                            const progressHolder =
                                progressControl.getChild('seekBar');
                            if (progressHolder) {
                                const chapterMarkers = new ChapterMarkers(
                                    playerRef.current
                                );
                                progressHolder.addChild(chapterMarkers);
                            }
                        }
                    });

                    // Listen for next video event
                    playerRef.current.on('nextVideo', () => {
                        console.log('Next video requested');
                        goToNextVideo();
                    });

                    playerRef.current.on('play', () => {
                        console.log('Video started playing');
                    });

                    playerRef.current.on('pause', () => {
                        console.log('Video paused');
                    });

                    // Store reference to end screen for cleanup
                    let endScreen = null;

                    playerRef.current.on('ended', () => {
                        console.log('Video ended');
                        console.log('Available relatedVideos:', relatedVideos);

                        // Keep controls active after video ends
                        setTimeout(() => {
                            if (
                                playerRef.current &&
                                !playerRef.current.isDisposed()
                            ) {
                                // Remove vjs-ended class if it disables controls
                                const playerEl = playerRef.current.el();
                                if (playerEl) {
                                    // Keep the visual ended state but ensure controls work
                                    const controlBar =
                                        playerRef.current.getChild(
                                            'controlBar'
                                        );
                                    if (controlBar) {
                                        controlBar.show();
                                        controlBar.el().style.opacity = '1';
                                        controlBar.el().style.pointerEvents =
                                            'auto';
                                    }
                                }
                            }
                        }, 50);

                        // Prevent creating multiple end screens
                        if (endScreen) {
                            console.log(
                                'End screen already exists, removing previous one'
                            );
                            playerRef.current.removeChild(endScreen);
                            endScreen = null;
                        }

                        // Show end screen with related videos
                        endScreen = new EndScreenOverlay(playerRef.current, {
                            relatedVideos: relatedVideos,
                        });

                        // Also store the data directly on the component as backup
                        endScreen.relatedVideos = relatedVideos;

                        playerRef.current.addChild(endScreen);
                        endScreen.show();
                    });

                    // Hide end screen when user wants to replay
                    playerRef.current.on('play', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                    });

                    // Hide end screen when user seeks
                    playerRef.current.on('seeking', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                    });

                    // Handle replay button functionality
                    playerRef.current.on('replay', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                        playerRef.current.currentTime(0);
                        playerRef.current.play();
                    });

                    playerRef.current.on('error', (error) => {
                        console.error('Video.js error:', error);
                    });

                    playerRef.current.on('fullscreenchange', () => {
                        console.log(
                            'Fullscreen changed:',
                            playerRef.current.isFullscreen()
                        );
                    });

                    playerRef.current.on('volumechange', () => {
                        console.log(
                            'Volume changed:',
                            playerRef.current.volume(),
                            'Muted:',
                            playerRef.current.muted()
                        );
                    });

                    playerRef.current.on('ratechange', () => {
                        console.log(
                            'Playback rate changed:',
                            playerRef.current.playbackRate()
                        );
                    });

                    playerRef.current.on('texttrackchange', () => {
                        console.log('Text track changed');
                        const textTracks = playerRef.current.textTracks();
                        for (let i = 0; i < textTracks.length; i++) {
                            console.log(
                                'Track',
                                i,
                                ':',
                                textTracks[i].kind,
                                textTracks[i].label,
                                'Mode:',
                                textTracks[i].mode
                            );
                        }
                    });

                    // Focus the player element so keyboard controls work
                    // This ensures spacebar can pause/play the video
                    playerRef.current.ready(() => {
                        // Focus the player element
                        if (playerRef.current.el()) {
                            playerRef.current.el().focus();
                            console.log(
                                'Video player focused for keyboard controls'
                            );
                        }

                        // Start playing the video immediately if autoplay is enabled
                        if (playerRef.current.autoplay()) {
                            playerRef.current.play().catch((error) => {
                                console.log(
                                    'Autoplay prevented by browser:',
                                    error
                                );
                                // If autoplay fails, we can still focus the element
                                // so the user can manually start and use keyboard controls
                            });
                        }
                    });
                }
            }, 0);

            return () => {
                clearTimeout(timer);
            };
        }

        // Cleanup function
        return () => {
            if (playerRef.current && !playerRef.current.isDisposed()) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, []);

    // Additional effect to ensure video gets focus for keyboard controls
    useEffect(() => {
        const focusVideo = () => {
            if (playerRef.current && playerRef.current.el()) {
                playerRef.current.el().focus();
                console.log('Video element focused for keyboard controls');
            }
        };

        // Focus when the page becomes visible or gains focus
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                setTimeout(focusVideo, 100);
            }
        };

        const handleWindowFocus = () => {
            setTimeout(focusVideo, 100);
        };

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);

        // Initial focus attempt
        setTimeout(focusVideo, 500);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    // Function to jump to specific time in the video
    // const jumpToTime = (seconds) => {
    //     if (playerRef.current && !playerRef.current.isDisposed()) {
    //         playerRef.current.currentTime(seconds);
    //         console.log(`Jumped to ${seconds} seconds`);

    //         // If video is paused, start playing after jumping
    //         if (playerRef.current.paused()) {
    //             playerRef.current.play();
    //         }
    //     } else {
    //         console.warn('Player not ready yet');
    //     }
    // };

    return (
        <video
            ref={videoRef}
            className='video-js vjs-default-skin'
            tabIndex='0'
        />
    );

    /* return (
        <>
            <div className='video-container'>
                <video
                    ref={videoRef}
                    className='video-js vjs-default-skin'
                    tabIndex='0'
                />
            </div>
            <div
                style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#333',
                    color: 'white',
                    borderRadius: '8px',
                    textAlign: 'center',
                }}>
                <h4 style={{ margin: '0 0 5px 0' }}>{currentVideo.title}</h4>
                <p
                    style={{
                        margin: '0',
                        fontSize: '14px',
                        opacity: '0.8',
                    }}>
                    <span>ID: {currentVideo.id}</span>
                </p>
            </div>
            <div
                className='video-info'
                style={{
                    marginTop: '20px',
                    padding: '15px',
                    background: '#f5f5f5',
                    borderRadius: '5px',
                }}>
                <h3>Video.js Configuration123</h3>

                <div style={{ marginBottom: '15px' }}>
                    <h4>Quick Navigation Links:</h4>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        <span>Text links: </span>
                        <a
                            href='#'
                            onClick={(e) => {
                                e.preventDefault();
                                jumpToTime(6);
                            }}
                            style={{
                                color: '#007acc',
                                textDecoration: 'underline',
                                marginRight: '15px',
                            }}>
                            Navigate to 00:06
                        </a>
                        <a
                            href='#'
                            onClick={(e) => {
                                e.preventDefault();
                                jumpToTime(19);
                            }}
                            style={{
                                color: '#007acc',
                                textDecoration: 'underline',
                                marginRight: '15px',
                            }}>
                            Navigate to 00:19
                        </a>
                        <a
                            href='#'
                            onClick={(e) => {
                                e.preventDefault();
                                jumpToTime(35);
                            }}
                            style={{
                                color: '#007acc',
                                textDecoration: 'underline',
                            }}>
                            Navigate to 00:35
                        </a>
                    </div>
                </div>

                {chapters.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4>Chapters:</h4>
                        <div
                            style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                color: '#333',
                            }}>
                            {chapters.map((chapter, index) => {
                                const minutes = Math.floor(
                                    chapter.startTime / 60
                                );
                                const seconds = Math.floor(
                                    chapter.startTime % 60
                                );
                                const timeString = `${minutes}:${seconds
                                    .toString()
                                    .padStart(2, '0')}`;

                                return (
                                    <div
                                        key={index}
                                        style={{ marginBottom: '4px' }}>
                                        <span>{chapter.text} </span>
                                        <a
                                            href='#'
                                            onClick={(e) => {
                                                e.preventDefault();
                                                jumpToTime(chapter.startTime);
                                            }}
                                            style={{
                                                color: '#007acc',
                                                textDecoration: 'underline',
                                                cursor: 'pointer',
                                            }}>
                                            {timeString}
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    ); */
}

export default VideoJS;
