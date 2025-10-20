import React from 'react';
import { SiteConsumer } from '../utils/contexts/';
import VideoViewer from '../components/media-viewer/VideoViewer';
import { _VideoMediaPage } from './_VideoMediaPage';

export class MediaVideoPage extends _VideoMediaPage {
  viewerContainerContent(mediaData) {
    return <>Not working anymore?</>; // TODO: check this if this page not working anymore as MediaPage.js do the same work
    return <SiteConsumer>{(site) => <VideoViewer data={mediaData} siteUrl={site.url} inEmbed={!1} />}</SiteConsumer>;
  }

  mediaType() {
    return 'video';
  }
}
