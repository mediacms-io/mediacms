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

    async handleAutoplay() {
        if (!this.player.paused() || this.player.seeking()) {
            return;
        }

        if (this.isFirefox) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (this.mediaData.urlMuted) {
            this.player.muted(true);
        }

        try {
            await this.player.play();
        } catch {
            this.player.pause();
        }
    }
}
