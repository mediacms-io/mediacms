
export function formatTime(seconds: number, showMilliseconds: boolean = false): string {
  if (isNaN(seconds) || seconds === null) return '00:00:00.000';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return showMilliseconds 
    ? `${timeStr}.${ms.toString().padStart(3, '0')}`
    : `${timeStr}.000`;
}

export function parseTimeToSeconds(timeString: string): number {
  try {
    // Handle different formats: HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
    const parts = timeString.split(':');

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
      // Format: HH:MM:SS.mmm
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
      seconds = parseFloat(parts[2]) || 0;
    } else if (parts.length === 2) {
      // Format: MM:SS.mmm
      minutes = parseInt(parts[0], 10) || 0;
      seconds = parseFloat(parts[1]) || 0;
    } else if (parts.length === 1) {
      // Format: SS.mmm
      seconds = parseFloat(parts[0]) || 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
  } catch (error) {
    console.error("Error parsing time string:", error);
    return 0;
  }
}
