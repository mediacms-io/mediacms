import React from 'react';
import ImageViewer from '../components/media-viewer/ImageViewer';
import { _MediaPage } from './_MediaPage';

export class MediaImagePage extends _MediaPage {
  viewerContainerContent() {
    return <ImageViewer />;
  }

  mediaType() {
    return 'image';
  }
}
