import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions } from '../../../src/static/js/utils/actions/';
import { MediaShareOptions } from '../../../src/static/js/components/media-actions/MediaShareOptions';
import { MediaShareButton } from '../../../src/static/js/components/media-actions/MediaShareButton';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;
const pageStore = PageStore as any;
const URL_ = 'https://example.com/view?m=abc';

describe('components/media-actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mediaStore.__reset({ 'media-url': URL_, 'media-id': 'abc', 'media-data': { title: 'Clip', media_type: 'video' } });
        pageStore.__reset({
            'config-options': { embedded: { video: { dimensions: { width: 560, widthUnit: 'px', height: 315, heightUnit: 'px' } } } },
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('MediaShareOptions', () => {
        test('Renders embed and email options for video media', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareOptions />);
            expect(container.querySelector('.share-popup-title')?.textContent).toBe('Share media');
            expect(container.querySelector('.share-embed-opt button')?.getAttribute('data-page-id')).toBe('shareEmbed');
            expect(container.querySelector('.share-email a')?.getAttribute('href')).toBe('mailto:?body=' + URL_);
            expect((container.querySelector('.copy-field input') as HTMLInputElement).value).toBe(URL_);
            unmount();
        });

        test('Omits embed for media that is neither video nor audio', () => {
            mediaStore.__set('media-data', { title: 'Pic', media_type: 'image' });
            const { container, unmount } = renderIntoContainer(<MediaShareOptions />);
            expect(container.querySelector('.share-embed-opt')).toBeNull();
            expect(container.querySelector('.share-email')).not.toBeNull();
            unmount();
        });

        test('Start at checkbox appends the current video time to the link', () => {
            const video = document.createElement('video');
            Object.defineProperty(video, 'currentTime', { value: 75.9 });
            document.body.appendChild(video);
            const { container, unmount } = renderIntoContainer(<MediaShareOptions />);
            expect(container.querySelector('.start-at label')?.textContent?.trim()).toBe('Start at 01:15');
            click(container.querySelector('.start-at input'));
            expect((container.querySelector('.copy-field input') as HTMLInputElement).value).toBe(URL_ + '&t=75');
            click(container.querySelector('.start-at input'));
            expect((container.querySelector('.copy-field input') as HTMLInputElement).value).toBe(URL_);
            unmount();
        });

        test('Formats hours in the start at label', () => {
            const video = document.createElement('video');
            Object.defineProperty(video, 'currentTime', { value: 3725 });
            document.body.appendChild(video);
            const { container, unmount } = renderIntoContainer(<MediaShareOptions />);
            expect(container.querySelector('.start-at label')?.textContent?.trim()).toBe('Start at 01:02:05');
            unmount();
        });

        test('Copy button dispatches copyShareLink and completion notifies after a delay', () => {
            jest.useFakeTimers();
            const { container, unmount } = renderIntoContainer(<MediaShareOptions />);
            click(container.querySelector('.copy-field button'));
            expect((MediaPageActions as any).copyShareLink).toHaveBeenCalledWith(container.querySelector('.copy-field input'));
            act(() => {
                mediaStore.emit('copied_media_link');
                pageStore.emit('window_resize');
            });
            jest.advanceTimersByTime(100);
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Link copied to clipboard', 'clipboardLinkCopy');
            unmount();
            expect(mediaStore.listenerCount('copied_media_link')).toBe(0);
            expect(pageStore.listenerCount('window_resize')).toBe(0);
            jest.useRealTimers();
        });
    });

    describe('MediaShareButton', () => {
        test('Opens share options popup and navigates to embed page for video', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareButton isVideo />);
            expect(container.querySelector('.share > button')?.textContent).toBe('SHARE');
            expect(container.querySelector('.share-popup-title')).toBeNull();
            click(container.querySelector('.share > button'));
            expect(container.querySelector('.share-popup-title')).not.toBeNull();
            click(container.querySelector('.share-embed-opt button'));
            expect(container.querySelector('.share-embed')).not.toBeNull();
            click(container.querySelector('.share-embed .on-right-top button'));
            expect(container.querySelector('.share-embed')).toBeNull();
            unmount();
        });

        test('Does not provide the embed page for non video media', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareButton />);
            click(container.querySelector('.share > button'));
            click(container.querySelector('.share-embed-opt button'));
            expect(container.querySelector('.share-embed')).toBeNull();
            expect(container.querySelector('.share-popup-title')).not.toBeNull();
            unmount();
        });
    });
});
