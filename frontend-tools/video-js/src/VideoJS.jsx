import React from 'react';
import { VideoJSPlayer } from './components';

function VideoJS({ videoId = 'default-video', ...props }) {
    return <VideoJSPlayer videoId={videoId} {...props} />;
}

export default VideoJS;
