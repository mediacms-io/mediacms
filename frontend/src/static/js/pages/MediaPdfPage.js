import React from 'react';
import PdfViewer from '../components/media-viewer/PdfViewer';
import { _MediaPage } from './_MediaPage';

export class MediaPdfPage extends _MediaPage {
  viewerContainerContent() {
    return <PdfViewer />;
  }
}
