import React from 'react';
import AudioViewer from '../components/media-viewer/AudioViewer';
import { _MediaPage } from './_MediaPage';

export class MediaAudioPage extends _MediaPage {
  viewerContainerContent() {
    return <AudioViewer />;
  }

  mediaType() {
    return 'audio';
  }
}
