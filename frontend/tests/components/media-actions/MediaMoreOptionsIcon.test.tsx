import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, changeValue } from '../../_support/compD_dom';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions } from '../../../src/static/js/utils/actions/';
import { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';
import { MediaMoreOptionsIcon } from '../../../src/static/js/components/media-actions/MediaMoreOptionsIcon';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;

function videoData(extra: { [key: string]: any } = {}) {
    return {
        title: 'Clip',
        url: 'https://example.com/view?m=abc',
        media_type: 'video',
        state: 'public',
        encoding_status: 'success',
        is_reviewed: true,
        reported_times: 0,
        size: '9MB',
        original_media_url: '/media/original/clip.mp4',
        encodings_info: {
            '720': { h264: { status: 'success', progress: 100, url: '/media/enc/720.mp4', title: 'h264-720', size: '4MB' } },
        },
        ...extra,
    };
}

function render(allowDownload = true) {
    return renderIntoContainer(
        <UserProvider>
            <MediaMoreOptionsIcon allowDownload={allowDownload} />
        </UserProvider>
    );
}

function menuTexts(container: HTMLElement) {
    return Array.from(container.querySelectorAll('.main-options li')).map((li) => (li.textContent || '').trim());
}

describe('components/media-actions', () => {
    describe('MediaMoreOptionsIcon', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mediaStore.__reset({ 'media-original-url': '/media/original/clip.mp4', 'media-data': videoData() });
            (PageStore as any).__reset();
        });

        test('Renders nothing when download is not allowed', () => {
            const { container, unmount } = render(false);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Shows download, status info and report entries for an editor on a video', () => {
            const { container, unmount } = render();
            expect(container.querySelector('.more-options')?.className).toBe('more-options active-options');
            click(container.querySelector('.more-options button'));
            expect(menuTexts(container)).toEqual(['Download', 'Status info', 'Report']);
            unmount();
        });

        test('Status info page lists media details', () => {
            mediaStore.__set('media-data', videoData({ is_reviewed: false, reported_times: 2, state: undefined }));
            const { container, unmount } = render();
            click(container.querySelector('.more-options button'));
            click(container.querySelector('[data-page-id="mediaStatusInfo"]'));
            const items = Array.from(container.querySelectorAll('.media-status-info li')).map((li) => li.textContent);
            expect(items).toEqual(['Media type: video', 'State: N/A', 'Review state: Pending review', 'Encoding Status: success', 'Reports: 2']);
            expect(container.querySelector('.nav-page-mediaStatusInfo')).not.toBeNull();
            unmount();
        });

        test('Video download page lists encodings and original file', () => {
            const { container, unmount } = render();
            click(container.querySelector('.more-options button'));
            click(container.querySelector('[data-page-id="videoDownloadOptions"]'));
            const links = Array.from(container.querySelectorAll('.video-download-options a')) as HTMLAnchorElement[];
            expect(links.map((a) => a.textContent)).toEqual(['720 - H264 (4MB)', 'Original file (9MB)']);
            expect(links[0].getAttribute('download')).toBe('Clip_720_H264');
            expect(container.querySelector('.more-options')?.className).toContain('video-downloads');
            unmount();
        });

        test('Non video media gets a direct download link', () => {
            mediaStore.__set('media-data', videoData({ media_type: 'pdf' }));
            const { container, unmount } = render();
            click(container.querySelector('.more-options button'));
            expect(menuTexts(container)).toEqual(['Download', 'Report']);
            const link = container.querySelector('.main-options a') as HTMLAnchorElement;
            expect(link.getAttribute('download')).toBe('Clip');
            expect(link.getAttribute('href')).toContain('/media/original/clip.mp4');
            unmount();
        });

        test('Submitting the report form dispatches reportMedia and completion marks it reported', () => {
            jest.useFakeTimers();
            const { container, unmount } = render();
            click(container.querySelector('.more-options button'));
            click(container.querySelector('[data-page-id="loggedInReportMedia"]'));
            expect((container.querySelector('.report-form input') as HTMLInputElement).value).toBe('https://example.com/view?m=abc');
            changeValue(container.querySelector('.report-form textarea'), 'bad content');
            click(container.querySelectorAll('.form-actions-bottom button')[1]);
            expect((MediaPageActions as any).reportMedia).toHaveBeenCalledWith('bad content');

            act(() => {
                mediaStore.emit('reported_media');
            });
            act(() => {
                jest.advanceTimersByTime(100);
            });
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Media Reported', 'reportedMedia');
            expect(mediaStore.listenerCount('reported_media')).toBe(0);
            click(container.querySelector('.more-options button'));
            expect(menuTexts(container)).toEqual(['Download', 'Status info', 'Reported']);
            unmount();
            jest.useRealTimers();
        });

        test('Cancelling the report form closes the popup', () => {
            const { container, unmount } = render();
            click(container.querySelector('.more-options button'));
            click(container.querySelector('[data-page-id="loggedInReportMedia"]'));
            click(container.querySelector('.report-form ~ .form-actions-bottom .cancel'));
            expect(container.querySelector('.report-form')).toBeNull();
            unmount();
        });
    });
});
