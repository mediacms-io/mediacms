import VideoPlayer from "@/components/VideoPlayer";
import TimelineControls from "@/components/TimelineControls";
import EditingTools from "@/components/EditingTools";
import ClipSegments from "@/components/ClipSegments";
import useVideoTrimmer from "@/hooks/useVideoTrimmer";

const App = () => {
  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isPreviewMode,
    isMuted,
    thumbnails,
    trimStart,
    trimEnd,
    splitPoints,
    zoomLevel,
    clipSegments,
    historyPosition,
    history,
    hasUnsavedChanges,
    playPauseVideo,
    seekVideo,
    handleTrimStartChange,
    handleTrimEndChange,
    handleSplit,
    handleReset,
    handleUndo,
    handleRedo,
    handlePreview,
    handlePlay,
    handleZoomChange,
    toggleMute,
    handleSave,
    handleSaveACopy,
    handleSaveSegments,
  } = useVideoTrimmer();

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-6xl">

        {/* Video Player */}
        <VideoPlayer 
          videoRef={videoRef}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          isMuted={isMuted}
          onPlayPause={playPauseVideo}
          onSeek={seekVideo}
          onToggleMute={toggleMute}
        />

        {/* Editing Tools */}
        <EditingTools 
          onSplit={handleSplit}
          onReset={handleReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPreview={handlePreview}
          onPlay={handlePlay}
          isPreviewMode={isPreviewMode}
          isPlaying={isPlaying}
          canUndo={historyPosition > 0}
          canRedo={historyPosition < history.length - 1}
        />

        {/* Timeline Controls */}
        <TimelineControls 
          currentTime={currentTime}
          duration={duration}
          thumbnails={thumbnails}
          trimStart={trimStart}
          trimEnd={trimEnd}
          splitPoints={splitPoints}
          zoomLevel={zoomLevel}
          clipSegments={clipSegments}
          onTrimStartChange={handleTrimStartChange}
          onTrimEndChange={handleTrimEndChange}
          onZoomChange={handleZoomChange}
          onSeek={seekVideo}
          videoRef={videoRef}
          onSave={handleSave}
          onSaveACopy={handleSaveACopy}
          onSaveSegments={handleSaveSegments}
          isPreviewMode={isPreviewMode}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Clip Segments */}
        <ClipSegments segments={clipSegments} />
      </div>
    </div>
  );
};

export default App;
