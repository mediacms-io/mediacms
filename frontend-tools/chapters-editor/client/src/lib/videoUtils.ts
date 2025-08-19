/**
 * Generate a solid color background for a segment
 * Returns a CSS color based on the segment position
 */
export const generateSolidColor = (time: number, duration: number): string => {
    // Use the time position to create different colors
    // This gives each segment a different color without needing an image
    const position = Math.min(Math.max(time / (duration || 1), 0), 1);

    // Calculate color based on position
    // Use an extremely light blue-based color palette
    const hue = 210; // Blue base
    const saturation = 40 + Math.floor(position * 20); // 40-60% (less saturated)
    const lightness = 85 + Math.floor(position * 8); // 85-93% (extremely light)

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Legacy function kept for compatibility
 * Now returns a data URL for a solid color square instead of a video thumbnail
 */
export const generateThumbnail = async (videoElement: HTMLVideoElement, time: number): Promise<string> => {
    return new Promise((resolve) => {
        // Create a small canvas for the solid color
        const canvas = document.createElement('canvas');
        canvas.width = 10; // Much smaller - we only need a color
        canvas.height = 10;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Get the solid color based on time
            const color = generateSolidColor(time, videoElement.duration);

            // Fill with solid color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Convert to data URL (much smaller now)
        const dataUrl = canvas.toDataURL('image/png', 0.5);
        resolve(dataUrl);
    });
};
