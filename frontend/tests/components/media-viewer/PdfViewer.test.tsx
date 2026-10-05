import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import PdfViewer from '../../../src/static/js/components/media-viewer/PdfViewer';

const viewerProps: any[] = [];
const workerProps: any[] = [];

jest.mock('@react-pdf-viewer/core', () => ({
    Worker: (props: any) => {
        workerProps.push(props);
        return props.children;
    },
    Viewer: (props: any) => {
        viewerProps.push(props);
        return null;
    },
}));
jest.mock('@react-pdf-viewer/default-layout', () => ({ defaultLayoutPlugin: () => ({ name: 'default-layout' }) }));

describe('components/media-viewer/PdfViewer', () => {
    beforeEach(() => {
        viewerProps.length = 0;
        workerProps.length = 0;
    });

    test('Loads documents with eval disabled and keeps the other loading params', () => {
        const { unmount } = renderIntoContainer(<PdfViewer fileUrl="/media/original/doc.pdf" />);
        const { fileUrl, transformGetDocumentParams } = viewerProps[0];
        expect(fileUrl).toBe('/media/original/doc.pdf');
        expect(transformGetDocumentParams({ url: '/media/original/doc.pdf', isEvalSupported: true, withCredentials: false })).toEqual({
            url: '/media/original/doc.pdf',
            isEvalSupported: false,
            withCredentials: false,
        });
        unmount();
    });

    test('The worker comes from the same pdfjs-dist version the app bundles', () => {
        const pinned = require('../../../package.json').dependencies['pdfjs-dist'];
        const { unmount } = renderIntoContainer(<PdfViewer fileUrl="/doc.pdf" />);
        expect(workerProps[0].workerUrl).toBe(`https://unpkg.com/pdfjs-dist@${pinned}/build/pdf.worker.min.js`);
        unmount();
    });
});
