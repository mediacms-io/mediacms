import { useRef, useEffect, useState } from "react";
import { formatTime, formatDetailedTime } from "../lib/timeUtils";
import { generateThumbnail, generateSolidColor } from "../lib/videoUtils";
import { Segment } from "./ClipSegments";
import Modal from "./Modal";
import { trimVideo } from "../services/videoApi";
import '../styles/TimelineControls.css';
import '../styles/TwoRowTooltip.css';

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
  isPreviewMode?: boolean;
}

// Function to calculate and constrain tooltip position to keep it on screen
const constrainTooltipPosition = (positionPercent: number) => {
  // Default position logic (centered)
  let leftValue = `${positionPercent}%`;
  let transform = 'translateX(-50%)';
  
  // Near left edge (first 17%)
  if (positionPercent < 17) {
    // Position the left edge of tooltip at 0%, no transform
    leftValue = '0%';
    transform = 'none';
  }
  // Near right edge (last 17%) 
  else if (positionPercent > 83) {
    // Position the right edge of tooltip at 100%
    leftValue = '100%';
    transform = 'translateX(-100%)';
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
  isPreviewMode
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

  // Reference for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Helper function for time adjustment buttons to maintain playback state
  const handleTimeAdjustment = (offsetSeconds: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Calculate new time based on offset (positive or negative)
    const newTime = offsetSeconds < 0
      ? Math.max(0, clickedTime + offsetSeconds) // For negative offsets (going back)
      : Math.min(duration, clickedTime + offsetSeconds); // For positive offsets (going forward)
    
    // Save the current playing state before seeking
    const wasPlaying = isPlayingSegment;
    
    // Seek to the new time
    onSeek(newTime);
    setClickedTime(newTime);
    
    // Resume playback if it was playing before
    if (wasPlaying && videoRef.current) {
      videoRef.current.play();
      setIsPlayingSegment(true);
    }
  };
  
  // Modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showSaveSegmentsModal, setShowSaveSegmentsModal] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  
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

    try {
      // Format segments data for API request
      const segments = clipSegments.map(segment => ({
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime)
      }));

      const mediaId = typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId || null;
      const response = await trimVideo(mediaId, { 
        segments,
        saveAsCopy: false
      });

      // Hide processing modal
      setShowProcessingModal(false);
      
      // Store success message and redirect URL
      setSuccessMessage(response.msg);
      setRedirectUrl(response.url_redirect);
      
      // Show success modal
      setShowSuccessModal(true);

    } catch (error) {
      console.error("Error processing video:", error);
      setShowProcessingModal(false);
    }
  };

  const handleSaveAsCopyConfirm = async () => {
    // Close confirmation modal and show processing modal
    setShowSaveAsModal(false);
    setShowProcessingModal(true);

    try {
      // Format segments data for API request
      const segments = clipSegments.map(segment => ({
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime)
      }));

      const mediaId = typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId || null;

      const response = await trimVideo(mediaId, { 
        segments,
        saveAsCopy: true
      });

      // Hide processing modal
      setShowProcessingModal(false);
      
      // Store success message and redirect URL
      setSuccessMessage(response.msg);
      setRedirectUrl(response.url_redirect);
      
      // Show success modal
      setShowSuccessModal(true);

    } catch (error) {
      console.error("Error processing video:", error);
      setShowProcessingModal(false);
    }
  };
  
  const handleSaveSegmentsConfirm = async () => {
    // Close confirmation modal and show processing modal
    setShowSaveSegmentsModal(false);
    setShowProcessingModal(true);

    try {
      // Format segments data for API request, with each segment saved as a separate file
      const segments = clipSegments.map(segment => ({
        startTime: formatDetailedTime(segment.startTime),
        endTime: formatDetailedTime(segment.endTime),
        name: segment.name // Include segment name for individual files
      }));

      const mediaId = typeof window !== 'undefined' && (window as any).MEDIA_DATA?.mediaId || null;

      const response = await trimVideo(mediaId, { 
        segments,
        saveAsCopy: true,
        saveIndividualSegments: true 
      });

      // Hide processing modal
      setShowProcessingModal(false);
      
      // Store success message and redirect URL
      setSuccessMessage("Segments have been saved as individual files.");
      setRedirectUrl(response.url_redirect);
      
      // Show success modal
      setShowSuccessModal(true);

    } catch (error) {
      // Handle errors
      console.error("Error processing video segments:", error);
      setShowProcessingModal(false);
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
        behavior: 'smooth'
      });
      
      // Update tooltip position to stay with the marker
      const rect = timelineRef.current.getBoundingClientRect();
      
      // Calculate the visible position of the marker after scrolling
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
      const markerX = visibleTimelineLeft + (currentTimePercent / 100 * rect.width);
      
      // Only update if we have a tooltip showing
      if (selectedSegmentId !== null || showEmptySpaceTooltip) {
        setTooltipPosition({
          x: markerX,
          y: rect.top - 10
        });
        setClickedTime(currentTime);
      }
    }
  }, [currentTime, zoomLevel, duration, selectedSegmentId, showEmptySpaceTooltip, currentTimePercent]);
  
  // Update display time and check for segment playback bounds
  useEffect(() => {
    // Always update display time to match current video time when playing
    if (videoRef.current) {
      // Keep isPlayingSegment in sync with actual video playback state
      if (!videoRef.current.paused && selectedSegmentId !== null) {
        setIsPlayingSegment(true);
        setDisplayTime(currentTime);
      } else if (videoRef.current.paused && isPlayingSegment) {
        setIsPlayingSegment(false);
      }
      
      // Check for segment bounds when playing a specific segment
      if (isPlayingSegment && activeSegment) {
        // Check if we've reached the end of the segment
        if (currentTime >= activeSegment.endTime) {
          // Pause the video
          videoRef.current.pause();
          setIsPlayingSegment(false);
          setActiveSegment(null);
        }
      } else if (videoRef.current.paused) {
        // When not playing, display time should match clicked time
        setDisplayTime(clickedTime);
      }
    }
  }, [currentTime, isPlayingSegment, activeSegment, clickedTime, selectedSegmentId]);
  
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
  
  // Global click handler to close tooltips when clicking outside
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Close tooltips when clicking outside of tooltips and timeline marker head
      if ((selectedSegmentId !== null || showEmptySpaceTooltip) && 
          !target.closest('.empty-space-tooltip') && 
          !target.closest('.segment-tooltip') && 
          !target.closest('.timeline-marker-head') && 
          !target.closest('.clip-segment') && 
          !target.closest('.timeline-container')) {
        // Reset play state when closing tooltip
        if (isPlayingSegment) {
          setIsPlayingSegment(false);
          setActiveSegment(null);
        }
        setSelectedSegmentId(null);
        setShowEmptySpaceTooltip(false);
      }
    };
    
    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
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
          detail: { type, isStart: isLeft }
        });
      };
      
      // Dispatch start drag event to signal not to record history during drag
      document.dispatchEvent(createCustomEvent('drag-start'));
      
      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;
        
        const timelineWidth = timelineRect.width;
        const position = Math.max(0, Math.min(1, (moveEvent.clientX - timelineRect.left) / timelineWidth));
        const newTime = position * duration;
        
        if (isLeft) {
          if (newTime < trimEnd) {
            // Don't record in history during drag - this avoids multiple history entries
            document.dispatchEvent(new CustomEvent('update-trim', {
              detail: { time: newTime, isStart: true, recordHistory: false }
            }));
            finalTime = newTime;
          }
        } else {
          if (newTime > trimStart) {
            // Don't record in history during drag - this avoids multiple history entries
            document.dispatchEvent(new CustomEvent('update-trim', {
              detail: { time: newTime, isStart: false, recordHistory: false }
            }));
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
          document.dispatchEvent(new CustomEvent('update-trim', {
            detail: {
              time: finalTime,
              isStart: true,
              recordHistory: true,
              action: 'adjust_trim_start'
            }
          }));
        } else {
          document.dispatchEvent(new CustomEvent('update-trim', {
            detail: {
              time: finalTime,
              isStart: false,
              recordHistory: true,
              action: 'adjust_trim_end'
            }
          }));
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
      return (
        <div 
          key={index}
          className="split-point"
          style={{ left: `${pointPercent}%` }}
        ></div>
      );
    });
  };

  // Helper function to calculate available space for a new segment
  const calculateAvailableSpace = (startTime: number): number => {
    // Determine the amount of available space:
    // 1. Check remaining space until the end of video
    const remainingDuration = Math.max(0, duration - startTime);
    
    // 2. Find the next segment (if any)
    const sortedSegments = [...clipSegments].sort((a, b) => a.startTime - b.startTime);
    const nextSegment = sortedSegments.find(seg => seg.startTime > startTime);
    
    if (nextSegment) {
      // Space available until the next segment starts
      const spaceUntilNextSegment = Math.max(0, nextSegment.startTime - startTime);
      return Math.min(30, spaceUntilNextSegment); // Take either 30s or available space, whichever is smaller
    } else {
      // No next segment, just limited by video duration
      return Math.min(30, remainingDuration);
    }
  };

  // Handle timeline click to seek and show a tooltip
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !scrollContainerRef.current) return;
    
    // Check if video is globally playing before the click
    const wasPlaying = videoRef.current && !videoRef.current.paused;
    console.log("Video was playing before timeline click:", wasPlaying);
    
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
    
    // Seek to the clicked position immediately for all clicks
    onSeek(newTime);
    
    // Always update the clicked time for tooltip actions
    setClickedTime(newTime);
    
    // Find if we clicked in a segment
    const segmentAtClickedTime = clipSegments.find(
      seg => newTime >= seg.startTime && newTime <= seg.endTime
    );
    
    // Handle active segment assignment for boundary checking
    if (segmentAtClickedTime) {
      setActiveSegment(segmentAtClickedTime);
    }
    
    // Resume playback in two cases:
    // 1. If it was playing before (regular playback)
    // 2. If we're in preview mode (regardless of previous playing state)
    if ((wasPlaying || isPreviewMode) && videoRef.current) {      
      videoRef.current.play()
        .then(() => {
          setIsPlayingSegment(true);
          console.log("Resumed playback after seeking");
        })
        .catch(err => {
          console.error("Error resuming playback:", err);
          setIsPlayingSegment(false);
        });
      console.log("Resuming playback after timeline click");
    }
    
    // Only process tooltip display if clicked on the timeline background or thumbnails, not on other UI elements
    if (e.target === timelineRef.current || (e.target as HTMLElement).classList.contains('timeline-thumbnail')) {
      // Check if there's a segment at the clicked position
      const segmentAtClickedTime = clipSegments.find(
        seg => newTime >= seg.startTime && newTime <= seg.endTime
      );
      
      // If there's a segment, show its tooltip instead of the empty space tooltip
      if (segmentAtClickedTime) {
        setSelectedSegmentId(segmentAtClickedTime.id);
        setShowEmptySpaceTooltip(false);
      } else {
        // First, close segment tooltip if open
        setSelectedSegmentId(null);
        
        // Calculate the available space for a new segment
        const availableSpace = calculateAvailableSpace(newTime);
        setAvailableSegmentDuration(availableSpace);
        
        // If there's no space to create even a minimal segment (at least 0.5 seconds), don't show the tooltip
        if (availableSpace < 0.5) {
          setShowEmptySpaceTooltip(false);
          return;
        }
        
        // Calculate and set tooltip position correctly for zoomed timeline
        let xPos;
        if (zoomLevel > 1) {
          // For zoomed timeline, calculate the visible position
          const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
          const clickPosPercent = newTime / duration;
          xPos = visibleTimelineLeft + (clickPosPercent * rect.width);
        } else {
          // For 1x zoom, use the client X
          xPos = e.clientX;
        }
        
        setTooltipPosition({ 
          x: xPos, 
          y: rect.top - 10  // Position tooltip above the timeline
        });
        
        // Show the empty space tooltip
        setShowEmptySpaceTooltip(true);
        
        // Close tooltip when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          
          // This is now handled by the global document click handler - just remove this listener
          document.removeEventListener('mousedown', handleClickOutside);
        };
        
        document.addEventListener('mousedown', handleClickOutside);
      }
    }
  };
  
  // Handle segment resize
  const handleSegmentResize = (segmentId: number, isLeft: boolean) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering parent's onMouseDown
    
    if (!timelineRef.current) return;
    
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const timelineWidth = timelineRect.width;
    
    // Find the segment that's being resized
    const segment = clipSegments.find(seg => seg.id === segmentId);
    if (!segment) return;
    
    const originalStartTime = segment.startTime;
    const originalEndTime = segment.endTime;
    
    // Add a visual indicator that we're in resize mode
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
    document.dispatchEvent(new CustomEvent('segment-drag-start', {
      detail: { segmentId }
    }));
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      
      const position = Math.max(0, Math.min(1, (moveEvent.clientX - timelineRect.left) / timelineWidth));
      const newTime = position * duration;
      
      // Find neighboring segments (exclude the current one)
      const otherSegments = clipSegments.filter(seg => seg.id !== segmentId);
      
      // Calculate new start/end times based on drag direction
      let newStartTime = originalStartTime;
      let newEndTime = originalEndTime;
      
      if (isLeft) {
        // Dragging left handle - adjust start time
        newStartTime = Math.min(newTime, originalEndTime - 0.5);
        
        // Find the closest left neighbor
        const leftNeighbors = otherSegments
          .filter(seg => seg.endTime <= originalStartTime)
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
          .filter(seg => seg.startTime >= originalEndTime)
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
      const updatedSegments = clipSegments.map(seg => {
        if (seg.id === segmentId) {
          return {
            ...seg,
            startTime: newStartTime,
            endTime: newEndTime
          };
        }
        return seg;
      });
      
      // Create a custom event to update the segments WITHOUT recording in history during drag
      const updateEvent = new CustomEvent('update-segments', { 
        detail: { 
          segments: updatedSegments,
          recordHistory: false // Don't record intermediate states
        } 
      });
      document.dispatchEvent(updateEvent);
    };
    
    const handleMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.removeChild(overlay);
      
      // Record the final position in history as a single action
      const finalSegments = clipSegments.map(seg => {
        if (seg.id === segmentId) {
          return {
            ...seg,
            startTime: finalStartTime,
            endTime: finalEndTime
          };
        }
        return seg;
      });
      
      // Now we can create a history record for the complete drag operation
      const actionType = isLeft ? 'adjust_segment_start' : 'adjust_segment_end';
      document.dispatchEvent(new CustomEvent('update-segments', { 
        detail: { 
          segments: finalSegments,
          recordHistory: true,
          action: actionType
        } 
      }));
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle segment click to show the tooltip
  const handleSegmentClick = (segmentId: number) => (e: React.MouseEvent) => {
    // Don't show tooltip if clicked on handle
    if ((e.target as HTMLElement).classList.contains('clip-segment-handle')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Segment clicked:", segmentId);
    
    // Check if video is currently playing before clicking
    const wasPlaying = videoRef.current && !videoRef.current.paused;
    console.log("seekVideo: Was playing before:", wasPlaying);
    
    // Set the current segment as selected
    setSelectedSegmentId(segmentId);
    
    // Find the segment in our data
    const segment = clipSegments.find(seg => seg.id === segmentId);
    if (!segment) return;
    
    // Find the segment element in the DOM
    const segmentElement = e.currentTarget as HTMLElement;
    const segmentRect = segmentElement.getBoundingClientRect();
    
    // Calculate relative click position within the segment (0 to 1)
    const relativeX = (e.clientX - segmentRect.left) / segmentRect.width;
    
    // Convert to time based on segment's start and end times
    const clickTime = segment.startTime + (relativeX * (segment.endTime - segment.startTime));
    
    // Ensure time is within segment bounds
    const boundedTime = Math.max(segment.startTime, Math.min(segment.endTime, clickTime));
    
    // Set the clicked time for UI
    setClickedTime(boundedTime);
    
    // Seek to this position (this will update the video's current time)
    onSeek(boundedTime);
    
    // If video was playing before or we're in preview mode, ensure it continues playing
    if (wasPlaying && videoRef.current) {
      // Set current segment as active segment for boundary checking
      setActiveSegment(segment);
      // Continue playing from the new position
      videoRef.current.play()
        .then(() => {
          setIsPlayingSegment(true);
        })
        .catch(err => {
          console.error("Error resuming playback after segment click:", err);
        });
    }
    
    // Always continue playback in preview mode, even if video was paused when clicking
    if (isPreviewMode && videoRef.current) {
      setActiveSegment(segment);
      videoRef.current.play()
        .then(() => {
          setIsPlayingSegment(true);
          console.log("Continued preview playback after segment click");
        })
        .catch(err => {
          console.error("Error continuing preview playback:", err);
        });
    }
    
    // Calculate tooltip position directly above click point
    const tooltipX = e.clientX;
    const tooltipY = segmentRect.top - 10;
    
    setTooltipPosition({
      x: tooltipX,
      y: tooltipY
    });
    
    // Auto-scroll to center the clicked position for zoomed timeline
    if (zoomLevel > 1 && timelineRef.current && scrollContainerRef.current) {
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const timelineWidth = timelineRef.current.clientWidth;
      const containerWidth = scrollContainerRef.current.clientWidth;
      
      // Calculate pixel position of clicked time
      const clickedPosPixel = (boundedTime / duration) * timelineWidth;
      
      // Center the view on the clicked position
      const targetScrollLeft = Math.max(0, clickedPosPixel - (containerWidth / 2));
      
      // Smooth scroll to the clicked point
      scrollContainerRef.current.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
      
      // Update tooltip position after scrolling completes
      setTimeout(() => {
        if (timelineRef.current && scrollContainerRef.current) {
          // Calculate new position based on viewport
          const updatedRect = timelineRef.current.getBoundingClientRect();
          const timePercent = boundedTime / duration;
          const newPosition = (timePercent * timelineWidth) - scrollContainerRef.current.scrollLeft + updatedRect.left;
          
          setTooltipPosition({
            x: newPosition,
            y: tooltipY
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
      const backgroundColor = generateSolidColor(
        (segment.startTime + segment.endTime) / 2, 
        duration
      );
      
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
            borderColor: 'rgba(0, 0, 0, 0.5)' // Darker border for better visibility
          }}
          onClick={handleSegmentClick(segment.id)}
        >
          <div className="clip-segment-info">
            <div className="clip-segment-name">Segment {index + 1}</div>
            <div className="clip-segment-time">{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</div>
            <div className="clip-segment-duration">Duration: {formatTime(segment.endTime - segment.startTime)}</div>
          </div>
          
          {/* Resize handles */}
          <div 
            className="clip-segment-handle left"
            title="Resize segment start"
            onMouseDown={(e) => {
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
          ></div>
        </div>
      );
    });
  };

  return (
    <div className="timeline-container-card">
      {/* Current Timecode with Milliseconds */}
      <div className="timeline-header">
        <div className="timeline-title">
          <span className="timeline-title-text">Timeline</span>
        </div>
        {/* Current time display removed as requested */}
        <div className="duration-time">
          Total Segments: <span>{formatDetailedTime(clipSegments.reduce((sum, segment) => sum + (segment.endTime - segment.startTime), 0))}</span>
        </div>
      </div>
      
      {/* Timeline Container with Scrollable Wrapper */}
      <div 
        ref={scrollContainerRef} 
        className="timeline-scroll-container" 
        style={{ 
          overflow: zoomLevel > 1 ? 'auto' : 'hidden'
        }}>
        <div 
          ref={timelineRef}
          className="timeline-container"
          onClick={handleTimelineClick}
          style={{ 
            width: `${zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`}`
          }}
        >
          {/* Current Position Marker */}
          <div 
            className="timeline-marker"
            style={{ left: `${currentTimePercent}%` }}
          >
            <div 
              className="timeline-marker-head"
              onClick={(e) => {
                // Prevent event propagation to avoid triggering the timeline container click
                e.stopPropagation();
                
                // For ensuring accurate segment detection, refresh clipSegments first
                // This helps when clicking right after creating a new segment
                const refreshedSegmentAtCurrentTime = clipSegments.find(
                  seg => currentTime >= seg.startTime && currentTime <= seg.endTime
                );
                
                // Toggle tooltip visibility with a single click
                if (selectedSegmentId || showEmptySpaceTooltip) {
                  // When tooltip is open and - icon is clicked, simply close the tooltips
                  console.log("Closing tooltip");
                  setSelectedSegmentId(null);
                  setShowEmptySpaceTooltip(false);
                  // Don't reopen the tooltip - just leave it closed
                  return;
                } else {
                  // Get segment at current time - ensure precise matching within segment boundaries
                  // We need to be extra careful with floating point comparisons
                  const segmentAtCurrentTime = clipSegments.find(seg => {
                    const isWithinSegment = currentTime >= seg.startTime && currentTime <= seg.endTime;
                    const isAtExactStart = Math.abs(currentTime - seg.startTime) < 0.001; // Within 1ms of start
                    const isAtExactEnd = Math.abs(currentTime - seg.endTime) < 0.001; // Within 1ms of end
                    return isWithinSegment || isAtExactStart || isAtExactEnd;
                  });
                  
                  // Log detection of segments at marker (for debugging)
                  console.log("Checking for segment at marker:", segmentAtCurrentTime ? 
                    `Found segment ${segmentAtCurrentTime.id}` : "No segment found");
                  
                  // Show the appropriate tooltip
                  if (segmentAtCurrentTime) {
                    // Show segment tooltip
                    setSelectedSegmentId(segmentAtCurrentTime.id);
                  } else {
                    // Calculate available space for new segment before showing tooltip
                    const availableSpace = calculateAvailableSpace(currentTime);
                    setAvailableSegmentDuration(availableSpace);
                    
                    // Only show tooltip if there's enough space for a minimal segment
                    if (availableSpace >= 0.5) {
                      // Show empty space tooltip
                      setShowEmptySpaceTooltip(true);
                    }
                  }
                }
              }}
            >
              <span className="timeline-marker-head-icon">
                {selectedSegmentId || showEmptySpaceTooltip ? '-' : '+'}
              </span>
            </div>
          </div>
          
          {/* Trim Line Markers - hidden when segments exist */}
          {clipSegments.length === 0 && (
            <>
              <div 
                className="trim-line-marker"
                style={{ left: `${trimStartPercent}%` }}
              >
                <div ref={leftHandleRef} className="trim-handle left"></div>
              </div>
              <div 
                className="trim-line-marker"
                style={{ left: `${trimEndPercent}%` }}
              >
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
              className="segment-tooltip two-row-tooltip"
              style={{
                position: 'absolute',
                ...constrainTooltipPosition(currentTimePercent)
              }}
            >
              {/* First row with time adjustment buttons */}
              <div className="tooltip-row">
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Decrease by 100ms"
                  onClick={handleTimeAdjustment(-0.1)}
                >
                  -100ms
                </button>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Decrease by 50ms"
                  onClick={handleTimeAdjustment(-0.05)}
                >
                  -50ms
                </button>
                <div className="tooltip-time-display">{formatDetailedTime(displayTime)}</div>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Increase by 50ms"
                  onClick={handleTimeAdjustment(0.05)}
                >
                  +50ms
                </button>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Increase by 100ms"
                  onClick={handleTimeAdjustment(0.1)}
                >
                  +100ms
                </button>
              </div>
              
              {/* Second row with action buttons */}
              <div className="tooltip-row tooltip-actions">
                <button 
                  className="tooltip-action-btn delete"
                  data-tooltip="Delete segment"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Call the delete segment function with the current segment ID
                    const deleteEvent = new CustomEvent('delete-segment', { 
                      detail: { 
                        segmentId: selectedSegmentId
                      } 
                    });
                    document.dispatchEvent(deleteEvent);
                    // Keep the tooltip open (we're removing this line)
                    // setSelectedSegmentId(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <button 
                  className="tooltip-action-btn scissors"
                  data-tooltip="Split segment at current position"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Call the split segment function with the current segment ID and time
                    const splitEvent = new CustomEvent('split-segment', { 
                      detail: { 
                        segmentId: selectedSegmentId,
                        time: clickedTime 
                      } 
                    });
                    document.dispatchEvent(splitEvent);
                    // Keep the tooltip open
                    // setSelectedSegmentId(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="14.47" y1="14.48" x2="20" y2="20" />
                    <line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                </button>
                <button 
                  className="tooltip-action-btn play-from-start"
                  data-tooltip="Play segment from beginning"
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Find the selected segment
                    const segment = clipSegments.find(seg => seg.id === selectedSegmentId);
                    if (segment && videoRef.current) {
                      // Seek to the start of the segment
                      onSeek(segment.startTime);
                      setClickedTime(segment.startTime);
                      
                      // Set active segment for boundary checking before playing
                      setActiveSegment(segment);
                      
                      // Start playing from the beginning of the segment with proper promise handling
                      videoRef.current.play()
                        .then(() => {
                          setIsPlayingSegment(true);
                          console.log("Playing from beginning of segment");
                        })
                        .catch(err => {
                          console.error("Error playing from beginning:", err);
                        });
                    }
                    
                    // Don't close the tooltip
                  }}
                >
                  <span style={{fontSize: '18px', lineHeight: '1'}}>⏮</span>
                </button>
                <button 
                  className={`tooltip-action-btn ${isPlayingSegment ? 'pause' : 'play'}`}
                  data-tooltip={isPlayingSegment ? "Pause playback" : "Play from current position"}
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Find the selected segment
                    const segment = clipSegments.find(seg => seg.id === selectedSegmentId);
                    if (segment && videoRef.current) {
                      if (isPlayingSegment) {
                        // If already playing, pause the video
                        videoRef.current.pause();
                        setIsPlayingSegment(false);
                        console.log("Pause clicked");
                      } else {
                        // Keep current position (red line) and just start playing
                        // Set active segment for boundary checking
                        setActiveSegment(segment);
                        
                        // Play the video from the current position
                        videoRef.current.play()
                          .then(() => {
                            setIsPlayingSegment(true);
                            console.log("Play clicked");
                          })
                          .catch(err => {
                            console.error("Error starting playback:", err);
                          });
                      }
                    }
                    
                    // Don't close the tooltip, keep it visible while playing
                  }}
                >
                  <span style={{fontSize: '18px', lineHeight: '1'}}>
                    {isPlayingSegment ? '⏸' : '▶'}
                  </span>
                </button>
                <button 
                  className="tooltip-action-btn set-in"
                  data-tooltip="Set start point at current position"
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Find the selected segment and update its start time
                    const segment = clipSegments.find(seg => seg.id === selectedSegmentId);
                    if (segment) {
                      // Create updated segments with new start time for selected segment
                      const updatedSegments = clipSegments.map(seg => {
                        if (seg.id === selectedSegmentId) {
                          return {
                            ...seg,
                            startTime: clickedTime < seg.endTime - 0.5 ? clickedTime : seg.endTime - 0.5
                          };
                        }
                        return seg;
                      });
                      
                      // Create and dispatch the update event
                      const updateEvent = new CustomEvent('update-segments', { 
                        detail: { 
                          segments: updatedSegments,
                          recordHistory: true, // Ensure this specific action is recorded in history
                          action: 'adjust_start_time'
                        } 
                      });
                      document.dispatchEvent(updateEvent);
                      console.log("Set in clicked");
                    }
                    
                    // Keep tooltip open
                    // setSelectedSegmentId(null);
                  }}
                >
                  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    {/* Hand pointing right for setting start point */}
                    <g transform="translate(50, 80) scale(0.95) rotate(35, 192, 256)">
                      <path d="M91.826 467.2V317.966c-8.248 5.841-16.558 10.57-24.918 14.153C35.098 345.752-.014 322.222 0 288c.008-18.616 10.897-32.203 29.092-40 28.286-12.122 64.329-78.648 77.323-107.534 7.956-17.857 25.479-28.453 43.845-28.464l.001-.002h171.526c11.812 0 21.897 8.596 23.703 20.269 7.25 46.837 38.483 61.76 38.315 123.731-.007 2.724.195 13.254.195 16 0 50.654-22.122 81.574-71.263 72.6-9.297 18.597-39.486 30.738-62.315 16.45-21.177 24.645-53.896 22.639-70.944 6.299V467.2c0 24.15-20.201 44.8-43.826 44.8-23.283 0-43.826-21.35-43.826-44.8zM112 72V24c0-13.255 10.745-24 24-24h192c13.255 0 24 10.745 24 24v48c0 13.255-10.745 24-24 24H136c-13.255 0-24-10.745-24-24zm212-24c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20z"/>
                    </g>
                  </svg>
                </button>
                <button 
                  className="tooltip-action-btn set-out"
                  data-tooltip="Set end point at current position"
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Find the selected segment and update its end time
                    const segment = clipSegments.find(seg => seg.id === selectedSegmentId);
                    if (segment) {
                      // Create updated segments with new end time for selected segment
                      const updatedSegments = clipSegments.map(seg => {
                        if (seg.id === selectedSegmentId) {
                          return {
                            ...seg,
                            endTime: clickedTime > seg.startTime + 0.5 ? clickedTime : seg.startTime + 0.5
                          };
                        }
                        return seg;
                      });
                      
                      // Create and dispatch the update event
                      const updateEvent = new CustomEvent('update-segments', { 
                        detail: { 
                          segments: updatedSegments,
                          recordHistory: true, // Ensure this specific action is recorded in history
                          action: 'adjust_end_time'
                        } 
                      });
                      document.dispatchEvent(updateEvent);
                      console.log("Set out clicked");
                    }
                    
                    // Keep the tooltip open
                    // setSelectedSegmentId(null);
                  }}
                >
                  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    {/* Hand pointing left for setting end point */}
                    <g transform="translate(50, 80) scale(0.95) rotate(-45,172, 256)">
                      <path d="M91.826 467.2V317.966c-8.248 5.841-16.558 10.57-24.918 14.153C35.098 345.752-.014 322.222 0 288c.008-18.616 10.897-32.203 29.092-40 28.286-12.122 64.329-78.648 77.323-107.534 7.956-17.857 25.479-28.453 43.845-28.464l.001-.002h171.526c11.812 0 21.897 8.596 23.703 20.269 7.25 46.837 38.483 61.76 38.315 123.731-.007 2.724.195 13.254.195 16 0 50.654-22.122 81.574-71.263 72.6-9.297 18.597-39.486 30.738-62.315 16.45-21.177 24.645-53.896 22.639-70.944 6.299V467.2c0 24.15-20.201 44.8-43.826 44.8-23.283 0-43.826-21.35-43.826-44.8zM112 72V24c0-13.255 10.745-24 24-24h192c13.255 0 24 10.745 24 24v48c0 13.255-10.745 24-24 24H136c-13.255 0-24-10.745-24-24zm212-24c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20z"/>
                    </g>
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Empty space tooltip - positioned absolutely within timeline container */}
          {showEmptySpaceTooltip && selectedSegmentId === null && (
            <div 
              className="empty-space-tooltip two-row-tooltip"
              style={{
                position: 'absolute',
                ...constrainTooltipPosition(currentTimePercent)
              }}
            >
              {/* First row with time adjustment buttons - same as segment tooltip */}
              <div className="tooltip-row">
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Decrease by 100ms"
                  onClick={handleTimeAdjustment(-0.1)}
                >
                  -100ms
                </button>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Decrease by 50ms"
                  onClick={handleTimeAdjustment(-0.05)}
                >
                  -50ms
                </button>
                <div className="tooltip-time-display">{formatDetailedTime(clickedTime)}</div>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Increase by 50ms"
                  onClick={handleTimeAdjustment(0.05)}
                >
                  +50ms
                </button>
                <button 
                  className="tooltip-time-btn"
                  data-tooltip="Increase by 100ms"
                  onClick={handleTimeAdjustment(0.1)}
                >
                  +100ms
                </button>
              </div>
              
              {/* Second row with New Segment button */}
              <div className="tooltip-row tooltip-actions">
                {availableSegmentDuration >= 0.5 && (
                  <button 
                    className="tooltip-action-btn new-segment"
                    data-tooltip={`Create new segment with available space`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      
                      // Create a new segment with the calculated available duration
                      const segmentStartTime = clickedTime;
                      const segmentEndTime = segmentStartTime + availableSegmentDuration;
                      
                      // Only create if we have at least 0.5 seconds of space
                      if (availableSegmentDuration < 0.5) {
                        // Not enough space, close tooltip
                        setShowEmptySpaceTooltip(false);
                        return;
                      }
                      
                      // Create the new segment with a generic name
                      const newSegment: Segment = {
                        id: Date.now(),
                        name: `segment`,
                        startTime: segmentStartTime,
                        endTime: segmentEndTime,
                        thumbnail: '' // Empty placeholder - we'll use dynamic colors instead
                      };
                      
                      // Add the new segment to existing segments
                      const updatedSegments = [...clipSegments, newSegment];
                      
                      // Create and dispatch the update event
                      const updateEvent = new CustomEvent('update-segments', { 
                        detail: { 
                          segments: updatedSegments,
                          recordHistory: true, // Explicitly record this action in history
                          action: 'create_segment'
                        } 
                      });
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
                          console.log("Created and selected new segment:", createdSegment.id);
                        }
                      }, 100); // Small delay to ensure state is updated
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span className="tooltip-btn-text">
                      New {Math.round(availableSegmentDuration)}s Segment
                    </span>
                  </button>
                )}
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
                  let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
                  
                  if (parts.length === 3) {
                    // Format: HH:MM:SS.ms
                    hours = parseInt(parts[0]);
                    minutes = parseInt(parts[1]);
                    const secParts = parts[2].split('.');
                    seconds = parseInt(secParts[0]);
                    if (secParts.length > 1) milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3));
                  } else if (parts.length === 2) {
                    // Format: MM:SS.ms
                    minutes = parseInt(parts[0]);
                    const secParts = parts[1].split('.');
                    seconds = parseInt(secParts[0]);
                    if (secParts.length > 1) milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3));
                  }
                  
                  const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
                  if (!isNaN(totalSeconds) && totalSeconds >= 0 && totalSeconds <= duration) {
                    onSeek(totalSeconds);
                    
                    // Create a helper function to show tooltip that uses the same logic as the millisecond buttons
                    const showTooltipAtTime = (timeInSeconds: number) => {
                      // Find the segment at the given time using improved matching
                      const segmentAtTime = clipSegments.find(seg => {
                        const isWithinSegment = timeInSeconds >= seg.startTime && timeInSeconds <= seg.endTime;
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
                          const visibleTimelineLeft = rect.left - scrollContainerRef.current.scrollLeft;
                          const markerVisibleX = visibleTimelineLeft + ((timeInSeconds / duration) * rect.width);
                          xPos = markerVisibleX;
                        } else {
                          // For non-zoomed timeline, use the simple calculation
                          const positionPercent = (timeInSeconds / duration);
                          xPos = rect.left + (rect.width * positionPercent);
                        }
                        
                        setTooltipPosition({ x: xPos, y: rect.top - 10 });
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
                  console.error("Invalid time format:", error);
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
                const segmentAtCurrentTime = clipSegments.find(seg => {
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
                    const markerVisibleX = visibleTimelineLeft + ((currentTime / duration) * rect.width);
                    xPos = markerVisibleX;
                  } else {
                    // For non-zoomed timeline, use the simple calculation
                    const positionPercent = (currentTime / duration);
                    xPos = rect.left + (rect.width * positionPercent);
                  }
                  
                  setTooltipPosition({ x: xPos, y: rect.top - 10 });
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
              <div className="zoom-dropdown" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }}>
                {[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096].map(level => (
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
          
          {/* Save Buttons */}
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
                  onClick={handleSaveConfirm}
                >
                  Confirm Save
                </button>
              </>
            }
          >
            <p className="modal-message">
              You're about to save these changes and replace the original video. This action cannot be undone.
            </p>
            <p className="modal-message">
              The original video will be replaced with this trimmed version.
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
                  onClick={handleSaveAsCopyConfirm}
                >
                  Confirm Save As Copy
                </button>
              </>
            }
          >
            <p className="modal-message">
              You're about to save these changes as a new copy. Your original video will remain unchanged.
            </p>
            <p className="modal-message">
              A new copy of the video will be created with your trimmed segments.
            </p>
          </Modal>
          
          {/* Processing Modal */}
          <Modal
            isOpen={showProcessingModal}
            onClose={() => {}}
            title="Processing Video"
          >
            <div className="modal-spinner">
              <div className="spinner"></div>
            </div>
            <p className="modal-message text-center">
              Please wait while your video is being processed...
            </p>
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
                  onClick={handleSaveSegmentsConfirm}
                >
                  Save Segments
                </button>
              </>
            }
          >
            <p className="modal-message">
              You're about to save each segment as a separate video file. 
              There are {clipSegments.length} segments to be saved.
            </p>
            <p className="modal-message">
              Each segment will be saved with its name as the filename.
            </p>
          </Modal>
          
          {/* Success Modal */}
          <Modal
            isOpen={showSuccessModal}
            onClose={() => setShowSuccessModal(false)}
            title="Video Processed Successfully"
          >
            <div className="modal-success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <p className="modal-message text-center">
              {successMessage}
            </p>
            <div className="modal-choices">
              {redirectUrl && (
                <a 
                  href={redirectUrl}
                  className="modal-choice-button centered-choice"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  View Processed Video
                </a>
              )}
            </div>
          </Modal>
          
          {/* Dropdown was moved inside the container element */}
        </div>
      </div>
    </div>
  );
};

export default TimelineControls;