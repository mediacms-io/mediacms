import { formatDetailedTime } from './lib/timeUtils';
import logger from './lib/logger';
import VideoPlayer from '@/components/VideoPlayer';
import TimelineControls from '@/components/TimelineControls';
import EditingTools from '@/components/EditingTools';
import ClipSegments from '@/components/ClipSegments';
import MobilePlayPrompt from '@/components/IOSPlayPrompt';
import useVideoChapters from '@/hooks/useVideoChapters';

const App = () => {
    const {
        videoRef,
        currentTime,
        duration,
        isPlaying,
        setIsPlaying,
        isMuted,
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
        toggleMute,
        handleSegmentUpdate,
        handleChapterSave,
        handleSelectedSegmentChange,
        isMobile,
        videoInitialized,
        setVideoInitialized,
    } = useVideoChapters();

    const handlePlay = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;

        // If already playing, just pause the video
        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
            logger.debug('Video paused');
            return;
        }

        // Start playing - no boundary checking, play through entire timeline
        video
            .play()
            .then(() => {
                setIsPlaying(true);
                setVideoInitialized(true);
                logger.debug('Continuous playback started from:', formatDetailedTime(video.currentTime));
            })
            .catch((err) => {
                console.error('Error playing video:', err);
            });
    };

    return (
        <div className="bg-background min-h-screen">
            <MobilePlayPrompt videoRef={videoRef} onPlay={handlePlay} />

            <div className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Video Player */}
                <VideoPlayer
                    videoRef={videoRef}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    onPlayPause={handlePlay}
                    onSeek={handleMobileSafeSeek}
                    onToggleMute={toggleMute}
                />

                {/* Editing Tools */}
                <EditingTools
                    onSplit={handleSplit}
                    onReset={handleReset}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onPlay={handlePlay}
                    isPlaying={isPlaying}
                    canUndo={historyPosition > 0}
                    canRedo={historyPosition < history.length - 1}
                />

                {/* Timeline Controls */}
                <TimelineControls
                    currentTime={currentTime}
                    duration={duration}
                    thumbnails={[]}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    splitPoints={splitPoints}
                    zoomLevel={zoomLevel}
                    clipSegments={clipSegments}
                    selectedSegmentId={selectedSegmentId}
                    onSelectedSegmentChange={handleSelectedSegmentChange}
                    onSegmentUpdate={handleSegmentUpdate}
                    onChapterSave={handleChapterSave}
                    onTrimStartChange={handleTrimStartChange}
                    onTrimEndChange={handleTrimEndChange}
                    onZoomChange={handleZoomChange}
                    onSeek={handleMobileSafeSeek}
                    videoRef={videoRef}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isIOSUninitialized={isMobile && !videoInitialized}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    onPlayPause={handlePlay}
                />

                {/* Clip Segments */}
                <ClipSegments segments={clipSegments} selectedSegmentId={selectedSegmentId} />
            </div>
        </div>
    );
};

export default App;
