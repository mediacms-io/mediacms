import { useState, useRef, useEffect } from 'react';
import { generateThumbnail } from '@/lib/videoUtils';
import { formatDetailedTime } from '@/lib/timeUtils';
import logger from '@/lib/logger';
import type { Segment } from '@/components/ClipSegments';

// Represents a state of the editor for undo/redo
interface EditorState {
    trimStart: number;
    trimEnd: number;
    splitPoints: number[];
    clipSegments: Segment[];
    action?: string;
}

const useVideoTrimmer = () => {
    // Video element reference and state
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Timeline state
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    const [zoomLevel, setZoomLevel] = useState(1); // Start with 1x zoom level

    // Clip segments state
    const [clipSegments, setClipSegments] = useState<Segment[]>([]);

    // History state for undo/redo
    const [history, setHistory] = useState<EditorState[]>([]);
    const [historyPosition, setHistoryPosition] = useState(-1);

    // Track unsaved changes
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // State for playing segments
    const [isPlayingSegments, setIsPlayingSegments] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

    // Monitor for history changes
    useEffect(() => {
        if (history.length > 0) {
            // For debugging - moved to console.debug
            if (process.env.NODE_ENV === 'development') {
                console.debug(`History state updated: ${history.length} entries, position: ${historyPosition}`);
                // Log actions in history to help debug undo/redo
                const actions = history.map(
                    (state, idx) => `${idx}: ${state.action || 'unknown'} (segments: ${state.clipSegments.length})`
                );
                console.debug('History actions:', actions);
            }

            // If there's at least one history entry and it wasn't a save operation, mark as having unsaved changes
            const lastAction = history[historyPosition]?.action || '';
            if (lastAction !== 'save' && lastAction !== 'save_copy' && lastAction !== 'save_segments') {
                setHasUnsavedChanges(true);
            }
        }
    }, [history, historyPosition]);

    // Initialize video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setTrimEnd(video.duration);

            // Generate placeholders and create initial segment
            const initializeEditor = async () => {
                // Generate thumbnail for initial segment
                const segmentThumbnail = await generateThumbnail(video, video.duration / 2);

                // Create an initial segment that spans the entire video
                const initialSegment: Segment = {
                    id: 1,
                    name: 'segment',
                    startTime: 0,
                    endTime: video.duration,
                    thumbnail: segmentThumbnail,
                };

                // Initialize history state with the full-length segment
                const initialState: EditorState = {
                    trimStart: 0,
                    trimEnd: video.duration,
                    splitPoints: [],
                    clipSegments: [initialSegment],
                };

                setHistory([initialState]);
                setHistoryPosition(0);
                setClipSegments([initialSegment]);

                // Generate timeline thumbnails
                const count = 6;
                const interval = video.duration / count;
                const placeholders: string[] = [];

                for (let i = 0; i < count; i++) {
                    const time = interval * i + interval / 2;
                    const thumbnail = await generateThumbnail(video, time);
                    placeholders.push(thumbnail);
                }

                setThumbnails(placeholders);
            };

            initializeEditor();
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
        };

        const handlePlay = () => {
            setIsPlaying(true);
            setVideoInitialized(true);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            video.currentTime = trimStart;
        };

        // Add event listeners
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            // Remove event listeners
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Play/pause video
    const playPauseVideo = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            // iOS Safari fix: Use the last seeked position if available
            if (!isPlaying && typeof window !== 'undefined' && window.lastSeekedPosition > 0) {
                // Only apply this if the video is not at the same position already
                // This avoids unnecessary seeking which might cause playback issues
                if (Math.abs(video.currentTime - window.lastSeekedPosition) > 0.1) {
                    video.currentTime = window.lastSeekedPosition;
                }
            }
            // If at the end of the trim range, reset to the beginning
            else if (video.currentTime >= trimEnd) {
                video.currentTime = trimStart;
            }

            video
                .play()
                .then(() => {
                    // Play started successfully
                    // Reset the last seeked position after successfully starting playback
                    if (typeof window !== 'undefined') {
                        window.lastSeekedPosition = 0;
                    }
                })
                .catch((err) => {
                    console.error('Error starting playback:', err);
                    setIsPlaying(false); // Reset state if play failed
                });
        }
    };

    // Seek to a specific time
    const seekVideo = (time: number) => {
        const video = videoRef.current;
        if (!video) return;

        // Track if the video was playing before seeking
        const wasPlaying = !video.paused;

        // Update the video position
        video.currentTime = time;
        setCurrentTime(time);

        // Store the position in a global state accessible to iOS Safari
        // This ensures when play is pressed later, it remembers the position
        if (typeof window !== 'undefined') {
            window.lastSeekedPosition = time;
        }

        // Resume playback if it was playing before
        if (wasPlaying) {
            // Play immediately without delay
            video
                .play()
                .then(() => {
                    setIsPlaying(true); // Update state to reflect we're playing
                })
                .catch((err) => {
                    console.error('Error resuming playback:', err);
                    setIsPlaying(false);
                });
        }
    };

    // Save the current state to history with a debounce buffer
    // This helps prevent multiple rapid saves for small adjustments
    const saveState = (action?: string) => {
        // Deep clone to ensure state is captured correctly
        const newState: EditorState = {
            trimStart,
            trimEnd,
            splitPoints: [...splitPoints],
            clipSegments: JSON.parse(JSON.stringify(clipSegments)), // Deep clone to avoid reference issues
            action: action || 'manual_save', // Track the action that triggered this save
        };

        // Check if state is significantly different from last saved state
        const lastState = history[historyPosition];

        // Helper function to compare segments deeply
        const haveSegmentsChanged = () => {
            if (!lastState || lastState.clipSegments.length !== newState.clipSegments.length) {
                return true; // Different length means significant change
            }

            // Compare each segment's start and end times
            for (let i = 0; i < newState.clipSegments.length; i++) {
                const oldSeg = lastState.clipSegments[i];
                const newSeg = newState.clipSegments[i];

                if (!oldSeg || !newSeg) return true;

                // Check if any time values changed by more than 0.001 seconds (1ms)
                if (
                    Math.abs(oldSeg.startTime - newSeg.startTime) > 0.001 ||
                    Math.abs(oldSeg.endTime - newSeg.endTime) > 0.001
                ) {
                    return true;
                }
            }

            return false; // No significant changes found
        };

        const isSignificantChange =
            !lastState ||
            lastState.trimStart !== newState.trimStart ||
            lastState.trimEnd !== newState.trimEnd ||
            lastState.splitPoints.length !== newState.splitPoints.length ||
            haveSegmentsChanged();

        // Additionally, check if there's an explicit action from a UI event
        const hasExplicitActionFlag = newState.action !== undefined;

        // Only proceed if this is a significant change or if explicitly requested
        if (isSignificantChange || hasExplicitActionFlag) {
            // Get the current position to avoid closure issues
            const currentPosition = historyPosition;

            // Use functional updates to ensure we're working with the latest state
            setHistory((prevHistory) => {
                // If we're not at the end of history, truncate
                if (currentPosition < prevHistory.length - 1) {
                    const newHistory = prevHistory.slice(0, currentPosition + 1);
                    return [...newHistory, newState];
                } else {
                    // Just append to current history
                    return [...prevHistory, newState];
                }
            });

            // Update position using functional update
            setHistoryPosition((prev) => {
                const newPosition = prev + 1;
                // "Saved state to history position", newPosition)
                return newPosition;
            });
        } else {
            // logger.debug("Skipped non-significant state save");
        }
    };

    // Listen for trim handle update events
    useEffect(() => {
        const handleTrimUpdate = (e: CustomEvent) => {
            if (e.detail) {
                const { time, isStart, recordHistory, action } = e.detail;

                if (isStart) {
                    setTrimStart(time);
                } else {
                    setTrimEnd(time);
                }

                // Only record in history if explicitly requested
                if (recordHistory) {
                    // Use a small timeout to ensure the state is updated
                    setTimeout(() => {
                        saveState(action || (isStart ? 'adjust_trim_start' : 'adjust_trim_end'));
                    }, 10);
                }
            }
        };

        document.addEventListener('update-trim', handleTrimUpdate as EventListener);

        return () => {
            document.removeEventListener('update-trim', handleTrimUpdate as EventListener);
        };
    }, []);

    // Listen for segment update events and split-at-time events
    useEffect(() => {
        const handleUpdateSegments = (e: CustomEvent) => {
            if (e.detail && e.detail.segments) {
                // Check if this is a significant change that should be recorded in history
                // Default to true to ensure all segment changes are recorded
                const isSignificantChange = e.detail.recordHistory !== false;
                // Get the action type if provided
                const actionType = e.detail.action || 'update_segments';

                // Log the update details
                logger.debug(
                    `Updating segments with action: ${actionType}, recordHistory: ${isSignificantChange ? 'true' : 'false'}`
                );

                // Update segment state immediately for UI feedback
                setClipSegments(e.detail.segments);

                // Always save state to history for non-intermediate actions
                if (isSignificantChange) {
                    // A slight delay helps avoid race conditions but we need to
                    // ensure we capture the state properly
                    setTimeout(() => {
                        // Deep clone to ensure state is captured correctly
                        const segmentsClone = JSON.parse(JSON.stringify(e.detail.segments));

                        // Create a complete state snapshot
                        const stateWithAction: EditorState = {
                            trimStart,
                            trimEnd,
                            splitPoints: [...splitPoints],
                            clipSegments: segmentsClone,
                            action: actionType, // Store the action type in the state
                        };

                        // Get the current history position to ensure we're using the latest value
                        const currentHistoryPosition = historyPosition;

                        // Update history with the functional pattern to avoid stale closure issues
                        setHistory((prevHistory) => {
                            // If we're not at the end of the history, truncate
                            if (currentHistoryPosition < prevHistory.length - 1) {
                                const newHistory = prevHistory.slice(0, currentHistoryPosition + 1);
                                return [...newHistory, stateWithAction];
                            } else {
                                // Just append to current history
                                return [...prevHistory, stateWithAction];
                            }
                        });

                        // Ensure the historyPosition is updated to the correct position
                        setHistoryPosition((prev) => {
                            const newPosition = prev + 1;
                            logger.debug(`Saved state with action: ${actionType} to history position ${newPosition}`);
                            return newPosition;
                        });
                    }, 20); // Slightly increased delay to ensure state updates are complete
                } else {
                    logger.debug(`Skipped saving state to history for action: ${actionType} (recordHistory=false)`);
                }
            }
        };

        const handleSplitSegment = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (
                customEvent.detail &&
                typeof customEvent.detail.time === 'number' &&
                typeof customEvent.detail.segmentId === 'number'
            ) {
                // Get the time and segment ID from the event
                const timeToSplit = customEvent.detail.time;
                const segmentId = customEvent.detail.segmentId;

                // Move the current time to the split position
                seekVideo(timeToSplit);

                // Find the segment to split
                const segmentToSplit = clipSegments.find((seg) => seg.id === segmentId);
                if (!segmentToSplit) return;

                // Make sure the split point is within the segment
                if (timeToSplit <= segmentToSplit.startTime || timeToSplit >= segmentToSplit.endTime) {
                    return; // Can't split outside segment boundaries
                }

                // Create two new segments from the split
                const newSegments = [...clipSegments];

                // Remove the original segment
                const segmentIndex = newSegments.findIndex((seg) => seg.id === segmentId);
                if (segmentIndex === -1) return;

                newSegments.splice(segmentIndex, 1);

                // Create first half of the split segment - no thumbnail needed
                const firstHalf: Segment = {
                    id: Date.now(),
                    name: `${segmentToSplit.name}-A`,
                    startTime: segmentToSplit.startTime,
                    endTime: timeToSplit,
                    thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                };

                // Create second half of the split segment - no thumbnail needed
                const secondHalf: Segment = {
                    id: Date.now() + 1,
                    name: `${segmentToSplit.name}-B`,
                    startTime: timeToSplit,
                    endTime: segmentToSplit.endTime,
                    thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                };

                // Add the new segments
                newSegments.push(firstHalf, secondHalf);

                // Sort segments by start time
                newSegments.sort((a, b) => a.startTime - b.startTime);

                // Update state
                setClipSegments(newSegments);
                saveState('split_segment');
            }
        };

        // Handle delete segment event
        const handleDeleteSegment = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && typeof customEvent.detail.segmentId === 'number') {
                const segmentId = customEvent.detail.segmentId;

                // Find and remove the segment
                const newSegments = clipSegments.filter((segment) => segment.id !== segmentId);

                if (newSegments.length !== clipSegments.length) {
                    // If all segments are deleted, create a new full video segment
                    if (newSegments.length === 0 && videoRef.current) {
                        // Create a new default segment that spans the entire video
                        // No need to generate a thumbnail - we'll use dynamic colors
                        const defaultSegment: Segment = {
                            id: Date.now(),
                            name: 'segment',
                            startTime: 0,
                            endTime: videoRef.current.duration,
                            thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                        };

                        // Reset the trim points as well
                        setTrimStart(0);
                        setTrimEnd(videoRef.current.duration);
                        setSplitPoints([]);
                        setClipSegments([defaultSegment]);
                    } else {
                        // Just update the segments normally
                        setClipSegments(newSegments);
                    }
                    saveState('delete_segment');
                }
            }
        };

        document.addEventListener('update-segments', handleUpdateSegments as EventListener);
        document.addEventListener('split-segment', handleSplitSegment as EventListener);
        document.addEventListener('delete-segment', handleDeleteSegment as EventListener);

        return () => {
            document.removeEventListener('update-segments', handleUpdateSegments as EventListener);
            document.removeEventListener('split-segment', handleSplitSegment as EventListener);
            document.removeEventListener('delete-segment', handleDeleteSegment as EventListener);
        };
    }, [clipSegments, duration]);

    // Handle trim start change
    const handleTrimStartChange = (time: number) => {
        setTrimStart(time);
        saveState('adjust_trim_start');
    };

    // Handle trim end change
    const handleTrimEndChange = (time: number) => {
        setTrimEnd(time);
        saveState('adjust_trim_end');
    };

    // Handle split at current position
    const handleSplit = async () => {
        if (!videoRef.current) return;

        // Add current time to split points if not already present
        if (!splitPoints.includes(currentTime)) {
            const newSplitPoints = [...splitPoints, currentTime].sort((a, b) => a - b);
            setSplitPoints(newSplitPoints);

            // Generate segments based on split points
            const newSegments: Segment[] = [];
            let startTime = 0;

            for (let i = 0; i <= newSplitPoints.length; i++) {
                const endTime = i < newSplitPoints.length ? newSplitPoints[i] : duration;

                if (startTime < endTime) {
                    // No need to generate thumbnails - we'll use dynamic colors
                    newSegments.push({
                        id: Date.now() + i,
                        name: `Segment ${i + 1}`,
                        startTime,
                        endTime,
                        thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
                    });

                    startTime = endTime;
                }
            }

            setClipSegments(newSegments);
            saveState('create_split_points');
        }
    };

    // Handle reset of all edits
    const handleReset = async () => {
        setTrimStart(0);
        setTrimEnd(duration);
        setSplitPoints([]);

        // Create a new default segment that spans the entire video
        if (!videoRef.current) return;

        // No need to generate thumbnails - we'll use dynamic colors
        const defaultSegment: Segment = {
            id: Date.now(),
            name: 'segment',
            startTime: 0,
            endTime: duration,
            thumbnail: '', // Empty placeholder - we'll use dynamic colors instead
        };

        setClipSegments([defaultSegment]);
        saveState('reset_all');
    };

    // Handle undo
    const handleUndo = () => {
        if (historyPosition > 0) {
            const previousState = history[historyPosition - 1];
            logger.debug(
                `** UNDO ** to position ${historyPosition - 1}, action: ${previousState.action}, segments: ${previousState.clipSegments.length}`
            );

            // Log segment details to help debug
            logger.debug(
                'Segment details after undo:',
                previousState.clipSegments.map(
                    (seg) =>
                        `ID: ${seg.id}, Time: ${formatDetailedTime(seg.startTime)} - ${formatDetailedTime(seg.endTime)}`
                )
            );

            // Apply the previous state with deep cloning to avoid reference issues
            setTrimStart(previousState.trimStart);
            setTrimEnd(previousState.trimEnd);
            setSplitPoints([...previousState.splitPoints]);
            setClipSegments(JSON.parse(JSON.stringify(previousState.clipSegments)));
            setHistoryPosition(historyPosition - 1);
        } else {
            logger.debug('Cannot undo: at earliest history position');
        }
    };

    // Handle redo
    const handleRedo = () => {
        if (historyPosition < history.length - 1) {
            const nextState = history[historyPosition + 1];
            logger.debug(
                `** REDO ** to position ${historyPosition + 1}, action: ${nextState.action}, segments: ${nextState.clipSegments.length}`
            );

            // Log segment details to help debug
            logger.debug(
                'Segment details after redo:',
                nextState.clipSegments.map(
                    (seg) =>
                        `ID: ${seg.id}, Time: ${formatDetailedTime(seg.startTime)} - ${formatDetailedTime(seg.endTime)}`
                )
            );

            // Apply the next state with deep cloning to avoid reference issues
            setTrimStart(nextState.trimStart);
            setTrimEnd(nextState.trimEnd);
            setSplitPoints([...nextState.splitPoints]);
            setClipSegments(JSON.parse(JSON.stringify(nextState.clipSegments)));
            setHistoryPosition(historyPosition + 1);
        } else {
            logger.debug('Cannot redo: at latest history position');
        }
    };

    // Handle zoom level change
    const handleZoomChange = (level: number) => {
        setZoomLevel(level);
    };

    // Handle play/pause of the full video
    const handlePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            // Pause the video
            video.pause();
            setIsPlaying(false);
        } else {
            // iOS Safari fix: Check for lastSeekedPosition
            if (typeof window !== 'undefined' && window.lastSeekedPosition > 0) {
                // Only seek if the position is significantly different
                if (Math.abs(video.currentTime - window.lastSeekedPosition) > 0.1) {
                    logger.debug('handlePlay: Using lastSeekedPosition', window.lastSeekedPosition);
                    video.currentTime = window.lastSeekedPosition;
                }
            }

            // Play the video from current position with proper promise handling
            video
                .play()
                .then(() => {
                    setIsPlaying(true);
                    // Reset lastSeekedPosition after successful play
                    if (typeof window !== 'undefined') {
                        window.lastSeekedPosition = 0;
                    }
                })
                .catch((err) => {
                    console.error('Error playing video:', err);
                    setIsPlaying(false); // Reset state if play failed
                });
        }
    };

    // Toggle mute state
    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setIsMuted(!isMuted);
    };

    // Handle save action
    const handleSave = () => {
        // Sort segments chronologically by start time before saving
        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

        // Create the JSON data for saving
        const saveData = {
            type: 'save',
            segments: sortedSegments.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
            })),
        };

        // Display JSON in alert (for demonstration purposes)
        if (process.env.NODE_ENV === 'development') {
            console.debug('Saving data:', saveData);
        }

        // Mark as saved - no unsaved changes
        setHasUnsavedChanges(false);

        // Debug message
        if (process.env.NODE_ENV === 'development') {
            console.debug('Changes saved - reset unsaved changes flag');
        }

        // Save to history with special "save" action to mark saved state
        saveState('save');

        // In a real implementation, this would make a POST request to save the data
        // logger.debug("Save data:", saveData);
    };

    // Handle save a copy action
    const handleSaveACopy = () => {
        // Sort segments chronologically by start time before saving
        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

        // Create the JSON data for saving as a copy
        const saveData = {
            type: 'save_as_a_copy',
            segments: sortedSegments.map((segment) => ({
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
            })),
        };

        // Display JSON in alert (for demonstration purposes)
        if (process.env.NODE_ENV === 'development') {
            console.debug('Saving data as copy:', saveData);
        }

        // Mark as saved - no unsaved changes
        setHasUnsavedChanges(false);

        // Debug message
        if (process.env.NODE_ENV === 'development') {
            console.debug('Changes saved as copy - reset unsaved changes flag');
        }

        // Save to history with special "save_copy" action to mark saved state
        saveState('save_copy');
    };

    // Handle save segments individually action
    const handleSaveSegments = () => {
        // Sort segments chronologically by start time before saving
        const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

        // Create the JSON data for saving individual segments
        const saveData = {
            type: 'save_segments',
            segments: sortedSegments.map((segment) => ({
                name: segment.name,
                startTime: formatDetailedTime(segment.startTime),
                endTime: formatDetailedTime(segment.endTime),
            })),
        };

        // Display JSON in alert (for demonstration purposes)
        if (process.env.NODE_ENV === 'development') {
            console.debug('Saving data as segments:', saveData);
        }

        // Mark as saved - no unsaved changes
        setHasUnsavedChanges(false);

        // Debug message
        logger.debug('All segments saved individually - reset unsaved changes flag');

        // Save to history with special "save_segments" action to mark saved state
        saveState('save_segments');
    };

    // Handle seeking with mobile check
    const handleMobileSafeSeek = (time: number) => {
        // Only allow seeking if not on mobile or if video has been played
        if (!isMobile || videoInitialized) {
            seekVideo(time);
        }
    };

    // Check if device is mobile
    const isMobile =
        typeof window !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent);

    // Add videoInitialized state
    const [videoInitialized, setVideoInitialized] = useState(false);

    // Effect to handle segments playback
    useEffect(() => {
        if (!isPlayingSegments || !videoRef.current) return;

        const video = videoRef.current;
        const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

        const handleSegmentsPlayback = () => {
            const currentSegment = orderedSegments[currentSegmentIndex];
            if (!currentSegment) return;

            const currentTime = video.currentTime;

            // If we're before the current segment's start, jump to it
            if (currentTime < currentSegment.startTime) {
                video.currentTime = currentSegment.startTime;
                return;
            }

            // If we've reached the end of the current segment
            if (currentTime >= currentSegment.endTime - 0.01) {
                if (currentSegmentIndex < orderedSegments.length - 1) {
                    // Move to next segment
                    const nextSegment = orderedSegments[currentSegmentIndex + 1];
                    video.currentTime = nextSegment.startTime;
                    setCurrentSegmentIndex(currentSegmentIndex + 1);

                    // If video is somehow paused, ensure it keeps playing
                    if (video.paused) {
                        logger.debug('Ensuring playback continues to next segment');
                        video.play().catch((err) => {
                            console.error('Error continuing segment playback:', err);
                        });
                    }
                } else {
                    // End of all segments - only pause when we reach the very end
                    video.pause();
                    setIsPlayingSegments(false);
                    setCurrentSegmentIndex(0);
                    video.removeEventListener('timeupdate', handleSegmentsPlayback);
                }
            }
        };

        video.addEventListener('timeupdate', handleSegmentsPlayback);

        // Start playing if not already playing
        if (video.paused && orderedSegments.length > 0) {
            video.currentTime = orderedSegments[0].startTime;
            video.play().catch(console.error);
        }

        return () => {
            video.removeEventListener('timeupdate', handleSegmentsPlayback);
        };
    }, [isPlayingSegments, currentSegmentIndex, clipSegments]);

    // Effect to handle manual segment index updates during segments playback
    useEffect(() => {
        const handleSegmentIndexUpdate = (event: CustomEvent) => {
            const { segmentIndex } = event.detail;
            if (isPlayingSegments && segmentIndex !== currentSegmentIndex) {
                logger.debug(`Updating current segment index from ${currentSegmentIndex} to ${segmentIndex}`);
                setCurrentSegmentIndex(segmentIndex);
            }
        };

        document.addEventListener('update-segment-index', handleSegmentIndexUpdate as EventListener);

        return () => {
            document.removeEventListener('update-segment-index', handleSegmentIndexUpdate as EventListener);
        };
    }, [isPlayingSegments, currentSegmentIndex]);

    // Handle play segments
    const handlePlaySegments = () => {
        const video = videoRef.current;
        if (!video || clipSegments.length === 0) return;

        if (isPlayingSegments) {
            // Stop segments playback
            video.pause();
            setIsPlayingSegments(false);
            setCurrentSegmentIndex(0);
        } else {
            // Start segments playback
            setIsPlayingSegments(true);
            setCurrentSegmentIndex(0);

            // Start segments playback

            // Sort segments by start time
            const orderedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);

            // Start from the first segment
            video.currentTime = orderedSegments[0].startTime;

            // Start playback with proper error handling
            video.play().catch((err) => {
                console.error('Error starting segments playback:', err);
                setIsPlayingSegments(false);
            });

            logger.debug('Starting playback of all segments continuously');
        }
    };

    return {
        videoRef,
        currentTime,
        duration,
        isPlaying,
        setIsPlaying,
        isMuted,
        isPlayingSegments,
        thumbnails,
        trimStart,
        trimEnd,
        splitPoints,
        zoomLevel,
        clipSegments,
        hasUnsavedChanges,
        historyPosition,
        history,
        handleTrimStartChange,
        handleTrimEndChange,
        handleZoomChange,
        handleMobileSafeSeek,
        handleSplit,
        handleReset,
        handleUndo,
        handleRedo,
        handlePlaySegments,
        toggleMute,
        handleSave,
        handleSaveACopy,
        handleSaveSegments,
        isMobile,
        videoInitialized,
        setVideoInitialized,
    };
};

export default useVideoTrimmer;
