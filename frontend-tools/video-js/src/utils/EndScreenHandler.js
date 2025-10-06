import EndScreenOverlay from '../components/overlays/EndScreenOverlay';
import AutoplayCountdownOverlay from '../components/overlays/AutoplayCountdownOverlay';

export class EndScreenHandler {
    constructor(player, options) {
        this.player = player;
        this.options = options;
        this.endScreen = null;
        this.autoplayCountdown = null;

        this.setupEndScreenHandling();
    }

    setupEndScreenHandling() {
        // Handle video ended event
        this.player.on('ended', () => {
            this.handleVideoEnded();
        });

        // Hide end screen and autoplay countdown when user wants to replay
        const hideEndScreenAndStopCountdown = () => {
            if (this.endScreen) {
                this.endScreen.hide();
            }
            if (this.autoplayCountdown) {
                this.autoplayCountdown.stopCountdown();
            }
        };

        this.player.on('play', hideEndScreenAndStopCountdown);
        this.player.on('seeking', hideEndScreenAndStopCountdown);
    }

    handleVideoEnded() {
        const { isEmbedPlayer, userPreferences, mediaData, currentVideo, relatedVideos, goToNextVideo } = this.options;

        // For embed players, show big play button when video ends
        if (isEmbedPlayer) {
            const bigPlayButton = this.player.getChild('bigPlayButton');
            if (bigPlayButton) {
                bigPlayButton.show();
            }
        }

        // Keep controls active after video ends
        setTimeout(() => {
            if (this.player && !this.player.isDisposed()) {
                const playerEl = this.player.el();
                if (playerEl) {
                    // Hide poster image when end screen is shown - multiple approaches
                    const posterImage = this.player.getChild('posterImage');
                    if (posterImage) {
                        posterImage.hide();
                        posterImage.el().style.display = 'none';
                        posterImage.el().style.visibility = 'hidden';
                        posterImage.el().style.opacity = '0';
                    }

                    // Hide all poster elements directly
                    const posterElements = playerEl.querySelectorAll('.vjs-poster');
                    posterElements.forEach((posterEl) => {
                        posterEl.style.display = 'none';
                        posterEl.style.visibility = 'hidden';
                        posterEl.style.opacity = '0';
                    });

                    // Set player background to dark to match end screen
                    playerEl.style.backgroundColor = '#000';

                    // Keep video element visible but ensure it doesn't show poster
                    const videoEl = playerEl.querySelector('video');
                    if (videoEl) {
                        // Remove poster attribute from video element
                        videoEl.removeAttribute('poster');
                        videoEl.style.backgroundColor = '#000';
                    }

                    // Keep the visual ended state but ensure controls work
                    const controlBar = this.player.getChild('controlBar');
                    if (controlBar) {
                        controlBar.show();
                        controlBar.el().style.opacity = '1';
                        controlBar.el().style.pointerEvents = 'auto';

                        // Style progress bar to match dark end screen background
                        const progressControl = controlBar.getChild('progressControl');
                        if (progressControl) {
                            progressControl.show();
                            progressControl.el().style.backgroundColor = 'rgba(0, 0, 0, 0.8)';

                            // Also style the progress holder for seamless look
                            const progressHolder = progressControl.el().querySelector('.vjs-progress-holder');
                            if (progressHolder) {
                                progressHolder.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                            }
                        }
                    }
                }
            }
        }, 50);

        // Check if autoplay is enabled and there's a next video
        const isAutoplayEnabled = userPreferences.getAutoplayPreference();
        const hasNextVideo = mediaData.nextLink !== null;

        if (!isEmbedPlayer && isAutoplayEnabled && hasNextVideo) {
            // If it's a playlist, skip countdown and play directly
            if (currentVideo.isPlayList) {
                this.cleanupOverlays();
                goToNextVideo();
            } else {
                this.showAutoplayCountdown(relatedVideos, goToNextVideo);
            }
        } else {
            // Autoplay disabled or no next video - show regular end screen
            this.showEndScreen(relatedVideos);
        }
    }

    showAutoplayCountdown(relatedVideos, goToNextVideo) {
        // Get next video data for countdown display - find the next video in related videos
        let nextVideoData = {
            title: 'Next Video',
            author: '',
            duration: 0,
            thumbnail: '',
        };

        // Try to find the next video by URL matching or just use the first related video
        if (relatedVideos.length > 0) {
            const nextVideo = relatedVideos[0];
            nextVideoData = {
                title: nextVideo.title || 'Next Video',
                author: nextVideo.author || '',
                duration: nextVideo.duration || 0,
                thumbnail: nextVideo.thumbnail || '',
            };
        }

        // Clean up any existing overlays
        this.cleanupOverlays();

        // Show autoplay countdown immediately!
        this.autoplayCountdown = new AutoplayCountdownOverlay(this.player, {
            nextVideoData: nextVideoData,
            countdownSeconds: 5,
            onPlayNext: () => {
                goToNextVideo();
            },
            onCancel: () => {
                // Hide countdown and show end screen instead
                if (this.autoplayCountdown) {
                    this.player.removeChild(this.autoplayCountdown);
                    this.autoplayCountdown = null;
                }
                this.showEndScreen(relatedVideos);
            },
        });

        this.player.addChild(this.autoplayCountdown);
        // Start countdown immediately without any delay
        setTimeout(() => {
            if (this.autoplayCountdown && !this.autoplayCountdown.isDisposed()) {
                this.autoplayCountdown.startCountdown();
            }
        }, 0);
    }

    showEndScreen(relatedVideos) {
        // Prevent creating multiple end screens
        if (this.endScreen) {
            this.player.removeChild(this.endScreen);
            this.endScreen = null;
        }

        // Show end screen with related videos
        this.endScreen = new EndScreenOverlay(this.player, {
            relatedVideos: relatedVideos,
        });

        // Also store the data directly on the component as backup and update it
        this.endScreen.relatedVideos = relatedVideos;
        if (this.endScreen.setRelatedVideos) {
            this.endScreen.setRelatedVideos(relatedVideos);
        }

        this.player.addChild(this.endScreen);
        this.endScreen.show();
    }

    cleanupOverlays() {
        // Clean up any existing overlays
        if (this.endScreen) {
            this.player.removeChild(this.endScreen);
            this.endScreen = null;
        }
        if (this.autoplayCountdown) {
            this.player.removeChild(this.autoplayCountdown);
            this.autoplayCountdown = null;
        }
    }

    cleanup() {
        this.cleanupOverlays();
    }
}
