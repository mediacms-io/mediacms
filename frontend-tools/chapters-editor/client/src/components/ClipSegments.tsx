import { formatTime, formatLongTime } from '@/lib/timeUtils';
import '../styles/ClipSegments.css';

export interface Segment {
    id: number;
    chapterTitle: string;
    startTime: number;
    endTime: number;
}

interface ClipSegmentsProps {
    segments: Segment[];
    selectedSegmentId?: number | null;
}

const ClipSegments = ({ segments, selectedSegmentId }: ClipSegmentsProps) => {
    // Sort segments by startTime
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

    // Handle delete segment click
    const handleDeleteSegment = (segmentId: number) => {
        // Create and dispatch the delete event
        const deleteEvent = new CustomEvent('delete-segment', {
            detail: { segmentId },
        });
        document.dispatchEvent(deleteEvent);
    };

    // Generate the same color background for a segment as shown in the timeline
    const getSegmentColorClass = (index: number) => {
        // Return CSS class based on index modulo 20
        // This matches the CSS classes for up to 20 segments
        return `segment-default-color segment-color-${(index % 20) + 1}`;
    };

    // Get selected segment
    const selectedSegment = sortedSegments.find((seg) => seg.id === selectedSegmentId);

    return (
        <div className="clip-segments-container">
            <h3 className="clip-segments-title">Chapters</h3>

            {sortedSegments.map((segment, index) => (
                <div
                    key={segment.id}
                    className={`segment-item ${getSegmentColorClass(index)} ${selectedSegmentId === segment.id ? 'selected' : ''}`}
                >
                    <div className="segment-content">
                        <div className="segment-info">
                            <div className="segment-title">
                                {segment.chapterTitle ? (
                                    <span className="chapter-title">{segment.chapterTitle}</span>
                                ) : (
                                    <span className="default-title">Chapter {index + 1}</span>
                                )}
                            </div>
                            <div className="segment-time">
                                {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                            </div>
                            <div className="segment-duration">
                                Duration: {formatLongTime(segment.endTime - segment.startTime)}
                            </div>
                        </div>
                    </div>
                    <div className="segment-actions">
                        <button
                            className="delete-button"
                            aria-label="Delete Chapter"
                            data-tooltip="Delete this chapter"
                            onClick={() => handleDeleteSegment(segment.id)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}

            {sortedSegments.length === 0 && (
                <div className="empty-message">
                    No chapters created yet. Use the split button to create chapter segments.
                </div>
            )}
        </div>
    );
};

export default ClipSegments;
