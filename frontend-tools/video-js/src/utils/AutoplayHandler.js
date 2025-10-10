export class AutoplayHandler {
    constructor(player, mediaData, userPreferences) {
        this.player = player;
        this.mediaData = mediaData;
        this.userPreferences = userPreferences;
        this.isFirefox = this.detectFirefox();
    }

    detectFirefox() {
        return (
            typeof navigator !== 'undefined' &&
            navigator.userAgent &&
            navigator.userAgent.toLowerCase().indexOf('firefox') > -1
        );
    }

    hasUserInteracted() {
        // Firefox-specific user interaction detection
        if (this.isFirefox) {
            return (
                // Check if user has explicitly interacted
                sessionStorage.getItem('userInteracted') === 'true' ||
                // Firefox-specific: Check if document has been clicked/touched
                sessionStorage.getItem('firefoxUserGesture') === 'true' ||
                // More reliable focus check for Firefox
                (document.hasFocus() && document.visibilityState === 'visible') ||
                // Check if any user event has been registered
                this.checkFirefoxUserGesture()
            );
        }

        // Original detection for other browsers
        return (
            document.hasFocus() ||
            document.visibilityState === 'visible' ||
            sessionStorage.getItem('userInteracted') === 'true'
        );
    }

    checkFirefoxUserGesture() {
        // Firefox requires actual user gesture for autoplay
        // This checks if we've detected any user interaction events
        try {
            const hasGesture = document.createElement('video').play();
            return hasGesture && typeof hasGesture.then === 'function';
        } catch {
            return false;
        }
    }

    async handleAutoplay() {
        // Don't attempt autoplay if already playing or loading
        if (!this.player.paused() || this.player.seeking()) {
            return;
        }

        // Firefox-specific delay to ensure player is ready
        if (this.isFirefox) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Define variables outside try block so they're accessible in catch
        const userInteracted = this.hasUserInteracted();
        const savedMuteState = this.userPreferences.getPreference('muted');

        try {
            // Firefox-specific: Always start muted if no user interaction
            if (this.isFirefox && !userInteracted) {
                this.player.muted(true);
            } else if (!this.mediaData.urlMuted && userInteracted && savedMuteState !== true) {
                this.player.muted(false);
            }

            // First attempt: try to play with current mute state
            const playPromise = this.player.play();

            // Firefox-specific promise handling
            if (this.isFirefox && playPromise && typeof playPromise.then === 'function') {
                await playPromise;
            } else if (playPromise) {
                await playPromise;
            }
        } catch (error) {
            // Firefox-specific error handling
            if (this.isFirefox) {
                await this.handleFirefoxAutoplayError(error, userInteracted, savedMuteState);
            } else {
                // Fallback to muted autoplay unless user explicitly wants to stay unmuted
                if (!this.player.muted()) {
                    try {
                        this.player.muted(true);
                        await this.player.play();

                        // Only try to restore sound if user hasn't explicitly saved mute=true
                        if (savedMuteState !== true) {
                            this.restoreSound(userInteracted);
                        }
                    } catch {
                        // console.error('❌ Even muted autoplay was blocked:', mutedError.message);
                    }
                }
            }
        }
    }

    async handleFirefoxAutoplayError(error, userInteracted, savedMuteState) {
        // Firefox requires muted autoplay in most cases
        if (!this.player.muted()) {
            try {
                this.player.muted(true);

                // Add a small delay for Firefox
                await new Promise((resolve) => setTimeout(resolve, 50));

                const mutedPlayPromise = this.player.play();
                if (mutedPlayPromise && typeof mutedPlayPromise.then === 'function') {
                    await mutedPlayPromise;
                }

                // Only try to restore sound if user hasn't explicitly saved mute=true
                if (savedMuteState !== true) {
                    this.restoreSound(userInteracted);
                }
            } catch {
                // Even muted autoplay failed - set up user interaction listeners
                this.setupFirefoxInteractionListeners();
            }
        } else {
            // Already muted but still failed - set up interaction listeners
            this.setupFirefoxInteractionListeners();
        }
    }

    setupFirefoxInteractionListeners() {
        if (!this.isFirefox) return;

        const enablePlayback = async () => {
            try {
                sessionStorage.setItem('firefoxUserGesture', 'true');
                sessionStorage.setItem('userInteracted', 'true');

                if (this.player && !this.player.isDisposed() && this.player.paused()) {
                    const playPromise = this.player.play();
                    if (playPromise && typeof playPromise.then === 'function') {
                        await playPromise;
                    }
                }

                // Remove listeners after successful interaction
                document.removeEventListener('click', enablePlayback);
                document.removeEventListener('keydown', enablePlayback);
                document.removeEventListener('touchstart', enablePlayback);
            } catch {
                // Interaction still didn't work, keep listeners active
            }
        };

        // Set up interaction listeners for Firefox
        document.addEventListener('click', enablePlayback, { once: true });
        document.addEventListener('keydown', enablePlayback, { once: true });
        document.addEventListener('touchstart', enablePlayback, { once: true });

        // Show Firefox-specific notification
        if (this.player && !this.player.isDisposed()) {
            this.player.trigger('notify', '🦊 Firefox: Click to enable playback');
        }
    }

    restoreSound(userInteracted) {
        const restoreSound = () => {
            if (this.player && !this.player.isDisposed()) {
                this.player.muted(false);
                this.player.trigger('notify', '🔊 Sound enabled!');
            }
        };

        // Firefox-specific sound restoration
        if (this.isFirefox) {
            // Firefox needs more time and user interaction verification
            if (userInteracted || sessionStorage.getItem('firefoxUserGesture') === 'true') {
                setTimeout(restoreSound, 200); // Longer delay for Firefox
            } else {
                // Show Firefox-specific notification
                setTimeout(() => {
                    if (this.player && !this.player.isDisposed()) {
                        this.player.trigger('notify', '🦊 Firefox: Click to enable sound');
                    }
                }, 1500); // Longer delay for Firefox notification

                // Set up Firefox-specific interaction listeners
                const enableSound = () => {
                    restoreSound();
                    // Mark Firefox user interaction
                    sessionStorage.setItem('userInteracted', 'true');
                    sessionStorage.setItem('firefoxUserGesture', 'true');
                    // Remove listeners
                    document.removeEventListener('click', enableSound);
                    document.removeEventListener('keydown', enableSound);
                    document.removeEventListener('touchstart', enableSound);
                };

                document.addEventListener('click', enableSound, { once: true });
                document.addEventListener('keydown', enableSound, { once: true });
                document.addEventListener('touchstart', enableSound, { once: true });
            }
        } else {
            // Original behavior for other browsers
            if (userInteracted) {
                setTimeout(restoreSound, 100);
            } else {
                // Show notification for manual interaction
                setTimeout(() => {
                    if (this.player && !this.player.isDisposed()) {
                        this.player.trigger('notify', '🔇 Click anywhere to enable sound');
                    }
                }, 1000);

                // Set up interaction listeners
                const enableSound = () => {
                    restoreSound();
                    // Mark user interaction for future videos
                    sessionStorage.setItem('userInteracted', 'true');
                    // Remove listeners
                    document.removeEventListener('click', enableSound);
                    document.removeEventListener('keydown', enableSound);
                    document.removeEventListener('touchstart', enableSound);
                };

                document.addEventListener('click', enableSound, { once: true });
                document.addEventListener('keydown', enableSound, { once: true });
                document.addEventListener('touchstart', enableSound, { once: true });
            }
        }
    }
}
