import { useRef, useEffect, useState, useCallback } from 'react';
import { formatTime, formatDetailedTime } from '../lib/timeUtils';
import { generateThumbnail, generateSolidColor } from '../lib/videoUtils';
import { Segment } from './ClipSegments';
import Modal from './Modal';
import { trimVideo, autoSaveVideo } from '../services/videoApi';
import logger from '../lib/logger';
import '../styles/TimelineControls.css';
import '../styles/TwoRowTooltip.css';
import playIcon from '../assets/play-icon.svg';
import pauseIcon from '../assets/pause-icon.svg';
import playFromBeginningIcon from '../assets/play-from-beginning-icon.svg';
import segmentEndIcon from '../assets/segment-end-new.svg';
import segmentStartIcon from '../assets/segment-start-new.svg';
import segmentNewStartIcon from '../assets/segment-start-new-cutaway.svg';
import segmentNewEndIcon from '../assets/segment-end-new-cutaway.svg';

// Add styles for the media page link
const mediaPageLinkStyles = {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
    '&:hover': {
        textDecoration: 'underline',
        color: '#0056b3',
    },
} as const;

interface TimelineControlsProps {
    currentTime: number;
    duration: number;
    thumbnails: string[];
    trimStart: number;
    trimEnd: number;
    splitPoints: number[];
    zoomLevel: number;
    clipSegments: Segment[];
    onTrimStartChange: (time: number) => void;
    onTrimEndChange: (time: number) => void;
    onZoomChange: (level: number) => void;
    onSeek: (time: number) => void;
    videoRef: React.RefObject<HTMLVideoElement>;
    onSave?: () => void;
    onSaveACopy?: () => void;
    onSaveSegments?: () => void;
    hasUnsavedChanges?: boolean;
    isIOSUninitialized?: boolean;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    onPlayPause: () => void; // Add this prop
    isPlayingSegments?: boolean;
}

// Function to calculate and constrain tooltip position to keep it on screen
// Uses smooth transitions instead of hard breakpoints to eliminate jumping
const constrainTooltipPosition = (positionPercent: number) => {
    // Smooth transition zones instead of hard breakpoints
    const leftTransitionStart = 0;
    const leftTransitionEnd = 25;
    const rightTransitionStart = 75;
    const rightTransitionEnd = 100;

    let leftValue: string;
    let transform: string;

    if (positionPercent <= leftTransitionEnd) {
        // Left side: smooth transition from center to left-aligned
        if (positionPercent <= leftTransitionStart) {
            // Fully left-aligned
            leftValue = '0%';
            transform = 'none';
        } else {
            // Smooth transition zone
            const transitionProgress =
                (positionPercent - leftTransitionStart) / (leftTransitionEnd - leftTransitionStart);
            const translateAmount = -50 * transitionProgress; // Gradually reduce from 0% to -50%
            leftValue = `${positionPercent}%`;
            transform = `translateX(${translateAmount}%)`;
        }
    } else if (positionPercent >= rightTransitionStart) {
        // Right side: smooth transition from center to right-aligned
        if (positionPercent >= rightTransitionEnd) {
            // Fully right-aligned
            leftValue = '100%';
            transform = 'translateX(-100%)';
        } else {
            // Smooth transition zone
            const transitionProgress =
                (positionPercent - rightTransitionStart) / (rightTransitionEnd - rightTransitionStart);
            const translateAmount = -50 - 50 * transitionProgress; // Gradually change from -50% to -100%
            leftValue = `${positionPercent}%`;
            transform = `translateX(${translateAmount}%)`;
        }
    } else {
        // Center zone: normal centered positioning
        leftValue = `${positionPercent}%`;
        transform = 'translateX(-50%)';
    }

    return { left: leftValue, transform };
};

const TimelineControls = ({
    currentTime,
    duration,
    thumbnails,
    trimStart,
    trimEnd,
    splitPoints,
    zoomLevel,
    clipSegments,
    onTrimStartChange,
    onTrimEndChange,
    onZoomChange,
    onSeek,
    videoRef,
    onSave,
    onSaveACopy,
    onSaveSegments,
    hasUnsavedChanges = false,
    isIOSUninitialized = false,
    isPlaying,
    setIsPlaying,
    onPlayPause, // Add this prop
    isPlayingSegments = false,
}: TimelineControlsProps) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const leftHandleRef = useRef<HTMLDivElement>(null);
    const rightHandleRef = useRef<HTMLDivElement>(null);
    const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
    const [showEmptySpaceTooltip, setShowEmptySpaceTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [clickedTime, setClickedTime] = useState<number>(0);
    const [isZoomDropdownOpen, setIsZoomDropdownOpen] = useState(false);
    const [availableSegmentDuration, setAvailableSegmentDuration] = useState<number>(30); // Default 30 seconds
    const [isPlayingSegment, setIsPlayingSegment] = useState(false);
    const [activeSegment, setActiveSegment] = useState<Segment | null>(null);
    const [displayTime, setDisplayTime] = useState<number>(0);
    // Track when we should continue playing (clicking play after boundary stop)
    const [continuePastBoundary, setContinuePastBoundary] = useState<boolean>(false);

    // Reference for the scrollable container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-save related state
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>('');
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const clipSegmentsRef = useRef(clipSegments);

    // Keep clipSegmentsRef updated
    useEffect(() => {
        clipSegmentsRef.current = clipSegments;
    }, [clipSegments]);

    // Auto-save function
    const performAutoSave = useCallback(async () => {
        try {
            setIsAutoSaving(true);

            // Format segments data for API request - use ref to get latest segments
            const segments = clipSegmentsRef.current.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
                name: segment.name,
            }));

            logger.debug('segments', segments);

            const mediaId = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId) || null;
            // For testing, use '1234' if no mediaId is available
            const finalMediaId = mediaId || '1234';

            logger.debug('mediaId', finalMediaId);

            if (!finalMediaId || segments.length === 0) {
                logger.debug('No mediaId or segments, skipping auto-save');
                setIsAutoSaving(false);
                return;
            }

            logger.debug('Auto-saving segments:', { mediaId: finalMediaId, segments });

            const response = await autoSaveVideo(finalMediaId, { segments });

            if (response.success) {
                logger.debug('Auto-save successful');
                // Format the timestamp for display
                const date = new Date(response.timestamp);
                const formattedTime = date
                    .toLocaleString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                    })
                    .replace(',', '');

                setLastAutoSaveTime(formattedTime);
                logger.debug('Auto-save successful:', formattedTime);
            } else {
                logger.error('Auto-save failed:', response.error);
            }
        } catch (error) {
            logger.error('Auto-save error:', error);
        } finally {
            setIsAutoSaving(false);
        }
    }, []);

    // Schedule auto-save with debounce
    const scheduleAutoSave = useCallback(() => {
        // Clear any existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            logger.debug('Cleared existing auto-save timer');
        }

        logger.debug('Scheduling new auto-save in 1 second...');

        // Schedule new auto-save after 1 second of inactivity
        const timerId = setTimeout(() => {
            logger.debug('Auto-save timer fired! Calling performAutoSave...');
            performAutoSave();
        }, 1000);

        autoSaveTimerRef.current = timerId;
        logger.debug('Timer ID set:', timerId);
    }, [performAutoSave]);

    // Helper function for time adjustment buttons to maintain playback state
    const handleTimeAdjustment = (offsetSeconds: number) => (e: React.MouseEvent) => {
        e.stopPropagation();

        // Calculate new time based on offset (positive or negative)
        const newTime =
            offsetSeconds < 0
                ? Math.max(0, clickedTime + offsetSeconds) // For negative offsets (going back)
                : Math.min(duration, clickedTime + offsetSeconds); // For positive offsets (going forward)

        // Save the current playing state before seeking
        const wasPlaying = isPlayingSegment;

        // Seek to the new time
        onSeek(newTime);

        // Update both clicked time and display time
        setClickedTime(newTime);
        setDisplayTime(newTime);

        // Resume playback if it was playing before
        if (wasPlaying && videoRef.current) {
            videoRef.current.play();
            setIsPlayingSegment(true);
        }
    };

    // Enhanced helper for continuous time adjustment when button is held down
    const handleContinuousTimeAdjustment = (offsetSeconds: number) => {
        // Fixed adjustment amount - exactly 50ms each time
        const adjustmentValue = offsetSeconds;
        // Hold timer for continuous adjustment
        let holdTimer: NodeJS.Timeout | null = null;
        let continuousTimer: NodeJS.Timeout | null = null;
        // Store the last time value to correctly calculate the next increment
        let lastTimeValue = clickedTime;

        // Function to perform time adjustment
        const adjustTime = () => {
            // Calculate new time based on fixed offset (positive or negative)
            const newTime =
                adjustmentValue < 0
                    ? Math.max(0, lastTimeValue + adjustmentValue) // For negative offsets (going back)
                    : Math.min(duration, lastTimeValue + adjustmentValue); // For positive offsets (going forward)

            // Update our last time value for next adjustment
            lastTimeValue = newTime;

            // Save the current playing state before seeking
            const wasPlaying = isPlayingSegment;

            // Seek to the new time
            onSeek(newTime);

            // Update both clicked time and display time
            setClickedTime(newTime);
            setDisplayTime(newTime);

            // Update tooltip position
            if (timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const positionPercent = (newTime / duration) * 100;
                const xPos = rect.left + rect.width * (positionPercent / 100);
                setTooltipPosition({
                    x: xPos,
                    y: rect.top - 10,
                });

                // Find if we're in a segment at the new time
                const segmentAtTime = clipSegments.find((seg) => newTime >= seg.startTime && newTime <= seg.endTime);

                if (segmentAtTime) {
                    // Show segment tooltip
                    setSelectedSegmentId(segmentAtTime.id);
                    setShowEmptySpaceTooltip(false);
                } else {
                    // Show cutaway tooltip
                    setSelectedSegmentId(null);
                    const availableSpace = calculateAvailableSpace(newTime);
                    setAvailableSegmentDuration(availableSpace);
                    setShowEmptySpaceTooltip(true);
                }
            }

            // Resume playback if it was playing before
            if (wasPlaying && videoRef.current) {
                videoRef.current.play();
                setIsPlayingSegment(true);
            }
        };

        // Return mouse event handlers with touch support
        return {
            onMouseDown: (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();

                // Update the initial last time value
                lastTimeValue = clickedTime;

                // Perform initial adjustment
                adjustTime();

                // Start continuous adjustment after 1.5s hold
                holdTimer = setTimeout(() => {
                    // After 1.5s delay, start adjusting at a slower pace (every 200ms)
                    continuousTimer = setInterval(adjustTime, 200);
                }, 750);

                // Add mouse up and leave handlers to document to ensure we catch the release
                const clearTimers = () => {
                    if (holdTimer) {
                        clearTimeout(holdTimer);
                        holdTimer = null;
                    }
                    if (continuousTimer) {
                        clearInterval(continuousTimer);
                        continuousTimer = null;
                    }
                    document.removeEventListener('mouseup', clearTimers);
                    document.removeEventListener('mouseleave', clearTimers);
                };

                document.addEventListener('mouseup', clearTimers);
                document.addEventListener('mouseleave', clearTimers);
            },
            onTouchStart: (e: React.TouchEvent) => {
                e.stopPropagation();
                e.preventDefault();
                21;

                // Update the initial last time value
                lastTimeValue = clickedTime;

                // Perform initial adjustment
                adjustTime();

                // Start continuous adjustment after 1.5s hold
                holdTimer = setTimeout(() => {
                    // After 1.5s delay, start adjusting at a slower pace (every 200ms)
                    continuousTimer = setInterval(adjustTime, 200);
                }, 750);

                // Add touch end handler to ensure we catch the release
                const clearTimers = () => {
                    if (holdTimer) {
                        clearTimeout(holdTimer);
                        holdTimer = null;
                    }
                    if (continuousTimer) {
                        clearInterval(continuousTimer);
                        continuousTimer = null;
                    }
                    document.removeEventListener('touchend', clearTimers);
                    document.removeEventListener('touchcancel', clearTimers);
                };

                document.addEventListener('touchend', clearTimers);
                document.addEventListener('touchcancel', clearTimers);
            },
            onClick: (e: React.MouseEvent) => {
                // This prevents the click event from firing twice
                e.stopPropagation();
            },
        };
    };

    // Modal states
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveAsModal, setShowSaveAsModal] = useState(false);
    const [showSaveSegmentsModal, setShowSaveSegmentsModal] = useState(false);
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [redirectUrl, setRedirectUrl] = useState('');
    const [saveType, setSaveType] = useState<'save' | 'copy' | 'segments'>('save');

    // Calculate positions as percentages
    const currentTimePercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const trimStartPercent = duration > 0 ? (trimStart / duration) * 100 : 0;
    const trimEndPercent = duration > 0 ? (trimEnd / duration) * 100 : 0;

    // No need for an extra effect here as we handle displayTime updates in the segment playback effect

    // Save and API handlers
    const handleSaveConfirm = async () => {
        // Close confirmation modal and show processing modal
        setShowSaveModal(false);
        setShowProcessingModal(true);
        setSaveType('save');

        try {
            // Format segments data for API request
            const segments = clipSegments.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
            }));

            const mediaId = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId) || null;
            const redirectURL = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.redirectURL) || null;

            // Log the request details for debugging
            logger.debug('Save request:', {
                mediaId,
                segments,
                saveAsCopy: false,
                redirectURL,
            });

            const response = await trimVideo(mediaId, {
                segments,
                saveAsCopy: false,
            });

            // Log the response for debugging
            logger.debug('Save response:', response);

            // Hide processing modal
            setShowProcessingModal(false);

            // Check if response indicates success (200 OK)
            if (response.status === 200) {
                // For "Save", use the redirectURL from the window or response
                const finalRedirectUrl = redirectURL || response.url_redirect;
                logger.debug('Using redirect URL:', finalRedirectUrl);

                setRedirectUrl(finalRedirectUrl);
                setSuccessMessage('Video saved successfully!');

                // Show success modal
                setShowSuccessModal(true);
            } else if (response.status === 400) {
                // Set error message from response and show error modal
                const errorMsg = response.error || 'An error occurred during processing';
                logger.debug('Save error (400):', errorMsg);
                setErrorMessage(errorMsg);
                setShowErrorModal(true);
            } else {
                // Handle other status codes as needed
                logger.debug('Save error (unknown status):', response);
                setErrorMessage('An unexpected error occurred');
                setShowErrorModal(true);
            }
        } catch (error) {
            logger.error('Error processing video:', error);
            setShowProcessingModal(false);

            // Set error message and show error modal
            const errorMsg = error instanceof Error ? error.message : 'An error occurred during processing';
            logger.debug('Save error (exception):', errorMsg);
            setErrorMessage(errorMsg);
            setShowErrorModal(true);
        }
    };

    const handleSaveAsCopyConfirm = async () => {
        // Close confirmation modal and show processing modal
        setShowSaveAsModal(false);
        setShowProcessingModal(true);
        setSaveType('copy');

        try {
            // Format segments data for API request
            const segments = clipSegments.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
            }));

            const mediaId = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId) || null;
            const redirectUserMediaURL =
                (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.redirectUserMediaURL) || null;

            // Log the request details for debugging
            logger.debug('Save as copy request:', {
                mediaId,
                segments,
                saveAsCopy: true,
                redirectUserMediaURL,
            });

            const response = await trimVideo(mediaId, {
                segments,
                saveAsCopy: true,
            });

            // Log the response for debugging
            logger.debug('Save as copy response:', response);

            // Hide processing modal
            setShowProcessingModal(false);

            // Check if response indicates success (200 OK)
            if (response.status === 200) {
                // For "Save As Copy", use the redirectUserMediaURL from the window
                const finalRedirectUrl = redirectUserMediaURL || response.url_redirect;
                logger.debug('Using redirect user media URL:', finalRedirectUrl);

                setRedirectUrl(finalRedirectUrl);
                setSuccessMessage('Video saved as a new copy!');

                // Show success modal
                setShowSuccessModal(true);
            } else if (response.status === 400) {
                // Set error message from response and show error modal
                const errorMsg = response.error || 'An error occurred during processing';
                logger.debug('Save as copy error (400):', errorMsg);
                setErrorMessage(errorMsg);
                setShowErrorModal(true);
            } else {
                // Handle other status codes as needed
                logger.debug('Save as copy error (unknown status):', response);
                setErrorMessage('An unexpected error occurred');
                setShowErrorModal(true);
            }
        } catch (error) {
            logger.error('Error processing video:', error);
            setShowProcessingModal(false);

            // Set error message and show error modal
            const errorMsg = error instanceof Error ? error.message : 'An error occurred during processing';
            logger.debug('Save as copy error (exception):', errorMsg);
            setErrorMessage(errorMsg);
            setShowErrorModal(true);
        }
    };

    const handleSaveSegmentsConfirm = async () => {
        // Close confirmation modal and show processing modal
        setShowSaveSegmentsModal(false);
        setShowProcessingModal(true);
        setSaveType('segments');

        try {
            // Format segments data for API request, with each segment saved as a separate file
            const segments = clipSegments.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
                name: segment.name, // Include segment name for individual files
            }));

            const mediaId = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId) || null;
            const redirectUserMediaURL =
                (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.redirectUserMediaURL) || null;

            // Log the request details for debugging
            logger.debug('Save segments request:', {
                mediaId,
                segments,
                saveAsCopy: true,
                saveIndividualSegments: true,
                redirectUserMediaURL,
            });

            const response = await trimVideo(mediaId, {
                segments,
                saveAsCopy: true,
                saveIndividualSegments: true,
            });

            // Log the response for debugging
            logger.debug('Save segments response:', response);

            // Hide processing modal
            setShowProcessingModal(false);

            // Check if response indicates success (200 OK)
            if (response.status === 200) {
                // For "Save Segments", use the redirectUserMediaURL from the window
                const finalRedirectUrl = redirectUserMediaURL || response.url_redirect;
                logger.debug('Using redirect user media URL for segments:', finalRedirectUrl);

                setRedirectUrl(finalRedirectUrl);
                setSuccessMessage(`${segments.length} segments saved successfully!`);

                // Show success modal
                setShowSuccessModal(true);
            } else if (response.status === 400) {
                // Set error message from response and show error modal
                const errorMsg = response.error || 'An error occurred during processing';
                logger.debug('Save segments error (400):', errorMsg);
                setErrorMessage(errorMsg);
                setShowErrorModal(true);
            } else {
                // Handle other status codes as needed
                logger.debug('Save segments error (unknown status):', response);
                setErrorMessage('An unexpected error occurred');
                setShowErrorModal(true);
            }
        } catch (error) {
            // Handle errors
            logger.error('Error processing video segments:', error);
            setShowProcessingModal(false);

            // Set error message and show error modal
            const errorMsg = error instanceof Error ? error.message : 'An error occurred during processing';
            logger.debug('Save segments error (exception):', errorMsg);
            setErrorMessage(errorMsg);
            setShowErrorModal(true);
        }
    };

    // Auto-scroll and update tooltip position when seeking to a different time
    useEffect(() => {
        if (scrollContainerRef.current && timelineRef.current && zoomLevel > 1) {
            const containerWidth = scrollContainerRef.current.clientWidth;
            const timelineWidth = timelineRef.current.clientWidth;
            const markerPosition = (currentTime / duration) * timelineWidth;

            // Calculate the position where we want the marker to be visible
            // (center of the viewport when possible)
            const desiredScrollPosition = Math.max(0, markerPosition - containerWidth / 2);

            // Smooth scroll to the desired position
            scrollContainerRef.current.scrollTo({
                left: desiredScrollPosition,
                behavior: 'smooth',
            });

            // Update tooltip position to stay with the marker
            const rect = timelineRef.current.getBoundingClientRect();

            // Calculate the visible position of the marker after scrolling
            const containerRect = scrollContainerRef.current.getBoundingClientRect();
            const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
            const markerX = visibleTimelineLeft + (currentTimePercent / 100) * rect.width;

            // Only update if we have a tooltip showing
            if (selectedSegmentId !== null || showEmptySpaceTooltip) {
                setTooltipPosition({
                    x: markerX,
                    y: rect.top - 10,
                });
                setClickedTime(currentTime);
            }
        }
    }, [currentTime, zoomLevel, duration, selectedSegmentId, showEmptySpaceTooltip, currentTimePercent]);

    // Effect to check active segment boundaries during playback
    useEffect(() => {
        // Skip if no video or no active segment
        const video = videoRef.current;
        if (!video || !activeSegment || !isPlayingSegment) {
            // Log why we're skipping
            if (!video) logger.debug('Skipping segment boundary check - no video element');
            else if (!activeSegment) logger.debug('Skipping segment boundary check - no active segment');
            else if (!isPlayingSegment) logger.debug('Skipping segment boundary check - not in segment playback mode');
            return;
        }

        // Skip boundary checking when playing all segments
        if (isPlayingSegments) {
            logger.debug('Skipping segment boundary check during segments playback');
            return;
        }

        logger.debug(
            'Segment boundary check ACTIVATED for segment:',
            activeSegment.id,
            'Start:',
            formatDetailedTime(activeSegment.startTime),
            'End:',
            formatDetailedTime(activeSegment.endTime)
        );

        const handleTimeUpdate = () => {
            const timeLeft = activeSegment.endTime - video.currentTime;

            // Log every second to show we're actually checking
            if (Math.round(timeLeft * 10) % 10 === 0) {
                logger.debug(
                    'Segment playback - time remaining:',
                    formatDetailedTime(timeLeft),
                    'Current:',
                    formatDetailedTime(video.currentTime),
                    'End:',
                    formatDetailedTime(activeSegment.endTime),
                    'ContinuePastBoundary:',
                    continuePastBoundary
                );
            }

            // If we've already passed the segment end, stop immediately
            if (video.currentTime > activeSegment.endTime) {
                video.pause();
                video.currentTime = activeSegment.endTime;
                setIsPlayingSegment(false);
                // Reset continuePastBoundary when stopping at boundary
                setContinuePastBoundary(false);
                logger.debug(
                    'Passed segment end - setting back to exact boundary:',
                    formatDetailedTime(activeSegment.endTime)
                );
                return;
            }

            // If we've reached very close to the end of the active segment
            // Use a small tolerance to ensure we stop as close as possible to boundary
            // But not exactly at the boundary to avoid rounding errors
            if (activeSegment.endTime - video.currentTime < 0.05) {
                if (!continuePastBoundary) {
                    // Pause playback and set the time exactly at the end boundary
                    video.pause();
                    video.currentTime = activeSegment.endTime;
                    setIsPlayingSegment(false);
                    logger.debug('Paused at segment end boundary:', formatDetailedTime(activeSegment.endTime));

                    // Look for the next segment after this one (for potential continuation)
                    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
                    const nextSegment = sortedSegments.find((seg) => seg.startTime > activeSegment.endTime);

                    // If there's a next segment immediately after this one, update the tooltip to show that segment
                    if (nextSegment && Math.abs(nextSegment.startTime - activeSegment.endTime) < 0.1) {
                        logger.debug('Found adjacent next segment:', nextSegment.id);
                        setSelectedSegmentId(nextSegment.id);
                        setActiveSegment(nextSegment);
                        setDisplayTime(nextSegment.startTime);
                        setClickedTime(nextSegment.startTime);
                        video.currentTime = nextSegment.startTime;
                    }
                } else {
                    // We're continuing past the boundary
                    logger.debug('Continuing past segment boundary:', formatDetailedTime(activeSegment.endTime));

                    // Reset the flag after we've passed the boundary to ensure we stop at the next boundary
                    if (video.currentTime > activeSegment.endTime) {
                        setContinuePastBoundary(false);
                        logger.debug('Past segment boundary - resetting continuePastBoundary flag');
                        // Remove the active segment to avoid boundary checking until next segment is activated
                        setActiveSegment(null);
                        sessionStorage.removeItem('continuingPastSegment');
                    }
                }
            }
        };

        // Add event listener for timeupdate to check segment boundaries
        video.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            logger.debug('Segment boundary check DEACTIVATED');
        };
    }, [activeSegment, isPlayingSegment, continuePastBoundary, clipSegments]);

    // Update display time and check for transitions between segments and empty spaces
    useEffect(() => {
        // Always update display time to match current video time
        if (videoRef.current) {
            // Always update display time when current time changes (both playing and paused)
            setDisplayTime(currentTime);
            
            // If video is playing, also update the tooltip and perform segment checks
            if (!videoRef.current.paused) {
                // Also update clicked time to keep them in sync when playing
                // This ensures correct time is shown when pausing
                setClickedTime(currentTime);

                if (selectedSegmentId !== null) {
                    setIsPlayingSegment(true);
                }

                // While playing, continuously check if we're in a segment or empty space
                // to update the tooltip accordingly, regardless of where we started playing

                // Check if we're in any segment at current time
                const segmentAtCurrentTime = clipSegments.find(
                    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
                );

                // Update tooltip position based on current time percentage
                const newTimePercent = (currentTime / duration) * 100;
                if (timelineRef.current) {
                    const timelineWidth = timelineRef.current.offsetWidth;
                    const markerX = (newTimePercent / 100) * timelineWidth;
                    setTooltipPosition({
                        x: markerX,
                        y: timelineRef.current.getBoundingClientRect().top - 10,
                    });
                }

                // Check for the special "continue past segment" state in sessionStorage
                const isContinuingPastSegment = sessionStorage.getItem('continuingPastSegment') === 'true';

                // If we're in a segment now
                if (segmentAtCurrentTime) {
                    // Get video element reference for boundary checks
                    const video = videoRef.current;

                    // Special check for virtual segments (cutaway playback)
                    // If we have an active virtual segment (negative ID) and we're in a regular segment now,
                    // we need to STOP at the start of this segment - that's the boundary of our cutaway
                    const isPlayingVirtualSegment = activeSegment && activeSegment.id < 0 && isPlayingSegment;

                    // If the active segment is different from the current segment and it's not a virtual segment
                    // and we're not in "continue past boundary" mode, set this segment as the active segment
                    if (
                        activeSegment?.id !== segmentAtCurrentTime.id &&
                        !isPlayingVirtualSegment &&
                        !isContinuingPastSegment &&
                        !continuePastBoundary
                    ) {
                        // We've entered a new segment during normal playback
                        logger.debug(
                            `Entered a new segment during playback: ${segmentAtCurrentTime.id}, setting as active`
                        );
                        setActiveSegment(segmentAtCurrentTime);
                        setSelectedSegmentId(segmentAtCurrentTime.id);
                        setShowEmptySpaceTooltip(false);
                        // Reset continuation flags to ensure boundary detection works for this new segment
                        setContinuePastBoundary(false);
                        sessionStorage.removeItem('continuingPastSegment');
                    }

                    // If we're playing a virtual segment and enter a real segment, we've reached our boundary
                    // We should stop playback
                    if (isPlayingVirtualSegment && video && segmentAtCurrentTime) {
                        logger.debug(
                            `CUTAWAY BOUNDARY REACHED: Current position ${formatDetailedTime(
                                video.currentTime
                            )} at segment ${segmentAtCurrentTime.id} - STOPPING at boundary ${formatDetailedTime(
                                segmentAtCurrentTime.startTime
                            )}`
                        );
                        video.pause();
                        // Force exact time position with high precision and multiple attempts
                        setTimeout(() => {
                            if (videoRef.current) {
                                // First seek directly to exact start time, no offset
                                videoRef.current.currentTime = segmentAtCurrentTime.startTime;
                                // Update UI immediately to match video position
                                onSeek(segmentAtCurrentTime.startTime);
                                // Also update tooltip time displays
                                setDisplayTime(segmentAtCurrentTime.startTime);
                                setClickedTime(segmentAtCurrentTime.startTime);

                                // Reset continuePastBoundary when reaching a segment boundary
                                setContinuePastBoundary(false);

                                // Update tooltip to show segment tooltip at boundary
                                setSelectedSegmentId(segmentAtCurrentTime.id);
                                setShowEmptySpaceTooltip(false);

                                // Force multiple adjustments to ensure exact precision
                                const verifyPosition = () => {
                                    if (videoRef.current) {
                                        // Always force the exact time in every verification
                                        videoRef.current.currentTime = segmentAtCurrentTime.startTime;

                                        // Make sure we update the UI to reflect the corrected position
                                        onSeek(segmentAtCurrentTime.startTime);

                                        // Update the displayTime and clickedTime state to match exact position
                                        setDisplayTime(segmentAtCurrentTime.startTime);
                                        setClickedTime(segmentAtCurrentTime.startTime);

                                        logger.debug(
                                            `Position corrected to exact segment boundary: ${formatDetailedTime(
                                                videoRef.current.currentTime
                                            )} (target: ${formatDetailedTime(segmentAtCurrentTime.startTime)})`
                                        );
                                    }
                                };

                                // Apply multiple correction attempts with increasing delays
                                setTimeout(verifyPosition, 10); // Immediate correction
                                setTimeout(verifyPosition, 20); // First correction
                                setTimeout(verifyPosition, 50); // Second correction
                                setTimeout(verifyPosition, 100); // Third correction
                                setTimeout(verifyPosition, 200); // Final correction

                                // Also add event listeners to ensure position is corrected whenever video state changes
                                videoRef.current.addEventListener('seeked', verifyPosition);
                                videoRef.current.addEventListener('canplay', verifyPosition);
                                videoRef.current.addEventListener('waiting', verifyPosition);

                                // Remove these event listeners after a short time
                                setTimeout(() => {
                                    if (videoRef.current) {
                                        videoRef.current.removeEventListener('seeked', verifyPosition);
                                        videoRef.current.removeEventListener('canplay', verifyPosition);
                                        videoRef.current.removeEventListener('waiting', verifyPosition);
                                    }
                                }, 300);
                            }
                        }, 10);
                        setIsPlayingSegment(false);
                        setActiveSegment(null);
                        return; // Exit early, we've handled this case
                    }

                    // Only update active segment if we're not in "continue past segment" mode
                    // or if we're in a virtual cutaway segment
                    const continuingPastSegment =
                        (activeSegment === null && isPlayingSegment === true) ||
                        isContinuingPastSegment ||
                        isPlayingVirtualSegment;

                    if (continuingPastSegment) {
                        // We're in the special case where we're continuing past a segment boundary
                        // or playing a cutaway area
                        // Just update the tooltip, but don't reactivate boundary checking
                        if (selectedSegmentId !== segmentAtCurrentTime.id || showEmptySpaceTooltip) {
                            logger.debug(
                                'Tooltip updated for segment during continued playback:',
                                segmentAtCurrentTime.id,
                                isPlayingVirtualSegment ? '(cutaway playback - keeping virtual segment)' : ''
                            );
                            setSelectedSegmentId(segmentAtCurrentTime.id);
                            setShowEmptySpaceTooltip(false);

                            // If we're in a different segment now, clear the continuation flag
                            // but only if it's not the same segment we were in before
                            // AND we're not playing a cutaway area
                            if (
                                !isPlayingVirtualSegment &&
                                sessionStorage.getItem('lastSegmentId') !== segmentAtCurrentTime.id.toString()
                            ) {
                                logger.debug('Moved to a different segment - ending continuation mode');
                                sessionStorage.removeItem('continuingPastSegment');
                            }
                        }
                    } else {
                        // Normal case - update both tooltip and active segment
                        if (activeSegment?.id !== segmentAtCurrentTime.id || showEmptySpaceTooltip) {
                            logger.debug('Playback moved into segment:', segmentAtCurrentTime.id);
                            setSelectedSegmentId(segmentAtCurrentTime.id);
                            setActiveSegment(segmentAtCurrentTime);
                            setShowEmptySpaceTooltip(false);

                            // Store the current segment ID for comparison later
                            sessionStorage.setItem('lastSegmentId', segmentAtCurrentTime.id.toString());
                        }
                    }
                }
                // If we're in empty space now
                else {
                    // Check if we need to change the tooltip (we were in a segment before)
                    if (activeSegment !== null || !showEmptySpaceTooltip) {
                        logger.debug('Playback moved to empty space');
                        setSelectedSegmentId(null);
                        setActiveSegment(null);

                        // Calculate available space for new segment before showing tooltip
                        const availableSpace = calculateAvailableSpace(currentTime);
                        setAvailableSegmentDuration(availableSpace);

                        // Show empty space tooltip if there's enough space
                        if (availableSpace >= 0.5) {
                            setShowEmptySpaceTooltip(true);
                            logger.debug('Empty space with available duration:', availableSpace);
                        } else {
                            setShowEmptySpaceTooltip(false);
                        }
                    }
                }
            } else if (videoRef.current.paused && isPlayingSegment) {
                // When just paused from playing state, update display time to show the actual stopped position
                setDisplayTime(currentTime);
                setClickedTime(currentTime);
                setIsPlayingSegment(false);

                // Log the stopping point
                logger.debug('Video paused at:', formatDetailedTime(currentTime));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, isPlayingSegment, activeSegment, selectedSegmentId, clipSegments]);

    // Close zoom dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isZoomDropdownOpen && !target.closest('.zoom-dropdown-container')) {
                setIsZoomDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isZoomDropdownOpen]);

    // Listen for segment updates and trigger auto-save
    useEffect(() => {
        const handleSegmentUpdate = (event: CustomEvent) => {
            const { recordHistory, fromAutoSave } = event.detail;
            logger.debug('handleSegmentUpdate called, recordHistory:', recordHistory, 'fromAutoSave:', fromAutoSave);
            // Only auto-save when history is recorded and not loading from auto-save
            if (recordHistory && !fromAutoSave) {
                logger.debug('Calling scheduleAutoSave from handleSegmentUpdate');
                scheduleAutoSave();
            }
        };

        const handleSegmentDragEnd = () => {
            // Trigger auto-save when drag operations end
            scheduleAutoSave();
        };

        const handleTrimUpdate = (event: CustomEvent) => {
            const { recordHistory } = event.detail;
            // Only auto-save when history is recorded (i.e., after trim operations complete)
            if (recordHistory) {
                scheduleAutoSave();
            }
        };

        document.addEventListener('update-segments', handleSegmentUpdate as EventListener);
        document.addEventListener('segment-drag-end', handleSegmentDragEnd);
        document.addEventListener('update-trim', handleTrimUpdate as EventListener);
        document.addEventListener('delete-segment', scheduleAutoSave);
        document.addEventListener('split-segment', scheduleAutoSave);

        return () => {
            logger.debug('Cleaning up auto-save event listeners...');
            document.removeEventListener('update-segments', handleSegmentUpdate as EventListener);
            document.removeEventListener('segment-drag-end', handleSegmentDragEnd);
            document.removeEventListener('update-trim', handleTrimUpdate as EventListener);
            document.removeEventListener('delete-segment', scheduleAutoSave);
            document.removeEventListener('split-segment', scheduleAutoSave);

            // Clear any pending auto-save timer
            if (autoSaveTimerRef.current) {
                logger.debug('Clearing auto-save timer in cleanup:', autoSaveTimerRef.current);
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [scheduleAutoSave]);

    // Perform initial auto-save when component mounts with segments
    useEffect(() => {
        if (clipSegments.length > 0 && !lastAutoSaveTime) {
            // Perform initial auto-save after a short delay
            setTimeout(() => {
                performAutoSave();
            }, 500);
        }
    }, [lastAutoSaveTime, performAutoSave]);

    // Load saved segments from MEDIA_DATA on component mount
    useEffect(() => {
        const loadSavedSegments = () => {
            // Get savedSegments directly from window.MEDIA_DATA
            let savedData = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.savedSegments) || null;

            // If no saved segments, don't load anything - the useVideoTrimmer hook already creates the initial full-length segment
            if (!savedData) {
                logger.debug('No saved segments found in MEDIA_DATA, skipping load (initial segment already created by useVideoTrimmer)');
                return;
            }

            logger.debug('Loading saved segments:', savedData);

            try {
                if (savedData && savedData.segments && savedData.segments.length > 0) {
                    logger.debug('Found saved segments:', savedData);

                    // Convert the saved segments to the format expected by the component
                    const convertedSegments: Segment[] = savedData.segments.map((seg: any, index: number) => ({
                        id: Date.now() + index, // Generate unique IDs
                        name: seg.name || `Segment ${index + 1}`,
                        startTime: parseTimeString(seg.startTime),
                        endTime: parseTimeString(seg.endTime),
                        thumbnail: '',
                    }));

                    // Dispatch event to update segments
                    const updateEvent = new CustomEvent('update-segments', {
                        detail: {
                            segments: convertedSegments,
                            recordHistory: false, // Don't record loading saved segments in history
                            fromAutoSave: true,
                        },
                    });
                    document.dispatchEvent(updateEvent);

                    // Update the last auto-save time
                    if (savedData.updated_at) {
                        const date = new Date(savedData.updated_at);
                        const formattedTime = date
                            .toLocaleString('en-GB', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                            })
                            .replace(',', '');
                        setLastAutoSaveTime(formattedTime);
                    }
                } else {
                    logger.debug('No saved segments found');
                }
            } catch (error) {
                console.error('Error loading saved segments:', error);
            }
        };

        // Helper function to parse time string "HH:MM:SS.mmm" to seconds
        const parseTimeString = (timeStr: string): number => {
            const parts = timeStr.split(':');
            if (parts.length !== 3) return 0;

            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const secondsParts = parts[2].split('.');
            const seconds = parseInt(secondsParts[0]) || 0;
            const milliseconds = parseInt(secondsParts[1]) || 0;

            return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
        };

        // Load saved segments after a short delay to ensure component is ready
        setTimeout(loadSavedSegments, 100);
    }, []); // Run only once on mount

    // Global click handler to close tooltips when clicking outside
    useEffect(() => {
        // Remove the global click handler that closes tooltips
        // This keeps the popup always visible, even when clicking outside the timeline

        // Keeping the dependency array to avoid linting errors
        return () => {};
    }, [selectedSegmentId, showEmptySpaceTooltip, isPlayingSegment]);

    // Initialize drag handlers for trim handles
    useEffect(() => {
        const leftHandle = leftHandleRef.current;
        const rightHandle = rightHandleRef.current;
        const timeline = timelineRef.current;

        if (!leftHandle || !rightHandle || !timeline) return;

        const initDrag = (isLeft: boolean) => (e: MouseEvent) => {
            e.preventDefault();

            const timelineRect = timeline.getBoundingClientRect();
            let isDragging = true;
            let finalTime = isLeft ? trimStart : trimEnd; // Track the final time for history recording

            // Use custom events to indicate drag state
            const createCustomEvent = (type: string) => {
                return new CustomEvent('trim-handle-event', {
                    detail: { type, isStart: isLeft },
                });
            };

            // Dispatch start drag event to signal not to record history during drag
            document.dispatchEvent(createCustomEvent('drag-start'));

            const onMouseMove = (moveEvent: MouseEvent) => {
                if (!isDragging) return;

                const timelineWidth = timelineRect.width;
                const position = Math.max(0, Math.min(1, (moveEvent.clientX - timelineRect.left) / timelineWidth));
                const newTime = position * duration;

                // Store position globally for iOS Safari
                if (typeof window !== 'undefined') {
                    window.lastSeekedPosition = newTime;
                }

                if (isLeft) {
                    if (newTime < trimEnd) {
                        // Don't record in history during drag - this avoids multiple history entries
                        document.dispatchEvent(
                            new CustomEvent('update-trim', {
                                detail: {
                                    time: newTime,
                                    isStart: true,
                                    recordHistory: false,
                                },
                            })
                        );
                        finalTime = newTime;
                    }
                } else {
                    if (newTime > trimStart) {
                        // Don't record in history during drag - this avoids multiple history entries
                        document.dispatchEvent(
                            new CustomEvent('update-trim', {
                                detail: {
                                    time: newTime,
                                    isStart: false,
                                    recordHistory: false,
                                },
                            })
                        );
                        finalTime = newTime;
                    }
                }
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Now record the final position in history with action type
                if (isLeft) {
                    // Final update with history recording
                    document.dispatchEvent(
                        new CustomEvent('update-trim', {
                            detail: {
                                time: finalTime,
                                isStart: true,
                                recordHistory: true,
                                action: 'adjust_trim_start',
                            },
                        })
                    );
                } else {
                    document.dispatchEvent(
                        new CustomEvent('update-trim', {
                            detail: {
                                time: finalTime,
                                isStart: false,
                                recordHistory: true,
                                action: 'adjust_trim_end',
                            },
                        })
                    );
                }

                // Dispatch end drag event
                document.dispatchEvent(createCustomEvent('drag-end'));
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        leftHandle.addEventListener('mousedown', initDrag(true));
        rightHandle.addEventListener('mousedown', initDrag(false));

        return () => {
            leftHandle.removeEventListener('mousedown', initDrag(true));
            rightHandle.removeEventListener('mousedown', initDrag(false));
        };
    }, [duration, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]);

    // Render solid color backgrounds evenly spread across timeline
    const renderThumbnails = () => {
        // Create thumbnail sections even if we don't have actual thumbnail data
        const numSections = thumbnails.length || 10; // Default to 10 sections if no thumbnails

        return Array.from({ length: numSections }).map((_, index) => {
            const segmentDuration = duration / numSections;
            const segmentStartTime = index * segmentDuration;
            const segmentEndTime = segmentStartTime + segmentDuration;
            const midpointTime = (segmentStartTime + segmentEndTime) / 2;

            // Get a solid color based on the segment position
            const backgroundColor = generateSolidColor(midpointTime, duration);

            return (
                <div
                    key={index}
                    className="timeline-thumbnail"
                    style={{
                        width: `${100 / numSections}%`,
                        backgroundColor: backgroundColor,
                        // Remove background image and use solid color instead
                    }}
                />
            );
        });
    };

    // Render split points
    const renderSplitPoints = () => {
        return splitPoints.map((point, index) => {
            const pointPercent = (point / duration) * 100;
            return <div key={index} className="split-point" style={{ left: `${pointPercent}%` }}></div>;
        });
    };

    // Helper function to calculate available space for a new segment
    const calculateAvailableSpace = (startTime: number): number => {
        // Always return at least 0.1 seconds to ensure tooltip shows
        const MIN_SPACE = 0.1;

        // Determine the amount of available space:
        // 1. Check remaining space until the end of video
        const remainingDuration = Math.max(0, duration - startTime);

        // 2. Find the next segment (if any)
        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

        // Find the next and previous segments
        const nextSegment = sortedSegments.find((seg) => seg.startTime > startTime);
        const prevSegment = [...sortedSegments].reverse().find((seg) => seg.endTime < startTime);

        // Calculate the actual available space
        let availableSpace;
        if (nextSegment) {
            // Space until next segment
            availableSpace = nextSegment.startTime - startTime;
        } else {
            // Space until end of video
            availableSpace = duration - startTime;
        }

        // Log the space calculation for debugging
        logger.debug('Space calculation:', {
            position: formatDetailedTime(startTime),
            nextSegment: nextSegment ? formatDetailedTime(nextSegment.startTime) : 'none',
            prevSegment: prevSegment ? formatDetailedTime(prevSegment.endTime) : 'none',
            availableSpace: formatDetailedTime(Math.max(MIN_SPACE, availableSpace)),
        });

        // Always return at least MIN_SPACE to ensure tooltip shows
        return Math.max(MIN_SPACE, availableSpace);
    };

    // Function to update tooltip based on current time position
    const updateTooltipForPosition = (currentPosition: number) => {
        if (!timelineRef.current) return;

        // Find if we're in a segment at the current position with a small tolerance
        const segmentAtPosition = clipSegments.find((seg) => {
            const isWithinSegment = currentPosition >= seg.startTime && currentPosition <= seg.endTime;
            const isVeryCloseToStart = Math.abs(currentPosition - seg.startTime) < 0.001;
            const isVeryCloseToEnd = Math.abs(currentPosition - seg.endTime) < 0.001;
            return isWithinSegment || isVeryCloseToStart || isVeryCloseToEnd;
        });

        // Find the next and previous segments
        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
        const nextSegment = sortedSegments.find((seg) => seg.startTime > currentPosition);
        const prevSegment = [...sortedSegments].reverse().find((seg) => seg.endTime < currentPosition);

        if (segmentAtPosition) {
            // We're in or exactly at a segment boundary
            setSelectedSegmentId(segmentAtPosition.id);
            setShowEmptySpaceTooltip(false);
        } else {
            // We're in a cutaway area
            // Calculate available space for new segment
            const availableSpace = calculateAvailableSpace(currentPosition);
            setAvailableSegmentDuration(availableSpace);

            // Always show empty space tooltip
            setSelectedSegmentId(null);
            setShowEmptySpaceTooltip(true);

            // Log position info for debugging
            logger.debug('Cutaway position:', {
                current: formatDetailedTime(currentPosition),
                prevSegmentEnd: prevSegment ? formatDetailedTime(prevSegment.endTime) : 'none',
                nextSegmentStart: nextSegment ? formatDetailedTime(nextSegment.startTime) : 'none',
                availableSpace: formatDetailedTime(availableSpace),
            });
        }

        // Update tooltip position
        const rect = timelineRef.current.getBoundingClientRect();
        const positionPercent = (currentPosition / duration) * 100;
        let xPos;

        if (zoomLevel > 1 && scrollContainerRef.current) {
            // For zoomed timeline, adjust for scroll position
            const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
            xPos = visibleTimelineLeft + rect.width * (positionPercent / 100);
        } else {
            // For non-zoomed timeline, use simple calculation
            xPos = rect.left + rect.width * (positionPercent / 100);
        }

        setTooltipPosition({
            x: xPos,
            y: rect.top - 10,
        });
    };

    // Handle timeline click to seek and show a tooltip
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Remove the check that prevents interaction during preview mode
        // This allows users to click and jump in the timeline while previewing

        if (!timelineRef.current || !scrollContainerRef.current) return;

        // If on mobile device and video hasn't been initialized, don't handle timeline clicks
        if (isIOSUninitialized) {
            return;
        }

        // Check if video is globally playing before the click
        const wasPlaying = videoRef.current && !videoRef.current.paused;
        logger.debug('Video was playing before timeline click:', wasPlaying);

        // Reset continuation flag when clicking on timeline - ensures proper boundary detection
        setContinuePastBoundary(false);

        const rect = timelineRef.current.getBoundingClientRect();

        // Account for scroll position when calculating the click position
        let position;
        if (zoomLevel > 1) {
            // When zoomed, we need to account for the scroll position
            const scrollLeft = scrollContainerRef.current.scrollLeft;
            const totalWidth = timelineRef.current.clientWidth;
            position = (e.clientX - rect.left + scrollLeft) / totalWidth;
        } else {
            // Normal calculation for 1x zoom
            position = (e.clientX - rect.left) / rect.width;
        }

        const newTime = position * duration;

        // Log the position for debugging
        logger.debug(
            'Timeline clicked at:',
            formatDetailedTime(newTime),
            'distance from end:',
            formatDetailedTime(duration - newTime)
        );

        // Store position globally for iOS Safari (this is critical for first-time visits)
        if (typeof window !== 'undefined') {
            window.lastSeekedPosition = newTime;
        }

        // Seek to the clicked position immediately for all clicks
        onSeek(newTime);

        // Always update both clicked time and display time for tooltip actions
        setClickedTime(newTime);
        setDisplayTime(newTime);

        // Find if we clicked in a segment with a small tolerance for boundaries
        const segmentAtClickedTime = clipSegments.find((seg) => {
            // Standard check for being inside a segment
            const isInside = newTime >= seg.startTime && newTime <= seg.endTime;
            // Additional checks for being exactly at the start or end boundary (with small tolerance)
            const isAtStart = Math.abs(newTime - seg.startTime) < 0.01;
            const isAtEnd = Math.abs(newTime - seg.endTime) < 0.01;

            return isInside || isAtStart || isAtEnd;
        });

        // Handle active segment assignment for boundary checking
        if (segmentAtClickedTime) {
            setActiveSegment(segmentAtClickedTime);
        }

        // Resume playback based on the current mode
        if (videoRef.current) {
            // Special handling for segments playback mode
            if (isPlayingSegments && wasPlaying) {
                // Update the current segment index if we clicked into a segment
                if (segmentAtClickedTime) {
                    const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
                    const targetSegmentIndex = orderedSegments.findIndex((seg) => seg.id === segmentAtClickedTime.id);

                    if (targetSegmentIndex !== -1) {
                        // Dispatch a custom event to update the current segment index
                        const updateSegmentIndexEvent = new CustomEvent('update-segment-index', {
                            detail: { segmentIndex: targetSegmentIndex },
                        });
                        document.dispatchEvent(updateSegmentIndexEvent);
                        logger.debug(
                            `Segments playback mode: updating segment index to ${targetSegmentIndex} for timeline click in segment ${segmentAtClickedTime.id}`
                        );
                    }
                }

                logger.debug('Segments playback mode: resuming playback after timeline click');
                videoRef.current
                    .play()
                    .then(() => {
                        setIsPlayingSegment(true);
                        logger.debug('Resumed segments playback after timeline seeking');
                    })
                    .catch((err) => {
                        console.error('Error resuming segments playback:', err);
                        setIsPlayingSegment(false);
                    });
            }
            // Resume playback if it was playing before (but not during segments playback)
            else if (wasPlaying && !isPlayingSegments) {
                logger.debug('Resuming playback after timeline click');
                videoRef.current
                    .play()
                    .then(() => {
                        setIsPlayingSegment(true);
                        logger.debug('Resumed playback after seeking');
                    })
                    .catch((err) => {
                        console.error('Error resuming playback:', err);
                        setIsPlayingSegment(false);
                    });
            }
        }

        // Only process tooltip display if clicked on the timeline background or thumbnails, not on other UI elements
        if (e.target === timelineRef.current || (e.target as HTMLElement).classList.contains('timeline-thumbnail')) {
            // Check if there's a segment at the clicked position
            if (segmentAtClickedTime) {
                setSelectedSegmentId(segmentAtClickedTime.id);
                setShowEmptySpaceTooltip(false);
            } else {
                // We're in a cutaway area - always show tooltip
                setSelectedSegmentId(null);

                // Calculate the available space for a new segment
                const availableSpace = calculateAvailableSpace(newTime);
                setAvailableSegmentDuration(availableSpace);

                // Calculate and set tooltip position correctly for zoomed timeline
                let xPos;
                if (zoomLevel > 1) {
                    // For zoomed timeline, calculate the visible position
                    const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
                    const clickPosPercent = newTime / duration;
                    xPos = visibleTimelineLeft + clickPosPercent * rect.width;
                } else {
                    // For 1x zoom, use the client X
                    xPos = e.clientX;
                }

                setTooltipPosition({
                    x: xPos,
                    y: rect.top - 10, // Position tooltip above the timeline
                });

                // Always show the empty space tooltip in cutaway areas
                setShowEmptySpaceTooltip(true);

                // Log the cutaway area details
                const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
                const prevSegment = [...sortedSegments].reverse().find((seg) => seg.endTime < newTime);
                const nextSegment = sortedSegments.find((seg) => seg.startTime > newTime);

                logger.debug('Clicked in cutaway area:', {
                    position: formatDetailedTime(newTime),
                    availableSpace: formatDetailedTime(availableSpace),
                    prevSegmentEnd: prevSegment ? formatDetailedTime(prevSegment.endTime) : 'none',
                    nextSegmentStart: nextSegment ? formatDetailedTime(nextSegment.startTime) : 'none',
                });
            }
        }
    };

    // Handle segment resize - works with both mouse and touch events
    const handleSegmentResize = (segmentId: number, isLeft: boolean) => (e: React.MouseEvent | React.TouchEvent) => {
        // Remove the check that prevents interaction during preview mode
        // This allows users to resize segments while previewing

        e.preventDefault();
        e.stopPropagation(); // Prevent triggering parent's events

        if (!timelineRef.current) return;

        const timelineRect = timelineRef.current.getBoundingClientRect();
        const timelineWidth = timelineRect.width;

        // Find the segment that's being resized
        const segment = clipSegments.find((seg) => seg.id === segmentId);
        if (!segment) return;

        const originalStartTime = segment.startTime;
        const originalEndTime = segment.endTime;

        // Store the original segment state to compare after dragging
        const segmentBeforeDrag = { ...segment };

        // Add a visual indicator that we're in resize mode (for mouse devices)
        document.body.style.cursor = 'ew-resize';

        // Add a temporary overlay to help with dragging outside the element
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '1000';
        overlay.style.cursor = 'ew-resize';
        document.body.appendChild(overlay);

        // Track dragging state and final positions
        let isDragging = true;
        let finalStartTime = originalStartTime;
        let finalEndTime = originalEndTime;

        // Dispatch an event to signal drag start
        document.dispatchEvent(
            new CustomEvent('segment-drag-start', {
                detail: { segmentId },
            })
        );

        // Keep the tooltip visible during drag
        // Function to handle both mouse and touch movements
        const handleDragMove = (clientX: number) => {
            if (!isDragging || !timelineRef.current) return;

            const updatedTimelineRect = timelineRef.current.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (clientX - updatedTimelineRect.left) / updatedTimelineRect.width));
            const newTime = position * duration;

            // Create a temporary segment with the current drag position to check against
            const draggedSegment = {
                id: segmentId,
                startTime: isLeft ? newTime : originalStartTime,
                endTime: isLeft ? originalEndTime : newTime,
                name: '',
                thumbnail: '',
            };

            // Check if the current marker position intersects with where the segment will be
            const currentSegmentStart = isLeft ? newTime : originalStartTime;
            const currentSegmentEnd = isLeft ? originalEndTime : newTime;
            const isMarkerInSegment = currentTime >= currentSegmentStart && currentTime <= currentSegmentEnd;

            // Update tooltip based on marker intersection
            if (isMarkerInSegment) {
                // Show segment tooltip if marker is inside the segment
                setSelectedSegmentId(segmentId);
                setShowEmptySpaceTooltip(false);
            } else {
                // Show cutaway tooltip if marker is outside the segment
                setSelectedSegmentId(null);
                // Calculate available space for cutaway tooltip
                const availableSpace = calculateAvailableSpace(currentTime);
                setAvailableSegmentDuration(availableSpace);
                setShowEmptySpaceTooltip(true);
            }

            // Find neighboring segments (exclude the current one)
            const otherSegments = clipSegments.filter((seg) => seg.id !== segmentId);

            // Calculate new start/end times based on drag direction
            let newStartTime = originalStartTime;
            let newEndTime = originalEndTime;

            if (isLeft) {
                // Dragging left handle - adjust start time
                newStartTime = Math.min(newTime, originalEndTime - 0.5);

                // Find the closest left neighbor
                const leftNeighbors = otherSegments
                    .filter((seg) => seg.endTime <= originalStartTime)
                    .sort((a, b) => b.endTime - a.endTime);

                const leftNeighbor = leftNeighbors[0];

                // Prevent overlapping with left neighbor
                if (leftNeighbor && newStartTime < leftNeighbor.endTime) {
                    newStartTime = leftNeighbor.endTime;
                }

                // Snap to the nearest segment with a small threshold
                const snapThreshold = 0.3; // seconds

                if (leftNeighbor && Math.abs(newStartTime - leftNeighbor.endTime) < snapThreshold) {
                    newStartTime = leftNeighbor.endTime;
                }

                // Update final value for history recording
                finalStartTime = newStartTime;
            } else {
                // Dragging right handle - adjust end time
                newEndTime = Math.max(newTime, originalStartTime + 0.5);

                // Find the closest right neighbor
                const rightNeighbors = otherSegments
                    .filter((seg) => seg.startTime >= originalEndTime)
                    .sort((a, b) => a.startTime - b.startTime);

                const rightNeighbor = rightNeighbors[0];

                // Prevent overlapping with right neighbor
                if (rightNeighbor && newEndTime > rightNeighbor.startTime) {
                    newEndTime = rightNeighbor.startTime;
                }

                // Snap to the nearest segment with a small threshold
                const snapThreshold = 0.3; // seconds

                if (rightNeighbor && Math.abs(newEndTime - rightNeighbor.startTime) < snapThreshold) {
                    newEndTime = rightNeighbor.startTime;
                }

                // Update final value for history recording
                finalEndTime = newEndTime;
            }

            // Create a new segments array with the updated segment
            const updatedSegments = clipSegments.map((seg) => {
                if (seg.id === segmentId) {
                    return {
                        ...seg,
                        startTime: newStartTime,
                        endTime: newEndTime,
                    };
                }
                return seg;
            });

            // Create a custom event to update the segments WITHOUT recording in history during drag
            const updateEvent = new CustomEvent('update-segments', {
                detail: {
                    segments: updatedSegments,
                    recordHistory: false, // Don't record intermediate states
                },
            });
            document.dispatchEvent(updateEvent);

            // During dragging, check if the current tooltip needs to be updated based on segment position
            if (selectedSegmentId === segmentId && videoRef.current) {
                const currentTime = videoRef.current.currentTime;
                const segment = updatedSegments.find((seg) => seg.id === segmentId);

                if (segment) {
                    // Check if playhead position is now outside the segment after dragging
                    const isInsideSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;

                    // Log the current position information for debugging
                    logger.debug(
                        `During drag - playhead at ${formatDetailedTime(currentTime)} is ${
                            isInsideSegment ? 'inside' : 'outside'
                        } segment (${formatDetailedTime(segment.startTime)} - ${formatDetailedTime(segment.endTime)})`
                    );

                    if (!isInsideSegment && isPlayingSegment) {
                        logger.debug('Playhead position is outside segment after dragging - updating tooltip');
                        // Stop playback if we were playing and dragged the segment away from playhead
                        videoRef.current.pause();
                        setIsPlayingSegment(false);
                        setActiveSegment(null);
                    }

                    // Update display time to stay in bounds of the segment
                    if (currentTime < segment.startTime) {
                        logger.debug(
                            `Adjusting display time to segment start: ${formatDetailedTime(segment.startTime)}`
                        );
                        setDisplayTime(segment.startTime);

                        // Update UI state to reflect that playback will be from segment start
                        setClickedTime(segment.startTime);
                    } else if (currentTime > segment.endTime) {
                        logger.debug(`Adjusting display time to segment end: ${formatDetailedTime(segment.endTime)}`);
                        setDisplayTime(segment.endTime);

                        // Update UI state to reflect that playback will be from segment end
                        setClickedTime(segment.endTime);
                    }
                }
            }
        };

        // Function to handle the end of dragging (for both mouse and touch)
        const handleDragEnd = () => {
            if (!isDragging) return;

            isDragging = false;

            // Clean up event listeners for both mouse and touch
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);

            // Reset styles
            document.body.style.cursor = '';
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }

            // Record the final position in history as a single action
            const finalSegments = clipSegments.map((seg) => {
                if (seg.id === segmentId) {
                    return {
                        ...seg,
                        startTime: finalStartTime,
                        endTime: finalEndTime,
                    };
                }
                return seg;
            });

            // Now we can create a history record for the complete drag operation
            const actionType = isLeft ? 'adjust_segment_start' : 'adjust_segment_end';
            document.dispatchEvent(
                new CustomEvent('update-segments', {
                    detail: {
                        segments: finalSegments,
                        recordHistory: true,
                        action: actionType,
                    },
                })
            );

            // After drag is complete, do a final check to see if playhead is inside the segment
            if (selectedSegmentId === segmentId && videoRef.current) {
                const currentTime = videoRef.current.currentTime;
                const segment = finalSegments.find((seg) => seg.id === segmentId);

                if (segment) {
                    const isInsideSegment = currentTime >= segment.startTime && currentTime <= segment.endTime;

                    logger.debug(
                        `Drag complete - playhead at ${formatDetailedTime(currentTime)} is ${
                            isInsideSegment ? 'inside' : 'outside'
                        } segment (${formatDetailedTime(segment.startTime)} - ${formatDetailedTime(segment.endTime)})`
                    );

                    // Check if playhead status changed during drag
                    const wasInsideSegmentBefore =
                        currentTime >= segmentBeforeDrag.startTime && currentTime <= segmentBeforeDrag.endTime;

                    logger.debug(
                        `Playhead was ${
                            wasInsideSegmentBefore ? 'inside' : 'outside'
                        } segment before drag, now ${isInsideSegment ? 'inside' : 'outside'}`
                    );

                    // Update UI elements based on segment position
                    if (!isInsideSegment) {
                        // If we were playing and the playhead is now outside the segment, stop playback
                        if (isPlayingSegment) {
                            videoRef.current.pause();
                            setIsPlayingSegment(false);
                            setActiveSegment(null);
                            setContinuePastBoundary(false);
                            logger.debug('Stopped playback because playhead is outside segment after drag completion');
                        }

                        // Update display time to be within the segment's bounds
                        if (currentTime < segment.startTime) {
                            logger.debug(
                                `Final adjustment - setting display time to segment start: ${formatDetailedTime(
                                    segment.startTime
                                )}`
                            );
                            setDisplayTime(segment.startTime);
                            setClickedTime(segment.startTime);
                        } else if (currentTime > segment.endTime) {
                            logger.debug(
                                `Final adjustment - setting display time to segment end: ${formatDetailedTime(
                                    segment.endTime
                                )}`
                            );
                            setDisplayTime(segment.endTime);
                            setClickedTime(segment.endTime);
                        }
                    }
                    // Special case: playhead was outside segment before, but now it's inside - can start playback
                    else if (!wasInsideSegmentBefore && isInsideSegment) {
                        logger.debug('Playhead moved INTO segment during drag - can start playback');
                        setActiveSegment(segment);
                    }
                    // Another special case: playhead was inside segment before, but now is also inside but at a different position
                    else if (
                        wasInsideSegmentBefore &&
                        isInsideSegment &&
                        (segment.startTime !== segmentBeforeDrag.startTime ||
                            segment.endTime !== segmentBeforeDrag.endTime)
                    ) {
                        logger.debug(
                            'Segment boundaries changed while playhead remained inside - updating activeSegment'
                        );
                        // Update the active segment reference to ensure boundary detection works with new bounds
                        setActiveSegment(segment);
                    }
                }
            }
        };

        // Mouse-specific event handlers
        const handleMouseMove = (moveEvent: MouseEvent) => {
            handleDragMove(moveEvent.clientX);
        };

        const handleMouseUp = () => {
            handleDragEnd();
        };

        // Touch-specific event handlers
        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (moveEvent.touches.length > 0) {
                moveEvent.preventDefault(); // Prevent scrolling while dragging
                handleDragMove(moveEvent.touches[0].clientX);
            }
        };

        const handleTouchEnd = () => {
            handleDragEnd();
        };

        // Register event listeners for both mouse and touch
        document.addEventListener('mousemove', handleMouseMove, {
            passive: false,
        });
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchcancel', handleTouchEnd);
    };

    // Handle segment click to show the tooltip
    const handleSegmentClick = (segmentId: number) => (e: React.MouseEvent) => {
        // Remove the check that prevents interaction during preview mode
        // This allows users to click segments while previewing

        // Don't show tooltip if clicked on handle
        if ((e.target as HTMLElement).classList.contains('clip-segment-handle')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        logger.debug('Segment clicked:', segmentId);

        // Reset continuation flag when selecting a segment - ensures proper boundary detection
        setContinuePastBoundary(false);

        // Check if video is currently playing before clicking
        const wasPlaying = videoRef.current && !videoRef.current.paused;
        logger.debug('seekVideo: Was playing before:', wasPlaying);

        // Set the current segment as selected
        setSelectedSegmentId(segmentId);

        // Find the segment in our data
        const segment = clipSegments.find((seg) => seg.id === segmentId);
        if (!segment) return;

        // Find the segment element in the DOM
        const segmentElement = e.currentTarget as HTMLElement;
        const segmentRect = segmentElement.getBoundingClientRect();

        // Calculate relative click position within the segment (0 to 1)
        const relativeX = (e.clientX - segmentRect.left) / segmentRect.width;

        // Convert to time based on segment's start and end times
        const clickTime = segment.startTime + relativeX * (segment.endTime - segment.startTime);

        // Ensure time is within segment bounds
        const boundedTime = Math.max(segment.startTime, Math.min(segment.endTime, clickTime));

        // Set both clicked time and display time for UI
        setClickedTime(boundedTime);
        setDisplayTime(boundedTime);

        // Check if the video's current time is inside or outside the segment
        // This helps with updating the tooltip correctly after dragging operations
        if (videoRef.current) {
            const currentVideoTime = videoRef.current.currentTime;
            const isPlayheadInsideSegment =
                currentVideoTime >= segment.startTime && currentVideoTime <= segment.endTime;

            logger.debug(
                `Segment click - playhead at ${formatDetailedTime(currentVideoTime)} is ${
                    isPlayheadInsideSegment ? 'inside' : 'outside'
                } segment (${formatDetailedTime(segment.startTime)} - ${formatDetailedTime(segment.endTime)})`
            );

            // If playhead is outside the segment, update the display time to segment boundary
            if (!isPlayheadInsideSegment) {
                // Adjust the display time based on which end is closer to the playhead
                if (Math.abs(currentVideoTime - segment.startTime) < Math.abs(currentVideoTime - segment.endTime)) {
                    // Playhead is closer to segment start
                    logger.debug(
                        `Playhead outside segment - adjusting to segment start: ${formatDetailedTime(
                            segment.startTime
                        )}`
                    );
                    setDisplayTime(segment.startTime);
                    // Don't update clickedTime here since we already set it to the clicked position
                } else {
                    // Playhead is closer to segment end
                    logger.debug(
                        `Playhead outside segment - adjusting to segment end: ${formatDetailedTime(segment.endTime)}`
                    );
                    setDisplayTime(segment.endTime);
                    // Don't update clickedTime here since we already set it to the clicked position
                }
            }
        }

        // Seek to this position (this will update the video's current time)
        onSeek(boundedTime);

        // Handle playback continuation based on the current mode
        if (videoRef.current) {
            // Special handling for segments playback mode
            if (isPlayingSegments && wasPlaying) {
                // Update the current segment index for segments playback mode
                const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
                const targetSegmentIndex = orderedSegments.findIndex((seg) => seg.id === segmentId);

                if (targetSegmentIndex !== -1) {
                    // Dispatch a custom event to update the current segment index
                    const updateSegmentIndexEvent = new CustomEvent('update-segment-index', {
                        detail: { segmentIndex: targetSegmentIndex },
                    });
                    document.dispatchEvent(updateSegmentIndexEvent);
                    logger.debug(
                        `Segments playback mode: updating segment index to ${targetSegmentIndex} for segment ${segmentId}`
                    );
                }

                // In segments playback mode, we want to continue the segments playback from the new position
                // The segments playback will naturally handle continuing to the next segments
                logger.debug('Segments playback mode: continuing playback from new position');
                videoRef.current
                    .play()
                    .then(() => {
                        setIsPlayingSegment(true);
                        logger.debug('Continued segments playback after segment click');
                    })
                    .catch((err) => {
                        console.error('Error continuing segments playback after segment click:', err);
                    });
            }
            // If video was playing before, ensure it continues playing (but not in segments mode)
            else if (wasPlaying && !isPlayingSegments) {
                // Set current segment as active segment for boundary checking
                setActiveSegment(segment);
                // Reset the continuePastBoundary flag when clicking on a segment to ensure boundaries work
                setContinuePastBoundary(false);
                // Continue playing from the new position
                videoRef.current
                    .play()
                    .then(() => {
                        setIsPlayingSegment(true);
                        logger.debug('Continued preview playback after segment click');
                    })
                    .catch((err) => {
                        console.error('Error resuming playback after segment click:', err);
                    });
            }
        }

        // Calculate tooltip position directly above click point
        const tooltipX = e.clientX;
        const tooltipY = segmentRect.top - 10;

        setTooltipPosition({
            x: tooltipX,
            y: tooltipY,
        });

        // Auto-scroll to center the clicked position for zoomed timeline
        if (zoomLevel > 1 && timelineRef.current && scrollContainerRef.current) {
            const timelineRect = timelineRef.current.getBoundingClientRect();
            const timelineWidth = timelineRef.current.clientWidth;
            const containerWidth = scrollContainerRef.current.clientWidth;

            // Calculate pixel position of clicked time
            const clickedPosPixel = (boundedTime / duration) * timelineWidth;

            // Center the view on the clicked position
            const targetScrollLeft = Math.max(0, clickedPosPixel - containerWidth / 2);

            // Smooth scroll to the clicked point
            scrollContainerRef.current.scrollTo({
                left: targetScrollLeft,
                behavior: 'smooth',
            });

            // Update tooltip position after scrolling completes
            setTimeout(() => {
                if (timelineRef.current && scrollContainerRef.current) {
                    // Calculate new position based on viewport
                    const updatedRect = timelineRef.current.getBoundingClientRect();
                    const timePercent = boundedTime / duration;
                    const newPosition =
                        timePercent * timelineWidth - scrollContainerRef.current.scrollLeft + updatedRect.left;

                    setTooltipPosition({
                        x: newPosition,
                        y: tooltipY,
                    });
                }
            }, 300); // Wait for smooth scrolling to complete
        }

        // We no longer need a local click handler as we have a global one
        // that handles closing tooltips when clicking outside
    };

    // Show tooltip for the segment
    const setShowTooltip = (show: boolean, segmentId: number, x: number, y: number) => {
        setSelectedSegmentId(show ? segmentId : null);
        setTooltipPosition({ x, y });
    };

    // Render the clip segments on the timeline
    const renderClipSegments = () => {
        return clipSegments.map((segment, index) => {
            const startPercent = (segment.startTime / duration) * 100;
            const widthPercent = ((segment.endTime - segment.startTime) / duration) * 100;

            // Generate a solid background color based on segment position
            const backgroundColor = generateSolidColor((segment.startTime + segment.endTime) / 2, duration);

            return (
                <div
                    key={segment.id}
                    className={`clip-segment ${selectedSegmentId === segment.id ? 'selected' : ''}`}
                    style={{
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: backgroundColor,
                        borderWidth: '2px', // Make borders more visible
                        borderStyle: 'solid',
                        borderColor: 'rgba(0, 0, 0, 0.5)', // Darker border for better visibility
                    }}
                    onClick={handleSegmentClick(segment.id)}
                >
                    <div className="clip-segment-info">
                        <div className="clip-segment-name">Segment {index + 1}</div>
                        <div className="clip-segment-time">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </div>
                        <div className="clip-segment-duration">
                            Duration: {formatTime(segment.endTime - segment.startTime)}
                        </div>
                    </div>

                    {/* Resize handles with both mouse and touch support */}
                    {isPlayingSegments ? null : (
                        <>
                            <div
                                className="clip-segment-handle left"
                                title="Resize segment start"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleSegmentResize(segment.id, true)(e);
                                }}
                                onTouchStart={(e) => {
                                    e.stopPropagation();
                                    handleSegmentResize(segment.id, true)(e);
                                }}
                            ></div>
                            <div
                                className="clip-segment-handle right"
                                title="Resize segment end"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleSegmentResize(segment.id, false)(e);
                                }}
                                onTouchStart={(e) => {
                                    e.stopPropagation();
                                    handleSegmentResize(segment.id, false)(e);
                                }}
                            ></div>
                        </>
                    )}
                </div>
            );
        });
    };

    // Add a new useEffect hook to listen for segment deletion events
    useEffect(() => {
        const handleSegmentDelete = (event: CustomEvent) => {
            const { segmentId } = event.detail;

            // Check if this was the last segment before deletion
            const remainingSegments = clipSegments.filter((seg) => seg.id !== segmentId);
            if (remainingSegments.length === 0) {
                // Create a full video segment
                const fullVideoSegment: Segment = {
                    id: Date.now(),
                    name: 'Full Video',
                    startTime: 0,
                    endTime: duration,
                    thumbnail: '',
                };

                // Create and dispatch the update event to replace all segments with the full video segment
                const updateEvent = new CustomEvent('update-segments', {
                    detail: {
                        segments: [fullVideoSegment],
                        recordHistory: true,
                        action: 'create_full_video_segment',
                    },
                });
                document.dispatchEvent(updateEvent);

                // Update UI to show the segment tooltip
                setSelectedSegmentId(fullVideoSegment.id);
                setShowEmptySpaceTooltip(false);
                setClickedTime(currentTime);
                setDisplayTime(currentTime);
                setActiveSegment(fullVideoSegment);

                // Calculate tooltip position at current time
                if (timelineRef.current) {
                    const rect = timelineRef.current.getBoundingClientRect();
                    const posPercent = (currentTime / duration) * 100;
                    const xPosition = rect.left + rect.width * (posPercent / 100);

                    setTooltipPosition({
                        x: xPosition,
                        y: rect.top - 10,
                    });

                    logger.debug('Created full video segment:', {
                        id: fullVideoSegment.id,
                        duration: formatDetailedTime(duration),
                        currentPosition: formatDetailedTime(currentTime),
                    });
                }
            } else if (selectedSegmentId === segmentId) {
                // Handle normal segment deletion
                const deletedSegment = clipSegments.find((seg) => seg.id === segmentId);
                if (!deletedSegment) return;

                // Calculate available space after deletion
                const availableSpace = calculateAvailableSpace(currentTime);

                // Update UI to show cutaway tooltip
                setSelectedSegmentId(null);
                setShowEmptySpaceTooltip(true);
                setAvailableSegmentDuration(availableSpace);

                // Calculate tooltip position
                if (timelineRef.current) {
                    const rect = timelineRef.current.getBoundingClientRect();
                    const posPercent = (currentTime / duration) * 100;
                    const xPosition = rect.left + rect.width * (posPercent / 100);

                    setTooltipPosition({
                        x: xPosition,
                        y: rect.top - 10,
                    });

                    logger.debug('Segment deleted, showing cutaway tooltip:', {
                        position: formatDetailedTime(currentTime),
                        availableSpace: formatDetailedTime(availableSpace),
                    });
                }
            }
        };

        // Add event listener for the custom delete-segment event
        document.addEventListener('delete-segment', handleSegmentDelete as EventListener);

        // Clean up event listener on component unmount
        return () => {
            document.removeEventListener('delete-segment', handleSegmentDelete as EventListener);
        };
    }, [selectedSegmentId, clipSegments, currentTime, duration, timelineRef]);

    // Add an effect to synchronize tooltip play state with video play state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => {
            if (!videoRef.current) return;

            const video = videoRef.current;
            const currentPosition = video.currentTime;

            // Reset continuePastBoundary flag when starting new playback
            setContinuePastBoundary(false);

            // Find the next stopping point based on current position
            let stopTime = duration;
            let currentSegment = null;
            let nextSegment = null;

            // First, check if we're inside a segment with high precision
            currentSegment = clipSegments.find((seg) => {
                const isWithinSegment = currentPosition >= seg.startTime && currentPosition <= seg.endTime;
                const isAtExactStart = Math.abs(currentPosition - seg.startTime) < 0.001; // Within 1ms of start
                const isAtExactEnd = Math.abs(currentPosition - seg.endTime) < 0.001; // Within 1ms of end
                return isWithinSegment || isAtExactStart || isAtExactEnd;
            });

            // Find the next segment with high precision
            nextSegment = clipSegments
                .filter((seg) => {
                    const isAfterCurrent = seg.startTime > currentPosition;
                    const isNotAtExactPosition = Math.abs(seg.startTime - currentPosition) > 0.001;
                    return isAfterCurrent && isNotAtExactPosition;
                })
                .sort((a, b) => a.startTime - b.startTime)[0];

            // Determine where to stop based on position
            if (currentSegment) {
                // If we're in a segment, stop at its end
                stopTime = currentSegment.endTime;
                setActiveSegment(currentSegment);
            } else if (nextSegment) {
                // If we're in a cutaway and there's a next segment, stop at its start
                stopTime = nextSegment.startTime;
                // Don't set active segment since we're in a cutaway
            }

            // Create a boundary checker function with high precision
            const checkBoundary = () => {
                if (!video) return;

                const currentPosition = video.currentTime;
                const timeLeft = stopTime - currentPosition;

                // If we're approaching the boundary (within 1ms) or have passed it
                if (timeLeft <= 0.001 || currentPosition >= stopTime) {
                    // First pause playback
                    video.pause();

                    // Force exact position with multiple verification attempts
                    const setExactPosition = () => {
                        if (!video) return;

                        // Set to exact boundary time
                        video.currentTime = stopTime;
                        onSeek(stopTime);
                        setDisplayTime(stopTime);
                        setClickedTime(stopTime);

                        logger.debug('Position verification:', {
                            target: formatDetailedTime(stopTime),
                            actual: formatDetailedTime(video.currentTime),
                            difference: Math.abs(video.currentTime - stopTime).toFixed(3),
                        });
                    };

                    // Multiple attempts to ensure precision
                    setExactPosition();
                    setTimeout(setExactPosition, 10);
                    setTimeout(setExactPosition, 20);
                    setTimeout(setExactPosition, 50);

                    // Update UI based on where we stopped
                    if (currentSegment) {
                        setSelectedSegmentId(currentSegment.id);
                        setShowEmptySpaceTooltip(false);
                    } else if (nextSegment) {
                        setSelectedSegmentId(nextSegment.id);
                        setShowEmptySpaceTooltip(false);
                        setActiveSegment(nextSegment);
                    } else {
                        setSelectedSegmentId(null);
                        setShowEmptySpaceTooltip(true);
                        setActiveSegment(null);
                    }

                    // Remove our boundary checker
                    video.removeEventListener('timeupdate', checkBoundary);
                    setIsPlaying(false);
                    setIsPlayingSegment(false);
                    // Reset continuePastBoundary flag when stopping at boundary
                    setContinuePastBoundary(false);
                    return;
                }
            };

            // Start our boundary checker
            video.addEventListener('timeupdate', checkBoundary);

            // Start playing
            video
                .play()
                .then(() => {
                    setIsPlaying(true);
                    setIsPlayingSegment(true);
                    logger.debug('Playback started:', {
                        from: formatDetailedTime(currentPosition),
                        to: formatDetailedTime(stopTime),
                        currentSegment: currentSegment ? `Segment ${currentSegment.id}` : 'None',
                        nextSegment: nextSegment ? `Segment ${nextSegment.id}` : 'None',
                    });
                })
                .catch((err) => {
                    console.error('Error playing video:', err);
                });
        };

        const handlePause = () => {
            logger.debug('Video paused from external control');
            setIsPlayingSegment(false);
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
        };
    }, [clipSegments, duration, onSeek]);

    // Handle mouse movement over timeline to remember position
    const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const position = (e.clientX - rect.left) / rect.width;
        const time = position * duration;

        // Ensure time is within bounds
        const boundedTime = Math.max(0, Math.min(duration, time));

        // Store position globally for iOS Safari
        if (typeof window !== 'undefined') {
            window.lastSeekedPosition = boundedTime;
        }
    };

    // Add the dragging state and handlers to the component

    // Inside the TimelineControls component, add these new state variables
    const [isDragging, setIsDragging] = useState(false);
    // Add a dragging ref to track state without relying on React's state updates
    const isDraggingRef = useRef(false);

    // Add drag handlers to enable dragging the timeline marker
    const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
        // If on mobile device and video hasn't been initialized, don't allow dragging
        if (isIOSUninitialized) {
            return;
        }

        e.stopPropagation(); // Don't trigger the timeline click
        e.preventDefault(); // Prevent text selection during drag

        setIsDragging(true);
        isDraggingRef.current = true; // Use ref for immediate value access

        // Show tooltip immediately when starting to drag
        updateTooltipForPosition(currentTime);

        // Handle mouse events
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!timelineRef.current || !scrollContainerRef.current) return;

            // Calculate the position based on mouse or touch coordinates
            const rect = timelineRef.current.getBoundingClientRect();
            let position;

            if (zoomLevel > 1) {
                // When zoomed, account for scroll position
                const scrollLeft = scrollContainerRef.current.scrollLeft;
                const totalWidth = timelineRef.current.clientWidth;
                position = (moveEvent.clientX - rect.left + scrollLeft) / totalWidth;
            } else {
                // Normal calculation for 1x zoom
                position = (moveEvent.clientX - rect.left) / rect.width;
            }

            // Constrain position between 0 and 1
            position = Math.max(0, Math.min(1, position));

            // Convert to time and seek
            const newTime = position * duration;

            // Update both clicked time and display time
            setClickedTime(newTime);
            setDisplayTime(newTime);

            // Update tooltip state based on new position
            updateTooltipForPosition(newTime);

            // Store position globally for iOS Safari
            if (typeof window !== 'undefined') {
                (window as any).lastSeekedPosition = newTime;
            }

            // Seek to the new position
            onSeek(newTime);
        };

        // Handle mouse up to stop dragging
        const handleMouseUp = () => {
            setIsDragging(false);
            isDraggingRef.current = false; // Update ref immediately
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        // Add event listeners to track movement and release
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle touch events for mobile devices
    const startTouchDrag = (e: React.TouchEvent) => {
        // If on mobile device and video hasn't been initialized, don't allow dragging
        if (isIOSUninitialized) {
            return;
        }

        e.stopPropagation(); // Don't trigger the timeline click
        e.preventDefault(); // Prevent text selection during drag

        setIsDragging(true);
        isDraggingRef.current = true; // Use ref for immediate value access

        // Show tooltip immediately when starting to drag
        updateTooltipForPosition(currentTime);

        // Handle touch move events
        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (!timelineRef.current || !scrollContainerRef.current || !moveEvent.touches[0]) return;

            // Calculate the position based on touch coordinates
            const rect = timelineRef.current.getBoundingClientRect();
            let position;

            if (zoomLevel > 1) {
                // When zoomed, account for scroll position
                const scrollLeft = scrollContainerRef.current.scrollLeft;
                const totalWidth = timelineRef.current.clientWidth;
                position = (moveEvent.touches[0].clientX - rect.left + scrollLeft) / totalWidth;
            } else {
                // Normal calculation for 1x zoom
                position = (moveEvent.touches[0].clientX - rect.left) / rect.width;
            }

            // Constrain position between 0 and 1
            position = Math.max(0, Math.min(1, position));

            // Convert to time and seek
            const newTime = position * duration;

            // Update both clicked time and display time
            setClickedTime(newTime);
            setDisplayTime(newTime);

            // Update tooltip state based on new position
            updateTooltipForPosition(newTime);

            // Store position globally for mobile browsers
            if (typeof window !== 'undefined') {
                (window as any).lastSeekedPosition = newTime;
            }

            // Seek to the new position
            onSeek(newTime);
        };

        // Handle touch end to stop dragging
        const handleTouchEnd = () => {
            setIsDragging(false);
            isDraggingRef.current = false; // Update ref immediately
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);
        };

        // Add event listeners to track movement and release
        document.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchcancel', handleTouchEnd);
    };

    // Add a useEffect to log the redirect URL whenever it changes
    useEffect(() => {
        if (redirectUrl) {
            logger.debug('Redirect URL updated:', {
                redirectUrl,
                saveType,
                isSuccessModalOpen: showSuccessModal,
            });
        }
    }, [redirectUrl, saveType, showSuccessModal]);

    // Add a useEffect for auto-redirection
    useEffect(() => {
        let countdownInterval: NodeJS.Timeout;
        let redirectTimeout: NodeJS.Timeout;

        if (showSuccessModal && redirectUrl) {
            // Start countdown timer
            let secondsLeft = 10;

            // Update the countdown every second
            countdownInterval = setInterval(() => {
                secondsLeft--;
                const countdownElement = document.querySelector('.countdown');
                if (countdownElement) {
                    countdownElement.textContent = secondsLeft.toString();
                }

                if (secondsLeft <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);

            // Set redirect timeout
            redirectTimeout = setTimeout(() => {
                // Reset unsaved changes flag before navigating away
                if (onSave) onSave();

                // Redirect to the URL
                logger.debug('Automatically redirecting to:', redirectUrl);
                window.location.href = redirectUrl;
            }, 10000); // 10 seconds
        }

        // Cleanup on unmount or when success modal closes
        return () => {
            if (countdownInterval) clearInterval(countdownInterval);
            if (redirectTimeout) clearTimeout(redirectTimeout);
        };
    }, [showSuccessModal, redirectUrl, onSave]);

    return (
        <div className={`timeline-container-card ${isPlayingSegments ? 'segments-playback-mode' : ''}`}>
            {/* Current Timecode with Milliseconds */}
            <div className="timeline-header">
                <div className="timeline-title">
                    <span className="timeline-title-text">Timeline</span>
                </div>
                <div className="duration-time">
                    Total Segments:{' '}
                    <span>
                        {formatDetailedTime(
                            clipSegments.reduce((sum, segment) => sum + (segment.endTime - segment.startTime), 0)
                        )}
                    </span>
                </div>
            </div>

            {/* Timeline Container with Scrollable Wrapper */}
            <div
                ref={scrollContainerRef}
                className={`timeline-scroll-container ${isPlayingSegments ? 'segments-playback-mode' : ''}`}
                style={{
                    overflow: zoomLevel > 1 ? 'auto' : 'hidden',
                }}
            >
                <div
                    ref={timelineRef}
                    className="timeline-container"
                    onClick={handleTimelineClick}
                    onMouseMove={handleTimelineMouseMove}
                    style={{
                        width: `${zoomLevel * 100}%`,
                        cursor: 'pointer',
                    }}
                >
                    {/* Current Position Marker */}
                    <div className="timeline-marker" style={{ left: `${currentTimePercent}%` }}>
                        {/* Top circle for popup toggle */}
                        <div
                            className="timeline-marker-head"
                            onClick={(e) => {
                                // Prevent event propagation to avoid triggering the timeline container click
                                e.stopPropagation();

                                // For ensuring accurate segment detection, refresh clipSegments first
                                // This helps when clicking right after creating a new segment
                                const refreshedSegmentAtCurrentTime = clipSegments.find(
                                    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
                                );

                                // Toggle tooltip visibility with a single click
                                if (selectedSegmentId || showEmptySpaceTooltip) {
                                    // When tooltip is open and - icon is clicked, simply close the tooltips
                                    logger.debug('Closing tooltip');
                                    setSelectedSegmentId(null);
                                    setShowEmptySpaceTooltip(false);
                                    // Don't reopen the tooltip - just leave it closed
                                    return;
                                } else {
                                    // Use our improved tooltip position logic
                                    updateTooltipForPosition(currentTime);
                                    logger.debug('Opening tooltip at:', formatDetailedTime(currentTime));
                                }
                            }}
                        >
                            <span className="timeline-marker-head-icon">
                                {selectedSegmentId || showEmptySpaceTooltip ? '-' : '+'}
                            </span>
                        </div>

                        {/* Bottom circle for dragging */}
                        {isPlayingSegments ? null : (
                            <div
                                className={`timeline-marker-drag ${isDragging ? 'dragging' : ''}`}
                                onMouseDown={startDrag}
                                onTouchStart={startTouchDrag}
                            >
                                <span className="timeline-marker-drag-icon">⋮</span>
                            </div>
                        )}
                    </div>

                    {/* Trim Line Markers - hidden when segments exist */}
                    {clipSegments.length === 0 && (
                        <>
                            <div className="trim-line-marker" style={{ left: `${trimStartPercent}%` }}>
                                <div ref={leftHandleRef} className="trim-handle left"></div>
                            </div>
                            <div className="trim-line-marker" style={{ left: `${trimEndPercent}%` }}>
                                <div ref={rightHandleRef} className="trim-handle right"></div>
                            </div>
                        </>
                    )}

                    {/* Clip Segments */}
                    {renderClipSegments()}

                    {/* Split Points */}
                    {renderSplitPoints()}

                    {/* Thumbnails */}
                    {renderThumbnails()}

                    {/* Segment Tooltip */}
                    {selectedSegmentId !== null && (
                        <div
                            className={`segment-tooltip two-row-tooltip ${
                                isPlayingSegments ? 'segments-playback-mode' : ''
                            }`}
                            style={{
                                position: 'absolute',
                                ...constrainTooltipPosition(currentTimePercent),
                            }}
                            onClick={(e) => {
                                if (isPlayingSegments) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                }
                            }}
                        >
                            {/* First row with time adjustment buttons */}
                            <div className="tooltip-row">
                                <button
                                    className={`tooltip-time-btn ${isPlayingSegments ? 'disabled' : ''}`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Seek -50ms (click or hold)'
                                    }
                                    disabled={isPlayingSegments}
                                    {...(!isPlayingSegments ? handleContinuousTimeAdjustment(-0.05) : {})}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                >
                                    -50ms
                                </button>
                                <div
                                    className={`tooltip-time-display ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        pointerEvents: isPlayingSegments ? 'none' : 'auto',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'default',
                                        opacity: isPlayingSegments ? 0.6 : 1,
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                    }}
                                    onClick={(e) => {
                                        if (isPlayingSegments) {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    {formatDetailedTime(displayTime)}
                                </div>
                                <button
                                    className={`tooltip-time-btn ${isPlayingSegments ? 'disabled' : ''}`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Seek +50ms (click or hold)'
                                    }
                                    disabled={isPlayingSegments}
                                    {...(!isPlayingSegments ? handleContinuousTimeAdjustment(0.05) : {})}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                >
                                    +50ms
                                </button>
                            </div>

                            {/* Second row with action buttons */}
                            <div className="tooltip-row tooltip-actions">
                                <button
                                    className={`tooltip-action-btn delete ${isPlayingSegments ? 'disabled' : ''}`}
                                    data-tooltip={isPlayingSegments ? 'Disabled during preview' : 'Delete segment'}
                                    disabled={isPlayingSegments}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Call the delete segment function with the current segment ID
                                        const deleteEvent = new CustomEvent('delete-segment', {
                                            detail: {
                                                segmentId: selectedSegmentId,
                                            },
                                        });
                                        document.dispatchEvent(deleteEvent);
                                        // We don't need to manually close the tooltip - our event handler will take care of updating the UI
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                                <button
                                    className={`tooltip-action-btn scissors ${isPlayingSegments ? 'disabled' : ''}`}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : 'Split segment at current position'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Call the split segment function with the current segment ID and time
                                        const splitEvent = new CustomEvent('split-segment', {
                                            detail: {
                                                segmentId: selectedSegmentId,
                                                time: clickedTime,
                                            },
                                        });
                                        document.dispatchEvent(splitEvent);
                                        // Keep the tooltip open
                                        // setSelectedSegmentId(null);
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="6" cy="6" r="3" />
                                        <circle cx="6" cy="18" r="3" />
                                        <line x1="20" y1="4" x2="8.12" y2="15.88" />
                                        <line x1="14.47" y1="14.48" x2="20" y2="20" />
                                        <line x1="8.12" y1="8.12" x2="12" y2="12" />
                                    </svg>
                                </button>
                                <button
                                    className={`tooltip-action-btn play-from-start ${
                                        isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Play segment from beginning'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        // Find the selected segment
                                        const segment = clipSegments.find((seg) => seg.id === selectedSegmentId);
                                        if (segment && videoRef.current) {
                                            // Enable continuePastBoundary flag when user explicitly clicks play
                                            // This will allow playback to continue even if we're at segment boundary
                                            setContinuePastBoundary(true);
                                            logger.debug(
                                                'Setting continuePastBoundary=true to allow playback through boundaries'
                                            );

                                            // Special handling for when we're at the end of the segment already
                                            // Check if we're at or extremely close to the end boundary
                                            if (Math.abs(videoRef.current.currentTime - segment.endTime) < 0.05) {
                                                logger.debug(
                                                    `Already at end boundary (${formatDetailedTime(
                                                        videoRef.current.currentTime
                                                    )}), nudging position back slightly`
                                                );
                                                const newPosition = Math.max(segment.startTime, segment.endTime - 0.1); // Move 100ms back from end
                                                videoRef.current.currentTime = newPosition;
                                                onSeek(newPosition);
                                                setClickedTime(newPosition);
                                                logger.debug(`Position adjusted to ${formatDetailedTime(newPosition)}`);
                                            } else {
                                                // Normal case - just seek to the start of the segment
                                                onSeek(segment.startTime);
                                                setClickedTime(segment.startTime);
                                            }

                                            // Set active segment for boundary checking before playing
                                            setActiveSegment(segment);

                                            // Start playing from the beginning of the segment with proper promise handling
                                            videoRef.current
                                                .play()
                                                .then(() => {
                                                    setIsPlayingSegment(true);
                                                    logger.debug('Playing from beginning of segment');
                                                })
                                                .catch((err) => {
                                                    console.error('Error playing from beginning:', err);
                                                });
                                        }

                                        // Don't close the tooltip
                                    }}
                                >
                                    <img
                                        src={playFromBeginningIcon}
                                        alt="Play from beginning"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>
                                {/*         <button
                  className={`tooltip-action-btn ${isPlaying ? 'pause' : 'play'}`}
                  data-tooltip={isPlaying ? "Pause playback" : "Play from current position"}
                  onClick={(e) => {
                    e.stopPropagation();

                    // Find the current segment
                    const currentSegment = clipSegments.find(seg =>
                      currentTime >= seg.startTime && currentTime <= seg.endTime
                    );

                    if (isPlaying) {
                      // If playing, just pause
                      if (videoRef.current) {
                        videoRef.current.pause();
                        setIsPlayingSegment(false);
                        setContinuePastBoundary(false);
                      }
                    } else {
                      // If starting playback, set the active segment
                      if (currentSegment) {
                        setActiveSegment(currentSegment);
                      }

                      // Reset continuation flag when starting new playback
                      setContinuePastBoundary(false);

                      if (videoRef.current) {
                        videoRef.current.play()
                          .then(() => {
                            setIsPlayingSegment(true);
                          })
                          .catch(err => {
                            console.error("Error playing video:", err);
                            setIsPlayingSegment(false);
                          });
                      }
                    }
                  }}
                >
                  {isPlaying ? (
                    <img src={pauseIcon} alt="Pause" style={{width: '24px', height: '24px'}} />
                  ) : (
                    <img src={playIcon} alt="Play" style={{width: '24px', height: '24px'}} />
                  )}
                </button> */}

                                {/* Play/Pause button for empty space - Same as main play/pause button */}
                                <button
                                    className={`tooltip-action-btn ${isPlaying ? 'pause' : 'play'} ${
                                        isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : isPlaying
                                              ? 'Pause playback'
                                              : 'Play from current position'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        if (isPlaying) {
                                            // If playing, just pause
                                            if (videoRef.current) {
                                                videoRef.current.pause();
                                                setIsPlayingSegment(false);
                                                setContinuePastBoundary(false);
                                            }
                                        } else {
                                            onPlayPause();
                                        }
                                    }}
                                >
                                    {isPlaying ? (
                                        <img
                                            src={pauseIcon}
                                            alt="Pause"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={playIcon}
                                            alt="Play"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                            }}
                                        />
                                    )}
                                </button>

                                <button
                                    className={`tooltip-action-btn set-in ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : 'Set start point at current position'
                                    }
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        // Find the selected segment and update its start time
                                        const segment = clipSegments.find((seg) => seg.id === selectedSegmentId);
                                        if (segment) {
                                            // Create updated segments with new start time for selected segment
                                            const updatedSegments = clipSegments.map((seg) => {
                                                if (seg.id === selectedSegmentId) {
                                                    return {
                                                        ...seg,
                                                        startTime:
                                                            clickedTime < seg.endTime - 0.5
                                                                ? clickedTime
                                                                : seg.endTime - 0.5,
                                                    };
                                                }
                                                return seg;
                                            });

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: updatedSegments,
                                                    recordHistory: true, // Ensure this specific action is recorded in history
                                                    action: 'adjust_start_time',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug('Set in clicked');
                                        }

                                        // Keep tooltip open
                                        // setSelectedSegmentId(null);
                                    }}
                                >
                                    <img
                                        src={segmentStartIcon}
                                        alt="Set start point"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>
                                <button
                                    className={`tooltip-action-btn set-out ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : 'Set end point at current position'
                                    }
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        // Find the selected segment and update its end time
                                        const segment = clipSegments.find((seg) => seg.id === selectedSegmentId);
                                        if (segment) {
                                            // Create updated segments with new end time for selected segment
                                            const updatedSegments = clipSegments.map((seg) => {
                                                if (seg.id === selectedSegmentId) {
                                                    return {
                                                        ...seg,
                                                        endTime:
                                                            clickedTime > seg.startTime + 0.5
                                                                ? clickedTime
                                                                : seg.startTime + 0.5,
                                                    };
                                                }
                                                return seg;
                                            });

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: updatedSegments,
                                                    recordHistory: true, // Ensure this specific action is recorded in history
                                                    action: 'adjust_end_time',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug('Set out clicked');
                                        }

                                        // Keep the tooltip open
                                        // setSelectedSegmentId(null);
                                    }}
                                >
                                    <img
                                        src={segmentEndIcon}
                                        alt="Set end point"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty space tooltip - positioned absolutely within timeline container */}
                    {showEmptySpaceTooltip && selectedSegmentId === null && (
                        <div
                            className={`empty-space-tooltip two-row-tooltip ${
                                isPlayingSegments ? 'segments-playback-mode' : ''
                            }`}
                            style={{
                                position: 'absolute',
                                ...constrainTooltipPosition(currentTimePercent),
                            }}
                            onClick={(e) => {
                                if (isPlayingSegments) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                }
                            }}
                        >
                            {/* First row with time adjustment buttons - same as segment tooltip */}
                            <div className="tooltip-row">
                                <button
                                    className={`tooltip-time-btn ${isPlayingSegments ? 'disabled' : ''}`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Seek -50ms (click or hold)'
                                    }
                                    disabled={isPlayingSegments}
                                    {...(!isPlayingSegments ? handleContinuousTimeAdjustment(-0.05) : {})}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                >
                                    -50ms
                                </button>
                                <div
                                    className={`tooltip-time-display ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        pointerEvents: isPlayingSegments ? 'none' : 'auto',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'default',
                                        opacity: isPlayingSegments ? 0.6 : 1,
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                    }}
                                    onClick={(e) => {
                                        if (isPlayingSegments) {
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    {formatDetailedTime(clickedTime)}
                                </div>
                                <button
                                    className={`tooltip-time-btn ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Seek +50ms (click or hold)'
                                    }
                                    disabled={isPlayingSegments}
                                    {...(!isPlayingSegments ? handleContinuousTimeAdjustment(0.05) : {})}
                                >
                                    +50ms
                                </button>
                            </div>

                            {/* Second row with action buttons similar to segment tooltip */}
                            <div className="tooltip-row tooltip-actions">
                                {/* New segment button - Moved to first position */}
                                <button
                                    className={`tooltip-action-btn new-segment ${
                                        availableSegmentDuration < 0.5 || isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : availableSegmentDuration < 0.5
                                              ? 'Not enough space for new segment'
                                              : 'Create new segment'
                                    }
                                    disabled={availableSegmentDuration < 0.5 || isPlayingSegments}
                                    onClick={async (e) => {
                                        e.stopPropagation();

                                        // Only create if we have at least 0.5 seconds of space
                                        if (availableSegmentDuration < 0.5) {
                                            // Not enough space, do nothing
                                            return;
                                        }

                                        // Create a new segment with the calculated available duration
                                        const segmentStartTime = clickedTime;
                                        const segmentEndTime = segmentStartTime + availableSegmentDuration;

                                        // Create the new segment with a generic name
                                        const newSegment: Segment = {
                                            id: Date.now(),
                                            name: `segment`,
                                            startTime: segmentStartTime,
                                            endTime: segmentEndTime,
                                            thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                        };

                                        // Add the new segment to existing segments
                                        const updatedSegments = [...clipSegments, newSegment];

                                        // Create and dispatch the update event
                                        const updateEvent = new CustomEvent('update-segments', {
                                            detail: {
                                                segments: updatedSegments,
                                                recordHistory: true, // Explicitly record this action in history
                                                action: 'create_segment',
                                            },
                                        });
                                        logger.debug('Dispatching update-segments event for new segment creation');
                                        document.dispatchEvent(updateEvent);

                                        // Close empty space tooltip
                                        setShowEmptySpaceTooltip(false);

                                        // After creating the segment, wait a short time for the state to update
                                        setTimeout(() => {
                                            // The newly created segment is the last one in the array with the ID we just assigned
                                            const createdSegment = updatedSegments[updatedSegments.length - 1];

                                            if (createdSegment) {
                                                // Set this segment as selected to show its tooltip
                                                setSelectedSegmentId(createdSegment.id);
                                                logger.debug('Created and selected new segment:', createdSegment.id);
                                            }
                                        }, 100); // Small delay to ensure state is updated
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="12" y1="8" x2="12" y2="16"></line>
                                        <line x1="8" y1="12" x2="16" y2="12"></line>
                                    </svg>
                                    <span className="tooltip-btn-text">New</span>
                                </button>

                                {/* Go to start button - play from beginning of cutaway (until next segment) */}
                                <button
                                    className={`tooltip-action-btn play-from-start ${
                                        isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Play from beginning of cutaway'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        if (videoRef.current) {
                                            // Find cutaway boundaries (current position is somewhere in the cutaway)
                                            const currentTime = clickedTime;

                                            // Enable continuePastBoundary flag when user explicitly clicks play
                                            // This will allow playback to continue even if we're at segment boundary
                                            setContinuePastBoundary(true);
                                            logger.debug(
                                                'Setting continuePastBoundary=true to allow playback through boundaries'
                                            );

                                            // For start, find the previous segment's end or use video start (0)
                                            const sortedSegments = [...clipSegments].sort(
                                                (a, b) => a.startTime - b.startTime
                                            );

                                            // Find the previous segment (one that ends before the current time)
                                            const previousSegment = [...sortedSegments]
                                                .reverse()
                                                .find((seg) => seg.endTime < currentTime);

                                            // Start from either previous segment end or beginning of video
                                            // Add a small offset (0.025 second = 25ms) to ensure we're definitely past the segment boundary
                                            const startTime = previousSegment ? previousSegment.endTime + 0.025 : 0;

                                            // For end, find the next segment after the current position
                                            // Since we're looking for the boundary of this empty space, we need to find the
                                            // segment that starts after our current position
                                            const nextSegment = sortedSegments.find(
                                                (seg) => seg.startTime > currentTime
                                            );

                                            // Define end boundary (either next segment start or video end)
                                            const endTime = nextSegment ? nextSegment.startTime : duration;

                                            // Create a virtual "segment" for the cutaway area
                                            const cutawaySegment: Segment = {
                                                id: -999, // Use a unique negative ID to indicate a virtual segment
                                                name: 'Cutaway',
                                                startTime: startTime,
                                                endTime: endTime,
                                                thumbnail: '',
                                            };

                                            // Seek to the start of the cutaway (true beginning of this cutaway area)
                                            onSeek(startTime);
                                            setClickedTime(startTime);

                                            // IMPORTANT: First reset isPlayingSegment to false to ensure clean state
                                            setIsPlayingSegment(false);

                                            // Then set active segment for boundary checking
                                            // We use setTimeout to ensure this happens in the next tick
                                            // after the isPlayingSegment value is updated
                                            setTimeout(() => {
                                                setActiveSegment(cutawaySegment);
                                            }, 0);

                                            // Add a manual boundary check specifically for cutaway playback
                                            // This ensures we detect when we reach the next segment's start
                                            const checkCutawayBoundary = () => {
                                                if (!videoRef.current) return;

                                                // Check if we've entered a segment (i.e., reached a boundary)
                                                const currentPosition = videoRef.current.currentTime;
                                                const segments = [...clipSegments].sort(
                                                    (a, b) => a.startTime - b.startTime
                                                );

                                                // Find the next segment we're approaching - use a wider detection range
                                                // to catch the boundary earlier
                                                const nextSegment = segments.find(
                                                    (seg) => seg.startTime > currentPosition - 0.3
                                                );

                                                // We need to detect boundaries much earlier to allow for time to react
                                                // This is a key fix - we need to detect the boundary BEFORE we reach it
                                                // But don't stop if we're in continuePastBoundary mode
                                                const shouldStop =
                                                    nextSegment &&
                                                    currentPosition >= nextSegment.startTime - 0.25 &&
                                                    currentPosition <= nextSegment.startTime + 0.1 &&
                                                    !continuePastBoundary;

                                                // Add logging to show boundary check decisions
                                                if (
                                                    nextSegment &&
                                                    currentPosition >= nextSegment.startTime - 0.25 &&
                                                    currentPosition <= nextSegment.startTime + 0.1
                                                ) {
                                                    logger.debug(
                                                        `Approaching boundary at ${formatDetailedTime(
                                                            nextSegment.startTime
                                                        )}, continuePastBoundary=${continuePastBoundary}, willStop=${shouldStop}`
                                                    );
                                                }

                                                // Also check if we've entered a different segment - we need to detect this too
                                                const segmentAtCurrentTime = segments.find(
                                                    (seg) =>
                                                        currentPosition >= seg.startTime &&
                                                        currentPosition <= seg.endTime
                                                );

                                                // If we've moved directly into a segment during playback, we need to update the active segment
                                                if (
                                                    segmentAtCurrentTime &&
                                                    activeSegment?.id !== segmentAtCurrentTime.id
                                                ) {
                                                    logger.debug(
                                                        `Entered segment ${segmentAtCurrentTime.id} during cutaway playback`
                                                    );
                                                    setActiveSegment(segmentAtCurrentTime);
                                                    setSelectedSegmentId(segmentAtCurrentTime.id);
                                                    setShowEmptySpaceTooltip(false);

                                                    // Remove our boundary checker since we're now in a standard segment
                                                    videoRef.current.removeEventListener(
                                                        'timeupdate',
                                                        checkCutawayBoundary
                                                    );

                                                    // Reset continuation flags
                                                    setContinuePastBoundary(false);
                                                    sessionStorage.removeItem('continuingPastSegment');
                                                    return;
                                                }

                                                // If we've entered a segment, stop at its boundary
                                                if (shouldStop && nextSegment) {
                                                    logger.debug(
                                                        `CUTAWAY MANUAL BOUNDARY CHECK: Current position ${formatDetailedTime(
                                                            currentPosition
                                                        )} approaching segment at ${formatDetailedTime(
                                                            nextSegment.startTime
                                                        )} (distance: ${Math.abs(
                                                            currentPosition - nextSegment.startTime
                                                        ).toFixed(3)}s) - STOPPING`
                                                    );

                                                    videoRef.current.pause();
                                                    // Force exact time position with high precision and multiple attempts
                                                    setTimeout(() => {
                                                        if (videoRef.current) {
                                                            // First seek directly to exact start time, no offset
                                                            videoRef.current.currentTime = nextSegment.startTime;
                                                            // Update UI immediately to match video position
                                                            onSeek(nextSegment.startTime);
                                                            // Also update tooltip time displays
                                                            setDisplayTime(nextSegment.startTime);
                                                            setClickedTime(nextSegment.startTime);

                                                            // Reset continuePastBoundary when stopping at a boundary
                                                            setContinuePastBoundary(false);

                                                            // Update tooltip to show the segment at the boundary
                                                            setSelectedSegmentId(nextSegment.id);
                                                            setShowEmptySpaceTooltip(false);
                                                            setActiveSegment(nextSegment);

                                                            // Force multiple adjustments to ensure exact precision
                                                            const verifyPosition = () => {
                                                                if (videoRef.current) {
                                                                    // Always force the exact time in every verification
                                                                    videoRef.current.currentTime =
                                                                        nextSegment.startTime;

                                                                    // Make sure we update the UI to reflect the corrected position
                                                                    onSeek(nextSegment.startTime);

                                                                    // Update the displayTime and clickedTime state to match exact position
                                                                    setDisplayTime(nextSegment.startTime);
                                                                    setClickedTime(nextSegment.startTime);

                                                                    logger.debug(
                                                                        `Position corrected to exact segment boundary: ${formatDetailedTime(
                                                                            videoRef.current.currentTime
                                                                        )} (target: ${formatDetailedTime(nextSegment.startTime)})`
                                                                    );
                                                                }
                                                            };

                                                            // Apply multiple correction attempts with increasing delays
                                                            setTimeout(verifyPosition, 10); // Immediate correction
                                                            setTimeout(verifyPosition, 20); // First correction
                                                            setTimeout(verifyPosition, 50); // Second correction
                                                            setTimeout(verifyPosition, 100); // Third correction
                                                            setTimeout(verifyPosition, 200); // Final correction

                                                            // Also add event listeners to ensure position is corrected whenever video state changes
                                                            videoRef.current.addEventListener('seeked', verifyPosition);
                                                            videoRef.current.addEventListener(
                                                                'canplay',
                                                                verifyPosition
                                                            );
                                                            videoRef.current.addEventListener(
                                                                'waiting',
                                                                verifyPosition
                                                            );

                                                            // Remove these event listeners after a short time
                                                            setTimeout(() => {
                                                                if (videoRef.current) {
                                                                    videoRef.current.removeEventListener(
                                                                        'seeked',
                                                                        verifyPosition
                                                                    );
                                                                    videoRef.current.removeEventListener(
                                                                        'canplay',
                                                                        verifyPosition
                                                                    );
                                                                    videoRef.current.removeEventListener(
                                                                        'waiting',
                                                                        verifyPosition
                                                                    );
                                                                }
                                                            }, 300);
                                                        }
                                                    }, 10);
                                                    setIsPlayingSegment(false);
                                                    setActiveSegment(null);

                                                    // Remove our boundary checker
                                                    videoRef.current.removeEventListener(
                                                        'timeupdate',
                                                        checkCutawayBoundary
                                                    );
                                                    return;
                                                }
                                            };

                                            // Start our manual boundary checker
                                            videoRef.current.addEventListener('timeupdate', checkCutawayBoundary);

                                            // Start playing with proper promise handling - use setTimeout to ensure
                                            // that our activeSegment setting has had time to take effect
                                            setTimeout(() => {
                                                if (videoRef.current) {
                                                    // Now start playback
                                                    videoRef.current
                                                        .play()
                                                        .then(() => {
                                                            setIsPlayingSegment(true);
                                                            logger.debug(
                                                                'CUTAWAY PLAYBACK STARTED:',
                                                                formatDetailedTime(startTime),
                                                                'to',
                                                                formatDetailedTime(endTime),
                                                                previousSegment
                                                                    ? `(after segment ${
                                                                          previousSegment.id
                                                                      }, offset +25ms from ${formatDetailedTime(
                                                                          previousSegment.endTime
                                                                      )})`
                                                                    : '(from video start)',
                                                                nextSegment
                                                                    ? `(will stop at segment ${nextSegment.id})`
                                                                    : '(will play to end)'
                                                            );
                                                        })
                                                        .catch((err) => {
                                                            console.error('Error playing cutaway:', err);
                                                        });
                                                }
                                            }, 50);
                                        }
                                    }}
                                >
                                    <img
                                        src={playFromBeginningIcon}
                                        alt="Play from beginning"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>

                                {/* Play/Pause button for empty space */}
                                {/* <button
                  className={`tooltip-action-btn ${isPlaying ? 'pause' : 'play'}`}
                  data-tooltip={isPlaying ? "Pause playback" : "Play from here until next segment"}
                  onClick={(e) => {
                    e.stopPropagation();

                    if (videoRef.current) {
                      if (isPlaying) {
                        // If already playing, pause the video
                        videoRef.current.pause();
                        setIsPlayingSegment(false);
                        // Reset continuePastBoundary when stopping playback
                        setContinuePastBoundary(false);
                        logger.debug("Pause clicked in empty space - resetting continuePastBoundary flag");
                      } else {
                        // Enable continuePastBoundary flag when user explicitly clicks play
                        // This will allow playback to continue even if we're at segment boundary
                        setContinuePastBoundary(true);
                        logger.debug("Setting continuePastBoundary=true to allow playback through boundaries");

                        // Find the current time and determine cutaway boundaries
                        // For end, find the next segment after current position
                        // Make sure we look for any segment that starts after our current position,
                        // including the first segment if we're before it
                        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
                        const currentTime = videoRef.current.currentTime;
                        const nextSegment = sortedSegments.find(seg => seg.startTime > currentTime);

                        // Check if we're at a segment boundary that we previously stopped at
                        const isAtSegmentBoundary = nextSegment && Math.abs(currentTime - nextSegment.startTime) < 0.05;

                        if (isAtSegmentBoundary && nextSegment) {
                          // We're at the start of a segment - just continue into the segment rather than staying in cutaway
                          logger.debug(`At segment boundary: Moving into segment ${nextSegment.id}`);

                          // Update UI to show segment tooltip instead of empty space tooltip
                          setSelectedSegmentId(nextSegment.id);
                          setShowEmptySpaceTooltip(false);

                          // Set this segment as the active segment for boundary checking
                          setActiveSegment(nextSegment);

                          // Play from this segment directly
                          videoRef.current.play()
                            .then(() => {
                              setIsPlayingSegment(true);
                              logger.debug("Playing from segment start after boundary");
                            })
                            .catch(err => {
                              console.error("Error starting playback:", err);
                            });

                          return;  // Exit early as we've handled this special case
                        }

                        // Define end boundary (either next segment start or video end)
                        const endTime = nextSegment ? nextSegment.startTime : duration;

                        // Special handling for when we're already at a segment boundary
                        // If we're at or extremely close to the segment boundary already,
                        // we need to nudge the position slightly back to allow playback
                        let adjustedCurrentTime = currentTime;

                        if (nextSegment && Math.abs(currentTime - nextSegment.startTime) < 0.05) {
                          logger.debug(`Already at boundary (${formatDetailedTime(currentTime)}), nudging position back slightly`);
                          adjustedCurrentTime = Math.max(0, currentTime - 0.1); // Move 100ms back
                          videoRef.current.currentTime = adjustedCurrentTime;
                          onSeek(adjustedCurrentTime);
                          logger.debug(`Position adjusted to ${formatDetailedTime(adjustedCurrentTime)}`);
                        }

                        // Create a virtual "segment" for the cutaway area
                        const cutawaySegment: Segment = {
                          id: -999, // Use a consistent negative ID for virtual segments
                          name: "Cutaway",
                          startTime: adjustedCurrentTime, // Use the potentially adjusted time
                          endTime: endTime,
                          thumbnail: ""
                        };

                        // IMPORTANT: First reset isPlayingSegment to false to ensure clean state
                        setIsPlayingSegment(false);

                        // Then set active segment for boundary checking
                        // We use setTimeout to ensure this happens in the next tick
                        // after the isPlayingSegment value is updated
                        setTimeout(() => {
                          setActiveSegment(cutawaySegment);
                        }, 0);

                        // Add a manual boundary check specifically for cutaway playback
                        // This ensures we detect when we reach the next segment's start
                        const checkCutawayBoundary = () => {
                          if (!videoRef.current) return;

                          // Check if we've entered a segment (i.e., reached a boundary)
                          const currentPosition = videoRef.current.currentTime;
                          const segments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

                          // Find the next segment we're approaching - use a wider detection range
                          // to catch the boundary earlier
                          const nextSegment = segments.find(seg => seg.startTime > currentPosition - 0.3);

                          // Also check if we've entered a different segment - we need to detect this too
                          const segmentAtCurrentTime = segments.find(
                            seg => currentPosition >= seg.startTime && currentPosition <= seg.endTime
                          );

                          // If we've moved directly into a segment during playback, we need to update the active segment
                          if (segmentAtCurrentTime && activeSegment?.id !== segmentAtCurrentTime.id) {
                            logger.debug(`Entered segment ${segmentAtCurrentTime.id} during cutaway playback`);
                            setActiveSegment(segmentAtCurrentTime);
                            setSelectedSegmentId(segmentAtCurrentTime.id);
                            setShowEmptySpaceTooltip(false);

                            // Remove our boundary checker since we're now in a standard segment
                            videoRef.current.removeEventListener('timeupdate', checkCutawayBoundary);

                            // Reset continuation flags
                            setContinuePastBoundary(false);
                            sessionStorage.removeItem('continuingPastSegment');
                            return;
                          }

                          // We need to detect boundaries much earlier to allow for time to react
                          // This is a key fix - we need to detect the boundary BEFORE we reach it
                          // But don't stop if we're in continuePastBoundary mode
                          const shouldStop = nextSegment &&
                            (currentPosition >= nextSegment.startTime - 0.25) &&
                            (currentPosition <= nextSegment.startTime + 0.1) &&
                            !continuePastBoundary;

                          // Add logging to show boundary check decisions
                          if (nextSegment && (currentPosition >= nextSegment.startTime - 0.25) &&
                              (currentPosition <= nextSegment.startTime + 0.1)) {
                            logger.debug(`Approaching boundary at ${formatDetailedTime(nextSegment.startTime)}, continuePastBoundary=${continuePastBoundary}, willStop=${shouldStop}`);
                          }

                          // If we've entered a segment, stop at its boundary
                          if (shouldStop && nextSegment) {
                            logger.debug(`CUTAWAY MANUAL BOUNDARY CHECK: Current position ${formatDetailedTime(currentPosition)} approaching segment at ${formatDetailedTime(nextSegment.startTime)} (distance: ${Math.abs(currentPosition - nextSegment.startTime).toFixed(3)}s) - STOPPING`);

                            videoRef.current.pause();
                            // Force exact time position with high precision
                            setTimeout(() => {
                              if (videoRef.current) {
                                // First seek directly to exact start time, no offset
                                videoRef.current.currentTime = nextSegment.startTime;
                                // Update UI immediately to match video position
                                onSeek(nextSegment.startTime);
                                // Also update tooltip time displays
                                setDisplayTime(nextSegment.startTime);
                                setClickedTime(nextSegment.startTime);

                                // Reset continuePastBoundary when stopping at a boundary
                                setContinuePastBoundary(false);

                                // Update tooltip to show the segment at the boundary
                                setSelectedSegmentId(nextSegment.id);
                                setShowEmptySpaceTooltip(false);
                                setActiveSegment(nextSegment);

                                // Force multiple adjustments to ensure exact precision
                                const verifyPosition = () => {
                                  if (videoRef.current) {
                                    // Always force the exact time in every verification
                                    videoRef.current.currentTime = nextSegment.startTime;

                                    // Make sure we update the UI to reflect the corrected position
                                    onSeek(nextSegment.startTime);

                                    // Update the displayTime and clickedTime state to match exact position
                                    setDisplayTime(nextSegment.startTime);
                                    setClickedTime(nextSegment.startTime);

                                    logger.debug(`Position corrected to exact segment boundary: ${formatDetailedTime(videoRef.current.currentTime)} (target: ${formatDetailedTime(nextSegment.startTime)})`);
                                  }
                                };

                                // Apply multiple correction attempts with increasing delays
                                setTimeout(verifyPosition, 10);  // Immediate correction
                                setTimeout(verifyPosition, 20);  // First correction
                                setTimeout(verifyPosition, 50);  // Second correction
                                setTimeout(verifyPosition, 100);  // Third correction
                                setTimeout(verifyPosition, 200);  // Final correction

                                // Also add event listeners to ensure position is corrected whenever video state changes
                                videoRef.current.addEventListener('seeked', verifyPosition);
                                videoRef.current.addEventListener('canplay', verifyPosition);
                                videoRef.current.addEventListener('waiting', verifyPosition);

                                // Remove these event listeners after a short time
                                setTimeout(() => {
                                  if (videoRef.current) {
                                    videoRef.current.removeEventListener('seeked', verifyPosition);
                                    videoRef.current.removeEventListener('canplay', verifyPosition);
                                    videoRef.current.removeEventListener('waiting', verifyPosition);
                                  }
                                }, 300);
                              }
                            }, 10);
                            setIsPlayingSegment(false);
                            setActiveSegment(null);

                            // Remove our boundary checker
                            videoRef.current.removeEventListener('timeupdate', checkCutawayBoundary);
                            return;
                          }
                        };

                        // Start our manual boundary checker
                        videoRef.current.addEventListener('timeupdate', checkCutawayBoundary);

                        // Start playing from current position with boundary restrictions
                        // Use a timeout to ensure active segment is set before playback starts
                        setTimeout(() => {
                          if (videoRef.current) {
                            videoRef.current.play()
                              .then(() => {
                                setIsPlayingSegment(true);
                                logger.debug("Play clicked in empty space - position:",
                                  formatDetailedTime(currentTime),
                                  "will stop at:", formatDetailedTime(endTime),
                                  nextSegment ? `(start of segment ${nextSegment.id})` : "(end of video)"
                                );
                              })
                              .catch(err => {
                                console.error("Error starting playback:", err);
                              });
                          }
                        }, 50);
                      }
                    }
                  }}
                >
                  {isPlaying ? (
                    <img src={pauseIcon} alt="Pause" style={{width: '24px', height: '24px'}} />
                  ) : (
                    <img src={playIcon} alt="Play" style={{width: '24px', height: '24px'}} />
                  )}
                </button> */}

                                {/* Play/Pause button for empty space - Same as main play/pause button */}
                                <button
                                    className={`tooltip-action-btn ${isPlaying ? 'pause' : 'play'} ${
                                        isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    data-tooltip={
                                        isPlayingSegments
                                            ? 'Disabled during preview'
                                            : isPlaying
                                              ? 'Pause playback'
                                              : 'Play from here until next segment'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        if (isPlaying) {
                                            // If playing, just pause
                                            if (videoRef.current) {
                                                videoRef.current.pause();
                                                setIsPlayingSegment(false);
                                                setContinuePastBoundary(false);
                                            }
                                        } else {
                                            onPlayPause();
                                        }
                                    }}
                                >
                                    {isPlaying ? (
                                        <img
                                            src={pauseIcon}
                                            alt="Pause"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={playIcon}
                                            alt="Play"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                            }}
                                        />
                                    )}
                                </button>

                                {/* Segment end adjustment button (always shown) */}
                                <button
                                    className={`tooltip-action-btn segment-end ${isPlayingSegments ? 'disabled' : ''}`}
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Adjust end of previous segment'
                                    }
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        // Find the previous segment (one that ends before the current time)
                                        const sortedSegments = [...clipSegments].sort(
                                            (a, b) => a.startTime - b.startTime
                                        );
                                        const prevSegment = sortedSegments
                                            .filter((seg) => seg.endTime <= clickedTime)
                                            .sort((a, b) => b.endTime - a.endTime)[0]; // Get the closest one before

                                        if (prevSegment) {
                                            // Regular case: adjust end of previous segment
                                            const updatedSegments = clipSegments.map((seg) => {
                                                if (seg.id === prevSegment.id) {
                                                    return {
                                                        ...seg,
                                                        endTime: clickedTime,
                                                    };
                                                }
                                                return seg;
                                            });

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: updatedSegments,
                                                    recordHistory: true,
                                                    action: 'adjust_previous_end_time',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug(
                                                'Adjusted end of previous segment to:',
                                                formatDetailedTime(clickedTime)
                                            );

                                            // Show the previous segment's tooltip
                                            setSelectedSegmentId(prevSegment.id);
                                            setShowEmptySpaceTooltip(false);
                                        } else if (clipSegments.length > 0) {
                                            // No previous segment at cursor position, but segments exist elsewhere

                                            // First, check if we're in a gap between segments - if so, create a new segment for the gap
                                            const sortedByStart = [...clipSegments].sort(
                                                (a, b) => a.startTime - b.startTime
                                            );
                                            let inGap = false;
                                            let gapStart = 0;

                                            // Check if we're in a gap between segments
                                            for (let i = 0; i < sortedByStart.length - 1; i++) {
                                                const currentSegEnd = sortedByStart[i].endTime;
                                                const nextSegStart = sortedByStart[i + 1].startTime;

                                                if (clickedTime > currentSegEnd && clickedTime < nextSegStart) {
                                                    inGap = true;
                                                    gapStart = currentSegEnd;
                                                    break;
                                                }
                                            }

                                            if (inGap) {
                                                // We're in a gap, create a new segment from gap start to clicked time
                                                const newSegment: Segment = {
                                                    id: Date.now(),
                                                    name: 'segment',
                                                    startTime: gapStart,
                                                    endTime: clickedTime,
                                                    thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                                };

                                                // Add the new segment to existing segments
                                                const updatedSegments = [...clipSegments, newSegment];

                                                // Create and dispatch the update event
                                                const updateEvent = new CustomEvent('update-segments', {
                                                    detail: {
                                                        segments: updatedSegments,
                                                        recordHistory: true,
                                                        action: 'create_segment_in_gap',
                                                    },
                                                });
                                                document.dispatchEvent(updateEvent);
                                                logger.debug(
                                                    'Created new segment in gap from',
                                                    formatDetailedTime(gapStart),
                                                    'to',
                                                    formatDetailedTime(clickedTime)
                                                );

                                                // Show the new segment's tooltip
                                                setSelectedSegmentId(newSegment.id);
                                                setShowEmptySpaceTooltip(false);
                                            }
                                            // Check if we're before all segments and should create a segment from start
                                            else if (clickedTime < sortedByStart[0].startTime) {
                                                // Create a new segment from start of video to clicked time
                                                const newSegment: Segment = {
                                                    id: Date.now(),
                                                    name: 'segment',
                                                    startTime: 0,
                                                    endTime: clickedTime,
                                                    thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                                };

                                                // Add the new segment to existing segments
                                                const updatedSegments = [...clipSegments, newSegment];

                                                // Create and dispatch the update event
                                                const updateEvent = new CustomEvent('update-segments', {
                                                    detail: {
                                                        segments: updatedSegments,
                                                        recordHistory: true,
                                                        action: 'create_segment_from_start',
                                                    },
                                                });
                                                document.dispatchEvent(updateEvent);
                                                logger.debug(
                                                    'Created new segment from start to:',
                                                    formatDetailedTime(clickedTime)
                                                );

                                                // Show the new segment's tooltip
                                                setSelectedSegmentId(newSegment.id);
                                                setShowEmptySpaceTooltip(false);
                                            } else {
                                                // Not in a gap, check if we can extend the last segment to end of video
                                                const lastSegment = [...clipSegments].sort(
                                                    (a, b) => b.endTime - a.endTime
                                                )[0];

                                                if (lastSegment && lastSegment.endTime < duration) {
                                                    // Extend the last segment to end of video
                                                    const updatedSegments = clipSegments.map((seg) => {
                                                        if (seg.id === lastSegment.id) {
                                                            return {
                                                                ...seg,
                                                                endTime: duration,
                                                            };
                                                        }
                                                        return seg;
                                                    });

                                                    // Create and dispatch the update event
                                                    const updateEvent = new CustomEvent('update-segments', {
                                                        detail: {
                                                            segments: updatedSegments,
                                                            recordHistory: true,
                                                            action: 'extend_last_segment',
                                                        },
                                                    });
                                                    document.dispatchEvent(updateEvent);
                                                    logger.debug('Extended last segment to end of video');

                                                    // Show the last segment's tooltip
                                                    setSelectedSegmentId(lastSegment.id);
                                                    setShowEmptySpaceTooltip(false);
                                                }
                                            }
                                        } else if (clickedTime > 0) {
                                            // No segments exist; create a new segment from start to clicked time
                                            const newSegment: Segment = {
                                                id: Date.now(),
                                                name: 'segment',
                                                startTime: 0,
                                                endTime: clickedTime,
                                                thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                            };

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: [newSegment],
                                                    recordHistory: true,
                                                    action: 'create_segment_from_start',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug(
                                                'Created new segment from start to:',
                                                formatDetailedTime(clickedTime)
                                            );

                                            // Show the new segment's tooltip
                                            setSelectedSegmentId(newSegment.id);
                                            setShowEmptySpaceTooltip(false);
                                        }
                                    }}
                                >
                                    <img
                                        src={segmentNewEndIcon}
                                        alt="Set end point"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>

                                {/* Segment start adjustment button (always shown) */}
                                <button
                                    className={`tooltip-action-btn segment-start ${
                                        isPlayingSegments ? 'disabled' : ''
                                    }`}
                                    data-tooltip={
                                        isPlayingSegments ? 'Disabled during preview' : 'Adjust start of next segment'
                                    }
                                    style={{
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        touchAction: 'manipulation',
                                        cursor: isPlayingSegments ? 'not-allowed' : 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                    disabled={isPlayingSegments}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        // Find the next segment (one that starts after the current time)
                                        const sortedSegments = [...clipSegments].sort(
                                            (a, b) => a.startTime - b.startTime
                                        );
                                        const nextSegment = sortedSegments
                                            .filter((seg) => seg.startTime >= clickedTime)
                                            .sort((a, b) => a.startTime - b.startTime)[0]; // Get the closest one after

                                        if (nextSegment) {
                                            // Regular case: adjust start of next segment
                                            const updatedSegments = clipSegments.map((seg) => {
                                                if (seg.id === nextSegment.id) {
                                                    return {
                                                        ...seg,
                                                        startTime: clickedTime,
                                                    };
                                                }
                                                return seg;
                                            });

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: updatedSegments,
                                                    recordHistory: true,
                                                    action: 'adjust_next_start_time',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug(
                                                'Adjusted start of next segment to:',
                                                formatDetailedTime(clickedTime)
                                            );

                                            // Show the next segment's tooltip
                                            setSelectedSegmentId(nextSegment.id);
                                            setShowEmptySpaceTooltip(false);
                                        } else if (clipSegments.length > 0) {
                                            // No next segment at cursor position, but segments exist elsewhere

                                            // First, check if we're in a gap between segments - if so, create a new segment for the gap
                                            const sortedByStart = [...clipSegments].sort(
                                                (a, b) => a.startTime - b.startTime
                                            );
                                            let inGap = false;
                                            let gapEnd = 0;

                                            // Check if we're in a gap between segments
                                            for (let i = 0; i < sortedByStart.length - 1; i++) {
                                                const currentSegEnd = sortedByStart[i].endTime;
                                                const nextSegStart = sortedByStart[i + 1].startTime;

                                                if (clickedTime > currentSegEnd && clickedTime < nextSegStart) {
                                                    inGap = true;
                                                    gapEnd = nextSegStart;
                                                    break;
                                                }
                                            }

                                            if (inGap) {
                                                // We're in a gap, create a new segment from clicked time to gap end
                                                const newSegment: Segment = {
                                                    id: Date.now(),
                                                    name: 'segment',
                                                    startTime: clickedTime,
                                                    endTime: gapEnd,
                                                    thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                                };

                                                // Add the new segment to existing segments
                                                const updatedSegments = [...clipSegments, newSegment];

                                                // Create and dispatch the update event
                                                const updateEvent = new CustomEvent('update-segments', {
                                                    detail: {
                                                        segments: updatedSegments,
                                                        recordHistory: true,
                                                        action: 'create_segment_in_gap',
                                                    },
                                                });
                                                document.dispatchEvent(updateEvent);
                                                logger.debug(
                                                    'Created new segment in gap from',
                                                    formatDetailedTime(clickedTime),
                                                    'to',
                                                    formatDetailedTime(gapEnd)
                                                );

                                                // Show the new segment's tooltip
                                                setSelectedSegmentId(newSegment.id);
                                                setShowEmptySpaceTooltip(false);
                                            } else {
                                                // Check if we're at the start of the video with segments ahead
                                                if (clickedTime < sortedByStart[0].startTime) {
                                                    // Create a new segment from clicked time to first segment start
                                                    const newSegment: Segment = {
                                                        id: Date.now(),
                                                        name: 'segment',
                                                        startTime: clickedTime,
                                                        endTime: sortedByStart[0].startTime,
                                                        thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                                    };

                                                    // Add the new segment to existing segments
                                                    const updatedSegments = [...clipSegments, newSegment];

                                                    // Create and dispatch the update event
                                                    const updateEvent = new CustomEvent('update-segments', {
                                                        detail: {
                                                            segments: updatedSegments,
                                                            recordHistory: true,
                                                            action: 'create_segment_before_first',
                                                        },
                                                    });
                                                    document.dispatchEvent(updateEvent);
                                                    logger.debug(
                                                        'Created new segment from',
                                                        formatDetailedTime(clickedTime),
                                                        'to first segment'
                                                    );

                                                    // Show the new segment's tooltip
                                                    setSelectedSegmentId(newSegment.id);
                                                    setShowEmptySpaceTooltip(false);
                                                }
                                                // Check if we're after all segments and should create a segment to the end
                                                else if (
                                                    clickedTime > sortedByStart[sortedByStart.length - 1].endTime
                                                ) {
                                                    // Create a new segment from clicked time to end of video
                                                    const newSegment: Segment = {
                                                        id: Date.now(),
                                                        name: 'segment',
                                                        startTime: clickedTime,
                                                        endTime: duration,
                                                        thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                                    };

                                                    // Add the new segment to existing segments
                                                    const updatedSegments = [...clipSegments, newSegment];

                                                    // Create and dispatch the update event
                                                    const updateEvent = new CustomEvent('update-segments', {
                                                        detail: {
                                                            segments: updatedSegments,
                                                            recordHistory: true,
                                                            action: 'create_segment_to_end',
                                                        },
                                                    });
                                                    document.dispatchEvent(updateEvent);
                                                    logger.debug(
                                                        'Created new segment from',
                                                        formatDetailedTime(clickedTime),
                                                        'to end'
                                                    );

                                                    // Show the new segment's tooltip
                                                    setSelectedSegmentId(newSegment.id);
                                                    setShowEmptySpaceTooltip(false);
                                                } else {
                                                    // Not in a gap, check if we can extend the first segment to start of video
                                                    const firstSegment = sortedByStart[0];

                                                    if (firstSegment && firstSegment.startTime > 0) {
                                                        // Extend the first segment to start of video
                                                        const updatedSegments = clipSegments.map((seg) => {
                                                            if (seg.id === firstSegment.id) {
                                                                return {
                                                                    ...seg,
                                                                    startTime: 0,
                                                                };
                                                            }
                                                            return seg;
                                                        });

                                                        // Create and dispatch the update event
                                                        const updateEvent = new CustomEvent('update-segments', {
                                                            detail: {
                                                                segments: updatedSegments,
                                                                recordHistory: true,
                                                                action: 'extend_first_segment',
                                                            },
                                                        });
                                                        document.dispatchEvent(updateEvent);
                                                        logger.debug('Extended first segment to start of video');

                                                        // Show the first segment's tooltip
                                                        setSelectedSegmentId(firstSegment.id);
                                                        setShowEmptySpaceTooltip(false);
                                                    }
                                                }
                                            }
                                        } else if (clickedTime < duration) {
                                            // No segments exist; create a new segment from clicked time to end
                                            const newSegment: Segment = {
                                                id: Date.now(),
                                                name: 'segment',
                                                startTime: clickedTime,
                                                endTime: duration,
                                                thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                                            };

                                            // Create and dispatch the update event
                                            const updateEvent = new CustomEvent('update-segments', {
                                                detail: {
                                                    segments: [newSegment],
                                                    recordHistory: true,
                                                    action: 'create_segment_to_end',
                                                },
                                            });
                                            document.dispatchEvent(updateEvent);
                                            logger.debug(
                                                'Created new segment from',
                                                formatDetailedTime(clickedTime),
                                                'to end'
                                            );

                                            // Show the new segment's tooltip
                                            setSelectedSegmentId(newSegment.id);
                                            setShowEmptySpaceTooltip(false);
                                        }
                                    }}
                                >
                                    <img
                                        src={segmentNewStartIcon}
                                        alt="Set start point"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                        }}
                                    />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Precise Time Navigation & Zoom Controls */}
            <div className="timeline-controls">
                {/* Precise Time Input */}
                <div className="time-navigation">
                    <div className="time-nav-label">Go to Time:</div>
                    <input
                        type="text"
                        className="time-input"
                        placeholder="00:00:00.000"
                        data-tooltip="Enter time in format: hh:mm:ss.ms"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const input = e.currentTarget.value;
                                try {
                                    // Parse time format like "00:30:15.250" or "30:15.250" or "30:15"
                                    const parts = input.split(':');
                                    let hours = 0,
                                        minutes = 0,
                                        seconds = 0,
                                        milliseconds = 0;

                                    if (parts.length === 3) {
                                        // Format: HH:MM:SS.ms
                                        hours = parseInt(parts[0]);
                                        minutes = parseInt(parts[1]);
                                        const secParts = parts[2].split('.');
                                        seconds = parseInt(secParts[0]);
                                        if (secParts.length > 1)
                                            milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3));
                                    } else if (parts.length === 2) {
                                        // Format: MM:SS.ms
                                        minutes = parseInt(parts[0]);
                                        const secParts = parts[1].split('.');
                                        seconds = parseInt(secParts[0]);
                                        if (secParts.length > 1)
                                            milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3));
                                    }

                                    const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
                                    if (!isNaN(totalSeconds) && totalSeconds >= 0 && totalSeconds <= duration) {
                                        onSeek(totalSeconds);

                                        // Create a helper function to show tooltip that uses the same logic as the millisecond buttons
                                        const showTooltipAtTime = (timeInSeconds: number) => {
                                            // Find the segment at the given time using improved matching
                                            const segmentAtTime = clipSegments.find((seg) => {
                                                const isWithinSegment =
                                                    timeInSeconds >= seg.startTime && timeInSeconds <= seg.endTime;
                                                const isAtExactStart = Math.abs(timeInSeconds - seg.startTime) < 0.001; // Within 1ms of start
                                                const isAtExactEnd = Math.abs(timeInSeconds - seg.endTime) < 0.001; // Within 1ms of end
                                                return isWithinSegment || isAtExactStart || isAtExactEnd;
                                            });

                                            // Calculate position for tooltip
                                            if (timelineRef.current && scrollContainerRef.current) {
                                                const rect = timelineRef.current.getBoundingClientRect();

                                                // Handle zoomed timeline by accounting for scroll position
                                                let xPos;

                                                if (zoomLevel > 1) {
                                                    // For zoomed timeline, calculate position based on visible area
                                                    const visibleTimelineLeft =
                                                        rect.left - scrollContainerRef.current.scrollLeft;
                                                    const markerVisibleX =
                                                        visibleTimelineLeft + (timeInSeconds / duration) * rect.width;
                                                    xPos = markerVisibleX;
                                                } else {
                                                    // For non-zoomed timeline, use the simple calculation
                                                    const positionPercent = timeInSeconds / duration;
                                                    xPos = rect.left + rect.width * positionPercent;
                                                }

                                                setTooltipPosition({
                                                    x: xPos,
                                                    y: rect.top - 10,
                                                });
                                                setClickedTime(timeInSeconds);

                                                if (segmentAtTime) {
                                                    // Show segment tooltip
                                                    setSelectedSegmentId(segmentAtTime.id);
                                                    setShowEmptySpaceTooltip(false);
                                                } else {
                                                    // Show empty space tooltip
                                                    setSelectedSegmentId(null);
                                                    setShowEmptySpaceTooltip(true);
                                                }
                                            }
                                        };

                                        // Show tooltip after a slight delay to ensure UI updates
                                        setTimeout(() => showTooltipAtTime(totalSeconds), 10);
                                    }
                                } catch (error) {
                                    console.error('Invalid time format:', error);
                                }
                            }
                        }}
                    />
                    {/* Helper function to show tooltip at current position */}
                    {/* This is defined within the component to access state variables and functions */}
                    <div className="time-button-group">
                        {(() => {
                            // Helper function to show the appropriate tooltip at the current time position
                            const showTooltipAtCurrentTime = () => {
                                // Find the segment at the current time (after seeking) - using improved matching for better precision
                                const segmentAtCurrentTime = clipSegments.find((seg) => {
                                    const isWithinSegment = currentTime >= seg.startTime && currentTime <= seg.endTime;
                                    const isAtExactStart = Math.abs(currentTime - seg.startTime) < 0.001; // Within 1ms of start
                                    const isAtExactEnd = Math.abs(currentTime - seg.endTime) < 0.001; // Within 1ms of end
                                    return isWithinSegment || isAtExactStart || isAtExactEnd;
                                });

                                // Calculate position for tooltip (above the timeline where the marker is)
                                if (timelineRef.current && scrollContainerRef.current) {
                                    const rect = timelineRef.current.getBoundingClientRect();

                                    // Handle zoomed timeline by accounting for scroll position
                                    let xPos;

                                    if (zoomLevel > 1) {
                                        // For zoomed timeline, calculate position based on visible area
                                        const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
                                        const markerVisibleX =
                                            visibleTimelineLeft + (currentTime / duration) * rect.width;
                                        xPos = markerVisibleX;
                                    } else {
                                        // For non-zoomed timeline, use the simple calculation
                                        const positionPercent = currentTime / duration;
                                        xPos = rect.left + rect.width * positionPercent;
                                    }

                                    setTooltipPosition({
                                        x: xPos,
                                        y: rect.top - 10,
                                    });
                                    setClickedTime(currentTime);

                                    if (segmentAtCurrentTime) {
                                        // Show segment tooltip
                                        setSelectedSegmentId(segmentAtCurrentTime.id);
                                        setShowEmptySpaceTooltip(false);
                                    } else {
                                        // Calculate available space for new segment before showing tooltip
                                        const availableSpace = calculateAvailableSpace(currentTime);
                                        setAvailableSegmentDuration(availableSpace);

                                        // Only show tooltip if there's enough space for a minimal segment
                                        if (availableSpace >= 0.5) {
                                            // Show empty space tooltip
                                            setSelectedSegmentId(null);
                                            setShowEmptySpaceTooltip(true);
                                        } else {
                                            // Not enough space, don't show any tooltip
                                            setSelectedSegmentId(null);
                                            setShowEmptySpaceTooltip(false);
                                        }
                                    }
                                }
                            };

                            return (
                                <>
                                    <button
                                        className="time-button"
                                        onClick={() => {
                                            // Move back 10ms
                                            onSeek(currentTime - 0.01);
                                            // Show appropriate tooltip
                                            setTimeout(showTooltipAtCurrentTime, 10); // Short delay to ensure time is updated
                                        }}
                                        data-tooltip="Move back 10ms"
                                    >
                                        -10ms
                                    </button>
                                    <button
                                        className="time-button"
                                        onClick={() => {
                                            // Move back 1ms
                                            onSeek(currentTime - 0.001);
                                            // Show appropriate tooltip
                                            setTimeout(showTooltipAtCurrentTime, 10);
                                        }}
                                        data-tooltip="Move back 1ms"
                                    >
                                        -1ms
                                    </button>
                                    <button
                                        className="time-button"
                                        onClick={() => {
                                            // Move forward 1ms
                                            onSeek(currentTime + 0.001);
                                            // Show appropriate tooltip
                                            setTimeout(showTooltipAtCurrentTime, 10);
                                        }}
                                        data-tooltip="Move forward 1ms"
                                    >
                                        +1ms
                                    </button>
                                    <button
                                        className="time-button"
                                        onClick={() => {
                                            // Move forward 10ms
                                            onSeek(currentTime + 0.01);
                                            // Show appropriate tooltip
                                            setTimeout(showTooltipAtCurrentTime, 10);
                                        }}
                                        data-tooltip="Move forward 10ms"
                                    >
                                        +10ms
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Zoom Dropdown Control and Save Buttons */}
                <div className="controls-right">
                    <div className="zoom-dropdown-container">
                        <button
                            className="zoom-button"
                            data-tooltip="Select zoom level"
                            onClick={() => setIsZoomDropdownOpen(!isZoomDropdownOpen)}
                        >
                            Zoom {zoomLevel}x
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        {isZoomDropdownOpen && (
                            <div
                                className="zoom-dropdown"
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    zIndex: 1000,
                                }}
                            >
                                {[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096].map((level) => (
                                    <div
                                        key={level}
                                        className={`zoom-option ${zoomLevel === level ? 'selected' : ''}`}
                                        onClick={() => {
                                            onZoomChange(level);
                                            setIsZoomDropdownOpen(false);
                                        }}
                                    >
                                        {zoomLevel === level && (
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        )}
                                        Zoom {level}x
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Auto saved time */}
                    <div
                        className="auto-saved-time"
                        style={{
                            color: isAutoSaving ? '#1976d2' : 'gray',
                            fontSize: '12px',
                            marginLeft: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                        }}
                    >
                        {isAutoSaving ? (
                            <>
                                <span
                                    className="auto-save-spinner"
                                    style={{
                                        display: 'inline-block',
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid #f3f3f3',
                                        borderTop: '2px solid #1976d2',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }}
                                ></span>
                                Auto saving...
                            </>
                        ) : lastAutoSaveTime ? (
                            `Auto saved: ${lastAutoSaveTime}`
                        ) : (
                            'Not saved yet'
                        )}
                    </div>

                    {/* Save Buttons Row */}
                    <div className="save-buttons-row">
                        {onSave && (
                            <button
                                onClick={() => setShowSaveModal(true)}
                                className="save-button"
                                data-tooltip="Save changes"
                            >
                                Save
                            </button>
                        )}

                        {onSaveACopy && (
                            <button
                                onClick={() => setShowSaveAsModal(true)}
                                className="save-copy-button"
                                data-tooltip="Save as a new copy"
                            >
                                Save as Copy
                            </button>
                        )}

                        {onSaveSegments && (
                            <button
                                onClick={() => setShowSaveSegmentsModal(true)}
                                className="save-segments-button"
                                data-tooltip="Save segments as separate files"
                            >
                                Save Segments
                            </button>
                        )}
                    </div>

                    {/* Save Confirmation Modal */}
                    <Modal
                        isOpen={showSaveModal}
                        onClose={() => setShowSaveModal(false)}
                        title="Save Changes"
                        actions={
                            <>
                                <button
                                    className="modal-button modal-button-secondary"
                                    onClick={() => setShowSaveModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="modal-button modal-button-primary"
                                    onClick={() => {
                                        // Reset unsaved changes flag before saving
                                        if (onSave) onSave();
                                        handleSaveConfirm();
                                    }}
                                >
                                    Confirm Save
                                </button>
                            </>
                        }
                    >
                        <p className="modal-message">
                            You're about to replace the original video with this trimmed version. This can't be undone.
                        </p>
                    </Modal>

                    {/* Save As Copy Modal */}
                    <Modal
                        isOpen={showSaveAsModal}
                        onClose={() => setShowSaveAsModal(false)}
                        title="Save As New Copy"
                        actions={
                            <>
                                <button
                                    className="modal-button modal-button-secondary"
                                    onClick={() => setShowSaveAsModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="modal-button modal-button-primary"
                                    onClick={() => {
                                        // Reset unsaved changes flag before saving
                                        if (onSaveACopy) onSaveACopy();
                                        handleSaveAsCopyConfirm();
                                    }}
                                >
                                    Confirm Save As Copy
                                </button>
                            </>
                        }
                    >
                        <p className="modal-message">
                            You're about to save a new copy with your edits. The original video will stay the same. Find
                            the new file in your My Media folder - named after the original file.
                        </p>
                    </Modal>

                    {/* Processing Modal */}
                    <Modal isOpen={showProcessingModal} onClose={() => {}} title="Processing Video">
                        <div className="modal-spinner">
                            <div className="spinner"></div>
                        </div>
                        <p className="modal-message text-center">Please wait while your video is being processed...</p>
                    </Modal>

                    {/* Save Segments Modal */}
                    <Modal
                        isOpen={showSaveSegmentsModal}
                        onClose={() => setShowSaveSegmentsModal(false)}
                        title="Save Segments"
                        actions={
                            <>
                                <button
                                    className="modal-button modal-button-secondary"
                                    onClick={() => setShowSaveSegmentsModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="modal-button modal-button-primary"
                                    onClick={() => {
                                        // Reset unsaved changes flag before saving
                                        if (onSaveSegments) onSaveSegments();
                                        handleSaveSegmentsConfirm();
                                    }}
                                >
                                    Save Segments
                                </button>
                            </>
                        }
                    >
                        <p className="modal-message">
                            You're about to save each segment as a separate video. Find the new files in your My Media
                            folder - named after the original file.
                        </p>
                    </Modal>

                    {/* Success Modal */}
                    <Modal
                        isOpen={showSuccessModal}
                        onClose={() => setShowSuccessModal(false)}
                        title="Video Edited Successfully"
                    >
                        <div className="modal-success-content">
                            {/* <p className="modal-message text-center">
                {successMessage || "Processing completed successfully!"}
              </p> */}

                            <p className="modal-message text-center redirect-message">
                                {saveType === 'segments'
                                    ? 'You will be redirected to your '
                                    : 'You will be redirected to your '}
                                <a href={redirectUrl} className="media-page-link" style={mediaPageLinkStyles}>
                                    media page
                                </a>
                                {' in '}
                                <span className="countdown">10</span> seconds.{' '}
                                {saveType === 'segments'
                                    ? 'The new video(s) will soon be there.'
                                    : 'Changes to the video might take a few minutes to be applied.'}
                            </p>
                        </div>
                    </Modal>

                    {/* Error Modal */}
                    <Modal
                        isOpen={showErrorModal}
                        onClose={() => setShowErrorModal(false)}
                        title="Video Processing Error"
                    >
                        <div className="modal-error-content">
                            <div className="modal-error-icon">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#F44336"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <p className="modal-message text-center error-message">{errorMessage}</p>
                        </div>
                        <div className="modal-choices">
                            <button
                                onClick={() => setShowErrorModal(false)}
                                className="modal-choice-button centered-choice"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Close
                            </button>
                        </div>
                    </Modal>

                    {/* Dropdown was moved inside the container element */}
                </div>
            </div>

            {/* Mobile Uninitialized Overlay - Show only when on mobile and video hasn't been played yet */}
            {isIOSUninitialized && (
                <div className="mobile-timeline-overlay">
                    <div className="mobile-timeline-message">
                        <p>Please play the video first to enable timeline controls</p>
                        <div className="mobile-play-icon"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimelineControls;
