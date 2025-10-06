export class OrientationHandler {
    constructor(player, isTouchDevice) {
        this.player = player;
        this.isTouchDevice = isTouchDevice;
        this.orientationChangeHandler = null;
        this.screenOrientationHandler = null;
    }

    setupOrientationHandling() {
        // Only apply to mobile/touch devices
        if (!this.isTouchDevice) {
            return;
        }

        // Modern approach using Screen Orientation API
        if (screen.orientation) {
            this.screenOrientationHandler = () => {
                const type = screen.orientation.type;

                if (type.includes('landscape')) {
                    // Device rotated to landscape - enter fullscreen
                    if (!this.player.isFullscreen()) {
                        this.player.requestFullscreen();
                    }
                } else if (type.includes('portrait')) {
                    // Device rotated to portrait - exit fullscreen
                    if (this.player.isFullscreen()) {
                        this.player.exitFullscreen();
                    }
                }
            };

            screen.orientation.addEventListener('change', this.screenOrientationHandler);
        }
        // Fallback for older iOS devices
        else {
            this.orientationChangeHandler = () => {
                // window.orientation: 0 = portrait, 90/-90 = landscape
                const isLandscape = Math.abs(window.orientation) === 90;

                // Small delay to ensure orientation change is complete
                setTimeout(() => {
                    if (isLandscape && !this.player.isFullscreen()) {
                        this.player.requestFullscreen();
                    } else if (!isLandscape && this.player.isFullscreen()) {
                        this.player.exitFullscreen();
                    }
                }, 100);
            };

            window.addEventListener('orientationchange', this.orientationChangeHandler);
        }
    }

    cleanup() {
        // Remove event listeners
        if (this.screenOrientationHandler && screen.orientation) {
            screen.orientation.removeEventListener('change', this.screenOrientationHandler);
        }

        if (this.orientationChangeHandler) {
            window.removeEventListener('orientationchange', this.orientationChangeHandler);
        }
    }
}
