import React from 'react';
import { VideoJSPlayerNew } from './components';

function VideoJSNew({ videoId = 'default-video', ...props }) {
    return <VideoJSPlayerNew videoId={videoId} {...props} />;
}

export default VideoJSNew;
