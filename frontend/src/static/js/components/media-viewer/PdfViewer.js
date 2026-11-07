import React from 'react';
import { translateString } from '../../utils/helpers/';

function browserRendersPdfInline() {
  return 'undefined' === typeof navigator || false !== navigator.pdfViewerEnabled;
}

export default function PdfViewer({ fileUrl }) {
  if (!browserRendersPdfInline()) {
    return (
      <div className="pdf-container pdf-container-fallback">
        <a className="pdf-open-link" href={fileUrl} target="_blank" rel="noopener noreferrer">
          {translateString('Open PDF')}
        </a>
      </div>
    );
  }

  return (
    <div className="pdf-container">
      <iframe src={fileUrl} title="PDF" />
    </div>
  );
}
