/**
 * Video Player Configuration
 * Centralized configuration for video player customizations
 */

const PlayerConfig = {
    // Progress bar configuration
    progressBar: {
        // Position: 'top' or 'bottom'
        // 'top' - progress bar above control bar
        // 'bottom' - progress bar below control bar (default/native style)
        position: 'top',

        // Progress bar color (hex, rgb, or CSS color name)
        color: '#019932',

        // Background color of the progress track
        trackColor: 'rgba(255, 255, 255, 0.3)',

        // Loaded buffer color
        bufferColor: 'rgba(255, 255, 255, 0.5)',
    },
};

export default PlayerConfig;
