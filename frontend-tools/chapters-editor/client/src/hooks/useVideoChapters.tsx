import { useState, useRef, useEffect } from 'react';
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

const useVideoChapters = () => {
    // Helper function to generate proper chapter name based on chronological position
    const generateChapterName = (newSegmentStartTime: number, existingSegments: Segment[]): string => {
        // Create a temporary array with all segments including the new one
        const allSegments = [...existingSegments, { startTime: newSegmentStartTime } as Segment];
        // Sort by start time to find chronological position
        const sortedSegments = allSegments.sort((a, b) => a.startTime - b.startTime);
        // Find the index of our new segment
        const chapterIndex = sortedSegments.findIndex((seg) => seg.startTime === newSegmentStartTime);
        return `Chapter ${chapterIndex + 1}`;
    };

    // Helper function to renumber all segments in chronological order
    const renumberAllSegments = (segments: Segment[]): Segment[] => {
        // Sort segments by start time
        const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

        // Renumber each segment based on its chronological position
        // Only update titles that follow the default "Chapter X" pattern to preserve custom titles
        return sortedSegments.map((segment, index) => {
            const currentTitle = segment.chapterTitle || '';
            const isDefaultTitle = /^Chapter \d+$/.test(currentTitle);

            return {
                ...segment,
                chapterTitle: isDefaultTitle ? `Chapter ${index + 1}` : currentTitle,
            };
        });
    };

    // Helper function to parse time string (HH:MM:SS.mmm) to seconds
    const parseTimeToSeconds = (timeString: string): number => {
        const parts = timeString.split(':');
        if (parts.length !== 3) return 0;

        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseFloat(parts[2]) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    };

    // Video element reference and state
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    
    // Track if editor has been initialized to prevent re-initialization on Safari metadata events
    const isInitializedRef = useRef<boolean>(false);

    // Timeline state
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    const [zoomLevel, setZoomLevel] = useState(1); // Start with 1x zoom level

    // Clip segments state
    const [clipSegments, setClipSegments] = useState<Segment[]>([]);

    // Selected segment state for chapter editing
    const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);

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

    // Detect Safari browser
    const isSafari = () => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        return /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
    };

    // Initialize video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            // CRITICAL: Prevent re-initialization if editor has already been initialized
            // Safari fires loadedmetadata multiple times, which was resetting segments
            if (isInitializedRef.current) {
                // Still update duration and trimEnd in case they changed
                setDuration(video.duration);
                setTrimEnd(video.duration);
                return;
            }
            
            setDuration(video.duration);
            setTrimEnd(video.duration);

            // Generate placeholders and create initial segments
            const initializeEditor = async () => {
                let initialSegments: Segment[] = [];

                // Check if we have existing chapters from the backend
                const existingChapters = (typeof window !== 'undefined' && (window as any).MEDIA_DATA?.chapters) || [];

                if (existingChapters.length > 0) {
                    // Create segments from existing chapters
                    for (let i = 0; i < existingChapters.length; i++) {
                        const chapter = existingChapters[i];

                        // Parse time strings to seconds
                        const startTime = parseTimeToSeconds(chapter.startTime);
                        const endTime = parseTimeToSeconds(chapter.endTime);

                        const segment: Segment = {
                            id: i + 1,
                            chapterTitle: chapter.chapterTitle,
                            startTime: startTime,
                            endTime: endTime,
                        };

                        initialSegments.push(segment);
                    }
                } else {
                    // Create a default segment that spans the entire video on first load
                    const initialSegment: Segment = {
                        id: 1,
                        chapterTitle: 'Chapter 1',
                        startTime: 0,
                        endTime: video.duration,
                    };

                    initialSegments = [initialSegment];
                }

                // Initialize history state with the segments
                const initialState: EditorState = {
                    trimStart: 0,
                    trimEnd: video.duration,
                    splitPoints: [],
                    clipSegments: initialSegments,
                };

                setHistory([initialState]);
                setHistoryPosition(0);
                setClipSegments(initialSegments);
                isInitializedRef.current = true; // Mark as initialized
            };

            initializeEditor();
        };

        // Safari-specific fallback for audio files
        const handleCanPlay = () => {
            // If loadedmetadata hasn't fired yet but we have duration, trigger initialization
            // Also check if already initialized to prevent re-initialization
            if (video.duration && duration === 0 && !isInitializedRef.current) {
                handleLoadedMetadata();
            }
        };

        // Additional Safari fallback for audio files
        const handleLoadedData = () => {
            // If we still don't have duration, try again
            // Also check if already initialized to prevent re-initialization
            if (video.duration && duration === 0 && !isInitializedRef.current) {
                handleLoadedMetadata();
            }
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

        // Safari-specific fallback event listeners for audio files
        if (isSafari()) {
            video.addEventListener('canplay', handleCanPlay);
            video.addEventListener('loadeddata', handleLoadedData);

            // Additional timeout fallback for Safari audio files
            const safariTimeout = setTimeout(() => {
                if (video.duration && duration === 0 && !isInitializedRef.current) {
                    handleLoadedMetadata();
                }
            }, 1000);

            return () => {
                // Remove event listeners
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                video.removeEventListener('timeupdate', handleTimeUpdate);
                video.removeEventListener('play', handlePlay);
                video.removeEventListener('pause', handlePause);
                video.removeEventListener('ended', handleEnded);
                video.removeEventListener('canplay', handleCanPlay);
                video.removeEventListener('loadeddata', handleLoadedData);
                clearTimeout(safariTimeout);
            };
        }

        return () => {
            // Remove event listeners
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Safari auto-initialization on user interaction
    useEffect(() => {
        if (isSafari() && videoRef.current) {
            const video = videoRef.current;

            const initializeSafariOnInteraction = () => {
                // Try to load video metadata by attempting to play and immediately pause
                const attemptInitialization = async () => {
                    try {
                        logger.debug('Safari: Attempting auto-initialization on user interaction');

                        // Briefly play to trigger metadata loading, then pause
                        await video.play();
                        video.pause();

                        // Check if we now have duration and initialize if needed
                        if (video.duration > 0 && clipSegments.length === 0) {
                            logger.debug('Safari: Successfully initialized metadata, creating default segment');

                            const defaultSegment: Segment = {
                                id: 1,
                                chapterTitle: '',
                                startTime: 0,
                                endTime: video.duration,
                            };

                            setDuration(video.duration);
                            setTrimEnd(video.duration);
                            setClipSegments([defaultSegment]);

                            const initialState: EditorState = {
                                trimStart: 0,
                                trimEnd: video.duration,
                                splitPoints: [],
                                clipSegments: [defaultSegment],
                            };

                            setHistory([initialState]);
                            setHistoryPosition(0);
                        }
                    } catch (error) {
                        logger.debug('Safari: Auto-initialization failed, will retry on next interaction:', error);
                    }
                };

                attemptInitialization();
            };

            // Listen for any user interaction with video controls
            const handleUserInteraction = () => {
                if (clipSegments.length === 0 && video.duration === 0) {
                    initializeSafariOnInteraction();
                }
            };

            // Add listeners for various user interactions
            document.addEventListener('click', handleUserInteraction);
            document.addEventListener('keydown', handleUserInteraction);

            return () => {
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('keydown', handleUserInteraction);
            };
        }
    }, [clipSegments.length]);

    // Safari initialization helper
    const initializeSafariIfNeeded = async () => {
        if (isSafari() && videoRef.current && duration === 0) {
            const video = videoRef.current;
            try {
                logger.debug('Safari: Initializing on user interaction');
                // This play/pause will trigger metadata loading in Safari
                await video.play();
                video.pause();

                // The metadata events should fire now and initialize segments
                return true;
            } catch (error) {
                logger.debug('Safari: Initialization attempt failed:', error);
                return false;
            }
        }
        return false;
    };

    // Play/pause video
    const playPauseVideo = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            // Safari: Try to initialize if needed before playing
            if (isSafari() && duration === 0) {
                initializeSafariIfNeeded().then(() => {
                    // After initialization, try to play again
                    setTimeout(() => {
                        if (video && !isPlaying) {
                            video.play().catch((err) => {
                                console.error('Error playing after Safari initialization:', err);
                            });
                        }
                    }, 100);
                });
                return;
            }

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

        // Safari: Try to initialize if needed before seeking
        if (isSafari() && duration === 0) {
            initializeSafariIfNeeded().then(() => {
                // After initialization, try to seek again
                setTimeout(() => {
                    if (video) {
                        video.currentTime = time;
                        setCurrentTime(time);
                    }
                }, 100);
            });
            return;
        }

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

                // Renumber all segments to ensure proper chronological naming
                const renumberedSegments = renumberAllSegments(e.detail.segments);

                // Update segment state immediately for UI feedback
                setClipSegments(renumberedSegments);

                // Always save state to history for non-intermediate actions
                if (isSignificantChange) {
                    // A slight delay helps avoid race conditions but we need to
                    // ensure we capture the state properly
                    setTimeout(() => {
                        // Deep clone to ensure state is captured correctly
                        const segmentsClone = JSON.parse(JSON.stringify(renumberedSegments));

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

                const firstHalf: Segment = {
                    id: Date.now(),
                    chapterTitle: '', // Temporary title, will be set by renumberAllSegments
                    startTime: segmentToSplit.startTime,
                    endTime: timeToSplit,
                };

                const secondHalf: Segment = {
                    id: Date.now() + 1,
                    chapterTitle: '', // Temporary title, will be set by renumberAllSegments
                    startTime: timeToSplit,
                    endTime: segmentToSplit.endTime,
                };

                // Add the new segments
                newSegments.push(firstHalf, secondHalf);

                // Renumber all segments to ensure proper chronological naming
                const renumberedSegments = renumberAllSegments(newSegments);

                // Update state
                setClipSegments(renumberedSegments);
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
                    if (newSegments.length === 0) {
                        // Allow empty state - no segments
                        setClipSegments([]);
                        // Reset the trim points as well
                        setTrimStart(0);
                        setTrimEnd(videoRef.current?.duration || 0);
                        setSplitPoints([]);
                    } else {
                        // Renumber remaining segments to ensure proper chronological naming
                        const renumberedSegments = renumberAllSegments(newSegments);
                        setClipSegments(renumberedSegments);
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
                    newSegments.push({
                        id: Date.now() + i,
                        chapterTitle: `Chapter ${i + 1}`,
                        startTime,
                        endTime,
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

        // Reset to empty state - no default segment
        setClipSegments([]);
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

            // Trigger auto-save by dispatching a custom event
            setTimeout(() => {
                const event = new CustomEvent('undo-redo-autosave');
                document.dispatchEvent(event);
            }, 10);
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

            // Trigger auto-save by dispatching a custom event
            setTimeout(() => {
                const event = new CustomEvent('undo-redo-autosave');
                document.dispatchEvent(event);
            }, 10);
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

    // Handle updating a specific segment
    const handleSegmentUpdate = (segmentId: number, updates: Partial<Segment>) => {
        setClipSegments((prevSegments) =>
            prevSegments.map((segment) => (segment.id === segmentId ? { ...segment, ...updates } : segment))
        );
        setHasUnsavedChanges(true);
    };

    // Handle saving chapters to database
    const handleChapterSave = async (chapters: { chapterTitle: string; from: string; to: string }[]) => {
        try {
            // Get media ID from window.MEDIA_DATA
            const mediaId = (window as any).MEDIA_DATA?.mediaId;
            if (!mediaId) {
                console.error('No media ID found');
                return;
            }

            // Convert chapters to backend expected format and sort by start time
            let backendChapters = chapters
                .map((chapter) => ({
                    startTime: chapter.from,
                    endTime: chapter.to,
                    chapterTitle: chapter.chapterTitle,
                }))
                .sort((a, b) => {
                    // Parse time strings to seconds for proper comparison
                    const aStartSeconds = parseTimeToSeconds(a.startTime);
                    const bStartSeconds = parseTimeToSeconds(b.startTime);
                    return aStartSeconds - bStartSeconds;
                });

            // If there's only one chapter that spans the full video duration, send empty array
            if (backendChapters.length === 1) {
                const singleChapter = backendChapters[0];
                const startSeconds = parseTimeToSeconds(singleChapter.startTime);
                const endSeconds = parseTimeToSeconds(singleChapter.endTime);

                // Check if this single chapter spans the entire video (within 0.1 second tolerance)
                const isFullVideoChapter = startSeconds <= 0.1 && Math.abs(endSeconds - duration) <= 0.1;

                if (isFullVideoChapter) {
                    logger.debug('Manual save: Single chapter spans full video - sending empty array');
                    backendChapters = [];
                }
            }

            // Create the API request body
            const requestData = {
                chapters: backendChapters,
            };

            // Make API call to save chapters
            const csrfToken = getCsrfToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch(`/api/v1/media/${mediaId}/chapters`, {
                // TODO: Backend API is not ready yet
                method: 'POST',
                headers,
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                throw new Error(`Failed to save chapters: ${response.status}`);
            }

            const result = await response.json();

            // Mark as saved - no unsaved changes
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving chapters:', error);
            // You might want to show a user-friendly error message here
        }
    };

    // Helper function to get CSRF token
    const getCsrfToken = (): string => {
        const name = 'csrftoken';
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
        return '';
    };

    // Handle selected segment change
    const handleSelectedSegmentChange = (segmentId: number | null) => {
        setSelectedSegmentId(segmentId);
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

    // Handle play chapters
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
        trimStart,
        trimEnd,
        splitPoints,
        zoomLevel,
        clipSegments,
        selectedSegmentId,
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
        handleSegmentUpdate,
        handleChapterSave,
        handleSelectedSegmentChange,
        isMobile,
        videoInitialized,
        setVideoInitialized,
        initializeSafariIfNeeded, // Expose Safari initialization helper
    };
};

export default useVideoChapters;
