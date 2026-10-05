import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css';


function disableEval(params) {
  return { ...params, isEvalSupported: false };
}

export default function PdfViewer({ fileUrl }) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  return (
    <div className='pdf-container'>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} transformGetDocumentParams={disableEval} />
        </Worker>
      </div>
  );
}
