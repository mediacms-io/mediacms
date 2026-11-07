import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import PdfViewer from '../../../src/static/js/components/media-viewer/PdfViewer';

describe('components/media-viewer/PdfViewer', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'pdfViewerEnabled');

    function setPdfViewerEnabled(value: boolean | undefined) {
        Object.defineProperty(window.navigator, 'pdfViewerEnabled', { value, configurable: true });
    }

    afterEach(() => {
        if (original) {
            Object.defineProperty(window.navigator, 'pdfViewerEnabled', original);
        } else {
            delete (window.navigator as any).pdfViewerEnabled;
        }
    });

    test('Embeds the file in the browser PDF viewer without an extra link', () => {
        setPdfViewerEnabled(true);
        const { container, unmount } = renderIntoContainer(<PdfViewer fileUrl="/media/original/doc.pdf" />);
        expect(container.querySelector('.pdf-container iframe')?.getAttribute('src')).toBe('/media/original/doc.pdf');
        expect(container.querySelector('a.pdf-open-link')).toBeNull();
        unmount();
    });

    test('Assumes inline rendering when the browser does not report support', () => {
        setPdfViewerEnabled(undefined);
        const { container, unmount } = renderIntoContainer(<PdfViewer fileUrl="/doc.pdf" />);
        expect(container.querySelector('iframe')).not.toBeNull();
        unmount();
    });

    test('Falls back to a link when the browser cannot render PDFs inline', () => {
        setPdfViewerEnabled(false);
        const { container, unmount } = renderIntoContainer(<PdfViewer fileUrl="/doc.pdf" />);
        expect(container.querySelector('iframe')).toBeNull();
        const link = container.querySelector('.pdf-container-fallback a.pdf-open-link');
        expect(link?.getAttribute('href')).toBe('/doc.pdf');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
        unmount();
    });
});
