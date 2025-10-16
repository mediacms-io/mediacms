/**
 * Video Player Configuration
 * Centralized configuration for video player customizations
 */

const PlayerConfig = {
    nativeControlsForTouch: false,

    // Progress bar configuration
    progressBar: {
        // Position for non-touch devices: 'default', 'top', or 'bottom'
        // 'default' - use Video.js default positioning (inside control bar)
        // 'top' - progress bar above control bar
        // 'bottom' - progress bar below control bar
        nonTouchPosition: 'top',

        // Position for touch devices: 'top' or 'bottom' (no 'default' option)
        // 'top' - progress bar above control bar
        // 'bottom' - progress bar below control bar (native touch style)
        touchPosition: 'top',

        // Progress bar color (hex, rgb, or CSS color name)
        color: '#019932',

        // Background color of the progress track
        trackColor: 'rgba(255, 255, 255, 0.3)',

        // Loaded buffer color
        bufferColor: 'rgba(255, 255, 255, 0.5)',
    },

    // Control bar configuration
    controlBar: {
        // Background color
        backgroundColor: 'rgba(0, 0, 0, 0.7)',

        // Height in em units
        height: 3,

        // Font size in em units
        fontSize: 14,

        mobileFontSize: 13,
    },
};

export default PlayerConfig;
