import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { MediaPageStore } from '../../../src/static/js/utils/stores/';
import { OtherMediaDownloadLink } from '../../../src/static/js/components/media-actions/OtherMediaDownloadLink';
import { VideoMediaDownloadLink } from '../../../src/static/js/components/media-actions/VideoMediaDownloadLink';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const store = MediaPageStore as any;

describe('components/media-actions', () => {
    describe('OtherMediaDownloadLink', () => {
        test('Renders a download anchor', () => {
            const { container, unmount } = renderIntoContainer(<OtherMediaDownloadLink link="/media/file.pdf" title="file" />);
            const a = container.querySelector('.download a') as HTMLAnchorElement;
            expect(a.getAttribute('href')).toBe('/media/file.pdf');
            expect(a.getAttribute('download')).toBe('file');
            expect(a.target).toBe('_blank');
            expect(a.rel).toBe('noreferrer');
            expect(a.textContent).toBe('DOWNLOAD');
            unmount();
        });
    });

    describe('VideoMediaDownloadLink', () => {
        beforeEach(() => {
            store.__reset({
                'media-data': {
                    title: 'Clip',
                    size: '10MB',
                    original_media_url: '/media/original/clip.mp4',
                    encodings_info: {
                        '720': {
                            h264: { status: 'success', progress: 100, url: '/media/encoded/clip-720.mp4', title: 'h264-720', size: '5MB' },
                            vp9: { status: 'pending', progress: 50, url: null, title: 'vp9-720', size: '0' },
                        },
                        '480': {},
                        '360': {
                            h264: { status: 'success', progress: 100, url: '/media/encoded/', title: 'h264-360', size: '2MB' },
                        },
                    },
                },
            });
        });

        test('Lists completed encodings and the original file in the popup', () => {
            const { container, unmount } = renderIntoContainer(<VideoMediaDownloadLink />);
            expect(container.querySelector('.nav-page-main')).not.toBeNull();
            expect(container.querySelector('.popup')).toBeNull();
            click(container.querySelector('.video-downloads > button'));
            const links = Array.from(container.querySelectorAll('.main-options a')) as HTMLAnchorElement[];
            expect(links.map((a) => a.textContent)).toEqual(['360 - H264 (2MB)', '720 - H264 (5MB)', 'Original file (10MB)']);
            expect(links[1].getAttribute('href')).toMatch(/^https:\/\/example\.com\/+media\/encoded\/clip-720\.mp4$/);
            expect(links[1].getAttribute('download')).toBe('clip-720.mp4');
            expect(links[0].getAttribute('download')).toBe('Clip');
            expect(links[2].getAttribute('download')).toBe('clip.mp4');
            unmount();
        });
    });
});
