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