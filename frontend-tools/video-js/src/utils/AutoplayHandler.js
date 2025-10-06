export class AutoplayHandler {
    constructor(player, mediaData, userPreferences) {
        this.player = player;
        this.mediaData = mediaData;
        this.userPreferences = userPreferences;
    }

    hasUserInteracted() {
        return (
            document.hasFocus() ||
            document.visibilityState === 'visible' ||
            sessionStorage.getItem('userInteracted') === 'true'
        );
    }

    async handleAutoplay() {
        // Don't attempt autoplay if already playing or loading
        if (!this.player.paused() || this.player.seeking()) {
            return;
        }

        // Define variables outside try block so they're accessible in catch
        const userInteracted = this.hasUserInteracted();
        const savedMuteState = this.userPreferences.getPreference('muted');

        try {
            // Respect user's saved mute preference, but try unmuted if user interacted and hasn't explicitly muted
            if (!this.mediaData.urlMuted && userInteracted && savedMuteState !== true) {
                this.player.muted(false);
            }

            // First attempt: try to play with current mute state
            await this.player.play();
        } catch (error) {
            // Fallback to muted autoplay unless user explicitly wants to stay unmuted
            if (!this.player.muted()) {
                try {
                    this.player.muted(true);
                    await this.player.play();

                    // Only try to restore sound if user hasn't explicitly saved mute=true
                    if (savedMuteState !== true) {
                        this.restoreSound(userInteracted);
                    }
                } catch (mutedError) {
                    // console.error('❌ Even muted autoplay was blocked:', mutedError.message);
                }
            }
        }
    }

    restoreSound(userInteracted) {
        const restoreSound = () => {
            if (this.player && !this.player.isDisposed()) {
                this.player.muted(false);
                this.player.trigger('notify', '🔊 Sound enabled!');
            }
        };

        // Try to restore sound immediately if user has interacted
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
