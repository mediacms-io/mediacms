import React from 'react';
import { SiteConsumer } from '../utils/contexts/';
import { MediaPageStore } from '../utils/stores/';
import AttachmentViewer from '../components/media-viewer/AttachmentViewer';
import AudioViewer from '../components/media-viewer/AudioViewer';
import ImageViewer from '../components/media-viewer/ImageViewer';
import PdfViewer from '../components/media-viewer/PdfViewer';
import VideoViewer from '../components/media-viewer/VideoViewer';
import { _VideoMediaPage } from './_VideoMediaPage';

export class MediaPage extends _VideoMediaPage {
  viewerContainerContent(mediaData) {
    switch (MediaPageStore.get('media-type')) {
      case 'video':
        return (
          <SiteConsumer>{(site) => <VideoViewer data={mediaData} siteUrl={site.url} inEmbed={!1} />}</SiteConsumer>
        );
      case 'audio':
        return <AudioViewer />;
      case 'image':
        return <ImageViewer />;
      case 'pdf':
        return <PdfViewer />;
    }

    return <AttachmentViewer />;
  }
}
