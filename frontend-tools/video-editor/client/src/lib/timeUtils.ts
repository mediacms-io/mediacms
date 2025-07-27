/**
 * Format seconds to HH:MM:SS.mmm format with millisecond precision
 */
export const formatDetailedTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00:00.000';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    const formattedMilliseconds = String(milliseconds).padStart(3, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
};

/**
 * Format seconds to MM:SS format - now uses the detailed format with hours and milliseconds
 */
export const formatTime = (seconds: number): string => {
    // Use the detailed format instead of the old MM:SS format
    return formatDetailedTime(seconds);
};

/**
 * Format seconds to HH:MM:SS format - now uses the detailed format with milliseconds
 */
export const formatLongTime = (seconds: number): string => {
    // Use the detailed format
    return formatDetailedTime(seconds);
};
