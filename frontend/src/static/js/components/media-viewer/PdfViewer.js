import React from 'react';
import PDFViewer from 'pdf-viewer-reactjs'
import { SiteContext } from '../../utils/contexts/';
import { formatInnerLink } from '../../utils/helpers/';
import { MediaPageStore} from '../../utils/stores/';

export default function PdfViewer() {
  const mediaData = MediaPageStore.get('media-data');
  const pdfUrl = formatInnerLink(mediaData.original_media_url, SiteContext._currentValue.url);
  console.log('URL: ', mediaData);
  return (
    <div className='column has-text-centered' id='pdf_viewer'>
    <PDFViewer
      document={{
        url: pdfUrl,
      }}
      scale={1.5}
      scaleStep={0.5}
      maxScale={5}
      minScale={0.5}
      protectContent
      navbarOnTop={true}
    />
  </div>
  );
}
