import React, { useEffect, useRef, useState, useMemo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// Import the separated components
import EndScreenOverlay from '../overlays/EndScreenOverlay';
import ChapterMarkers from '../markers/ChapterMarkers';
import NextVideoButton from '../controls/NextVideoButton';
import CustomRemainingTime from '../controls/CustomRemainingTime';
import CustomChaptersOverlay from '../controls/CustomChaptersOverlay';
import CustomSettingsMenu from '../controls/CustomSettingsMenu';

function VideoJSPlayer() {
    const videoRef = useRef(null);
    const playerRef = useRef(null); // Track the player instance

    // Safely access window.MEDIA_DATA with fallback using useMemo
    const mediaData = useMemo(
        () =>
            typeof window !== 'undefined' && window.MEDIA_DATA
                ? window.MEDIA_DATA
                : {
                      data: {},
                      siteUrl: '',
                      hasNextLink: true,
                  },
        []
    );

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
                          src: mediaData.siteUrl + mediaData.data.original_media_url,
                          type: 'video/mp4',
                      },
                  ]
                : [
                      {
                          src: '/videos/sample-video.mp4',
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

    // Function to navigate to next video
    const goToNextVideo = () => {
        console.log('Next video functionality disabled for single video mode');

        if (mediaData.onClickNextCallback && typeof mediaData.onClickNextCallback === 'function') {
            mediaData.onClickNextCallback();
        }
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
                if (!playerRef.current && videoRef.current && !videoRef.current.player) {
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
                                    return event.which === 75 || event.which === 32; // 'k' or Space
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
                            progressControl: {
                                seekBar: {
                                    timeTooltip: {
                                        // Customize TimeTooltip behavior
                                        displayNegative: false, // Don't show negative time
                                    },
                                },
                            },
                            // Remaining time display configuration
                            remainingTimeDisplay: false,
                            /* remainingTimeDisplay: {
                                displayNegative: true,
                            }, */

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
                            subtitlesButton: false,

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
                    /* playerRef.current.on('ready', () => {
                        console.log('Video.js player ready');
                    }); */
                    playerRef.current.ready(() => {
                        // Get control bar and its children
                        const controlBar = playerRef.current.getChild('controlBar');
                        const playToggle = controlBar.getChild('playToggle');
                        const currentTimeDisplay = controlBar.getChild('currentTimeDisplay');
                        const progressControl = controlBar.getChild('progressControl');
                        const seekBar = progressControl.getChild('seekBar');
                        const chaptersButton = controlBar.getChild('chaptersButton');
                        const fullscreenToggle = controlBar.getChild('fullscreenToggle');

                        // Auto-play video when navigating from next button
                        const urlParams = new URLSearchParams(window.location.search);
                        const hasVideoParam = urlParams.get('m');
                        if (hasVideoParam) {
                            // Small delay to ensure everything is loaded
                            setTimeout(() => {
                                if (playerRef.current && !playerRef.current.isDisposed()) {
                                    playerRef.current.play().catch((error) => {
                                        console.log('Autoplay was prevented:', error);
                                    });
                                }
                            }, 100);
                        }

                        // BEGIN: Add subtitle tracks
                        const subtitleTracks = [
                            {
                                kind: 'subtitles',
                                src: '/sample-subtitles.vtt',
                                srclang: 'en',
                                label: 'English Subtitles',
                                default: false,
                            },
                            {
                                kind: 'subtitles',
                                src: '/sample-subtitles-greek.vtt',
                                srclang: 'el',
                                label: 'Greek Subtitles (Ελληνικά)',
                                default: false,
                            },
                        ];

                        subtitleTracks.forEach((track) => {
                            playerRef.current.addRemoteTextTrack(track, false);
                        });
                        // END: Add subtitle tracks

                        // BEGIN: Chapters Implementation
                        if (chaptersData && chaptersData.length > 0) {
                            const chaptersTrack = playerRef.current.addTextTrack('chapters', 'Chapters', 'en');
                            // Add cues to the chapters track
                            chaptersData.forEach((chapter) => {
                                const cue = new (window.VTTCue || window.TextTrackCue)(
                                    chapter.startTime,
                                    chapter.endTime,
                                    chapter.text
                                );
                                chaptersTrack.addCue(cue);
                            });
                        }
                        // END: Chapters Implementation

                        // Force chapter markers update after chapters are loaded
                        /* setTimeout(() => {
                            if (chapterMarkers && chapterMarkers.updateChapterMarkers) {
                                chapterMarkers.updateChapterMarkers();
                            }
                        }, 500); */

                        // BEGIN: Implement custom time display component
                        const customRemainingTime = new CustomRemainingTime(playerRef.current, {
                            displayNegative: false,
                            customPrefix: '',
                            customSuffix: '',
                        });

                        // Insert it in the desired position (e.g., after current time display)
                        if (currentTimeDisplay) {
                            const currentTimeIndex = controlBar.children().indexOf(currentTimeDisplay);
                            controlBar.addChild(customRemainingTime, {}, currentTimeIndex + 1);
                        } else {
                            controlBar.addChild(customRemainingTime, {}, 2);
                        }
                        // END: Implement custom time display component

                        // BEGIN: Implement custom next video button
                        if (mediaData.hasNextLink) {
                            const nextVideoButton = new NextVideoButton(playerRef.current);
                            const playToggleIndex = controlBar.children().indexOf(playToggle); // Insert it after play button
                            controlBar.addChild(nextVideoButton, {}, playToggleIndex + 1);
                        }
                        // END: Implement custom next video button

                        // Remove duplicate captions button and move chapters to end
                        /*  const cleanupControls = () => {
                            // Log all current children for debugging
                            const allChildren = controlBar.children();

                            // Try to find and remove captions/subs-caps button (but keep subtitles)
                            const possibleCaptionButtons = ['captionsButton', 'subsCapsButton'];
                            possibleCaptionButtons.forEach((buttonName) => {
                                const button = controlBar.getChild(buttonName);
                                if (button) {
                                    try {
                                        controlBar.removeChild(button);
                                        console.log(`✓ Removed ${buttonName}`);
                                    } catch (e) {
                                        console.log(`✗ Failed to remove ${buttonName}:`, e);
                                    }
                                }
                            });

                            // Alternative: hide buttons we can't remove
                            allChildren.forEach((child, index) => {
                                const name = (child.name_ || child.constructor.name || '').toLowerCase();
                                if (name.includes('caption') && !name.includes('subtitle')) {
                                    child.hide();
                                    console.log(`✓ Hidden button at index ${index}: ${name}`);
                                }
                            });

                            // Move chapters button to the very end
                            const chaptersButton = controlBar.getChild('chaptersButton');
                            if (chaptersButton) {
                                try {
                                    controlBar.removeChild(chaptersButton);
                                    controlBar.addChild(chaptersButton);
                                    console.log('✓ Chapters button moved to last position');
                                } catch (e) {
                                    console.log('✗ Failed to move chapters button:', e);
                                }
                            }
                        }; */

                        // Try multiple times with different delays
                        /* setTimeout(cleanupControls, 200);
                        setTimeout(cleanupControls, 500);
                        setTimeout(cleanupControls, 1000); */

                        // Make menus clickable instead of hover-only
                        setTimeout(() => {
                            const setupClickableMenus = () => {
                                // Find all menu buttons (chapters, subtitles, etc.)
                                const menuButtons = ['chaptersButton', 'subtitlesButton', 'playbackRateMenuButton'];

                                menuButtons.forEach((buttonName) => {
                                    const button = controlBar.getChild(buttonName);
                                    if (button && button.menuButton_) {
                                        // Override the menu button behavior
                                        const menuButton = button.menuButton_;

                                        // Disable hover events
                                        menuButton.off('mouseenter');
                                        menuButton.off('mouseleave');

                                        // Add click-to-toggle behavior
                                        menuButton.on('click', function () {
                                            if (this.menu.hasClass('vjs-lock-showing')) {
                                                this.menu.removeClass('vjs-lock-showing');
                                                this.menu.hide();
                                            } else {
                                                this.menu.addClass('vjs-lock-showing');
                                                this.menu.show();
                                            }
                                        });

                                        console.log(`✓ Made ${buttonName} clickable`);
                                    } else if (button) {
                                        // For buttons without menuButton_ property
                                        const buttonEl = button.el();
                                        if (buttonEl) {
                                            // Add click handler to show/hide menu
                                            buttonEl.addEventListener('click', function (e) {
                                                e.preventDefault();
                                                e.stopPropagation();

                                                const menu = buttonEl.querySelector('.vjs-menu');
                                                if (menu) {
                                                    if (menu.style.display === 'block') {
                                                        menu.style.display = 'none';
                                                    } else {
                                                        // Hide other menus first
                                                        document.querySelectorAll('.vjs-menu').forEach((m) => {
                                                            if (m !== menu) m.style.display = 'none';
                                                        });
                                                        menu.style.display = 'block';
                                                    }
                                                }
                                            });

                                            console.log(`✓ Added click handler to ${buttonName}`);
                                        }
                                    }
                                });
                            };

                            setupClickableMenus();
                        }, 1500);

                        // BEGIN: Add chapter markers to progress control
                        if (progressControl && seekBar) {
                            const chapterMarkers = new ChapterMarkers(playerRef.current);
                            seekBar.addChild(chapterMarkers);
                        }
                        // END: Add chapter markers to progress control

                        // BEGIN: Move chapters button after fullscreen toggle
                        if (chaptersButton && fullscreenToggle) {
                            try {
                                const fullscreenIndex = controlBar.children().indexOf(fullscreenToggle);
                                controlBar.addChild(chaptersButton, {}, fullscreenIndex + 1);
                                console.log('✓ Chapters button moved after fullscreen toggle');
                            } catch (e) {
                                console.log('✗ Failed to move chapters button:', e);
                            }
                        }
                        // END: Move chapters button after fullscreen toggle

                        // Store custom components for potential future use (cleanup, method access, etc.)
                        const customComponents = {};

                        // BEGIN: Add Chapters Overlay Component
                        if (chaptersData && chaptersData.length > 0) {
                            customComponents.chaptersOverlay = new CustomChaptersOverlay(playerRef.current, {
                                chaptersData: chaptersData,
                            });
                            console.log('✓ Custom chapters overlay component created');
                        } else {
                            console.log('⚠ No chapters data available for overlay');
                        }
                        // END: Add Chapters Overlay Component

                        // BEGIN: Add Settings Menu Component
                        customComponents.settingsMenu = new CustomSettingsMenu(playerRef.current);
                        console.log('✓ Custom settings menu component created');
                        // END: Add Settings Menu Component

                        // Store components reference for potential cleanup
                        console.log('Custom components initialized:', Object.keys(customComponents));
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
                            if (playerRef.current && !playerRef.current.isDisposed()) {
                                // Remove vjs-ended class if it disables controls
                                const playerEl = playerRef.current.el();
                                if (playerEl) {
                                    // Keep the visual ended state but ensure controls work
                                    const controlBar = playerRef.current.getChild('controlBar');
                                    if (controlBar) {
                                        controlBar.show();
                                        controlBar.el().style.opacity = '1';
                                        controlBar.el().style.pointerEvents = 'auto';
                                    }
                                }
                            }
                        }, 50);

                        // Prevent creating multiple end screens
                        if (endScreen) {
                            console.log('End screen already exists, removing previous one');
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
                        console.log('Fullscreen changed:', playerRef.current.isFullscreen());
                    });

                    playerRef.current.on('volumechange', () => {
                        console.log('Volume changed:', playerRef.current.volume(), 'Muted:', playerRef.current.muted());
                    });

                    playerRef.current.on('ratechange', () => {
                        console.log('Playback rate changed:', playerRef.current.playbackRate());
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
                            console.log('Video player focused for keyboard controls');
                        }

                        // Start playing the video immediately if autoplay is enabled
                        if (playerRef.current.autoplay()) {
                            playerRef.current.play().catch((error) => {
                                console.log('Autoplay prevented by browser:', error);
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
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    return <video ref={videoRef} className="video-js vjs-default-skin" tabIndex="0" />;
}

export default VideoJSPlayer;
