import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, changeValue } from '../../_support/compD_dom';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions } from '../../../src/static/js/utils/actions/';
import { MediaShareEmbed } from '../../../src/static/js/components/media-actions/MediaShareEmbed';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;
const pageStore = PageStore as any;
const BASE = 'https://example.com/embed?m=abc';

function embedCode(container: HTMLElement) {
    return (container.querySelector('textarea') as HTMLTextAreaElement).value;
}

function checkbox(container: HTMLElement, label: string) {
    const lbl = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent || '').trim() === label) as HTMLElement;
    return lbl.querySelector('input') as HTMLInputElement;
}

describe('components/media-actions', () => {
    describe('MediaShareEmbed', () => {
        beforeEach(() => {
            localStorage.clear();
            jest.clearAllMocks();
            mediaStore.__reset({ 'media-id': 'abc' });
            pageStore.__reset({
                'config-options': { embedded: { video: { dimensions: { width: 560, widthUnit: 'px', height: 315, heightUnit: 'px' } } } },
            });
        });

        test('Builds default fixed size embed code and preview url', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            expect(embedCode(container)).toBe(
                `<iframe width="560" height="315" src="${BASE}&showTitle=1&showRelated=1&showUserAvatar=1&linkTitle=1" frameBorder="0" allowFullScreen></iframe>`
            );
            expect(container.querySelector('.on-left iframe')?.getAttribute('src')).toBe(`${BASE}&showTitle=1&showRelated=1&showUserAvatar=1&linkTitle=1`);
            expect(container.querySelectorAll('.num-value-unit').length).toBe(2);
            unmount();
        });

        test('Toggling options updates params and disables dependent options', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            click(checkbox(container, 'Show title'));
            click(checkbox(container, 'Show related'));
            expect(checkbox(container, 'Link title').disabled).toBe(true);
            expect(checkbox(container, 'Show user avatar').disabled).toBe(true);
            expect(embedCode(container)).toContain('showTitle=0&showRelated=0&showUserAvatar=1&linkTitle=1');
            click(checkbox(container, 'Show title'));
            click(checkbox(container, 'Link title'));
            click(checkbox(container, 'Show user avatar'));
            expect(embedCode(container)).toContain('showTitle=1&showRelated=0&showUserAvatar=0&linkTitle=0');
            unmount();
        });

        test('Start at converts the time to seconds', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            click(checkbox(container, 'Start at'));
            const timeInput = checkbox(container, 'Start at').parentElement!.parentElement!.querySelector('input[type="text"]');
            expect(embedCode(container)).not.toContain('&t=');
            changeValue(timeInput, '1:02:03');
            expect(embedCode(container)).toContain('&t=3723');
            expect(container.querySelector('.on-left iframe')?.getAttribute('src')).toContain('&t=3723');
            unmount();
        });

        test('Responsive mode outputs aspect ratio styles and hides dimension inputs', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            click(checkbox(container, 'Responsive'));
            expect(container.querySelectorAll('.num-value-unit').length).toBe(0);
            expect(embedCode(container)).toContain('style="width:100%;max-width:calc(100vh * 16 / 9);aspect-ratio:16 / 9;display:block;margin:auto;border:0;"');
            changeValue(container.querySelector('select'), 'custom');
            expect(embedCode(container)).toContain('aspect-ratio:560 / 315;');
            unmount();
        });

        test('Changing aspect ratio recomputes height from width', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            changeValue(container.querySelector('select'), '4:3');
            expect(embedCode(container)).toContain('width="560" height="420"');
            unmount();
        });

        test('Width change keeps aspect ratio and percent unit is appended', () => {
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            const [widthInput, heightInput] = Array.from(container.querySelectorAll('.value-input'));
            changeValue(widthInput, '320');
            expect(embedCode(container)).toContain('width="320" height="180"');
            changeValue(heightInput, '90');
            expect(embedCode(container)).toContain('width="160" height="90"');
            changeValue(container.querySelectorAll('.value-unit')[0], 'percent');
            changeValue(container.querySelectorAll('.value-unit')[1], 'percent');
            expect(embedCode(container)).toContain('width="160%" height="90%"');
            unmount();
        });

        test('Persists options to localStorage and restores them', () => {
            const first = renderIntoContainer(<MediaShareEmbed />);
            click(checkbox(first.container, 'Show related'));
            first.unmount();
            expect(JSON.parse(localStorage.getItem('mediacms_embed_options') as string).showRelated).toBe(false);

            const second = renderIntoContainer(<MediaShareEmbed />);
            expect(checkbox(second.container, 'Show related').checked).toBe(false);
            expect(embedCode(second.container)).toContain('showRelated=0');
            second.unmount();
        });

        test('Ignores corrupted saved options', () => {
            localStorage.setItem('mediacms_embed_options', '{broken');
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            expect(checkbox(container, 'Show related').checked).toBe(true);
            unmount();
        });

        test('Copy dispatches copyEmbedMediaCode and completion schedules a notification', () => {
            jest.useFakeTimers();
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed />);
            click(container.querySelector('.on-right-bottom button'));
            expect((MediaPageActions as any).copyEmbedMediaCode).toHaveBeenCalledWith(container.querySelector('textarea'));
            act(() => {
                mediaStore.emit('copied_embed_media_code');
            });
            expect((PageActions as any).addNotification).not.toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Embed media code copied to clipboard', 'clipboardEmbedMediaCodeCopy');
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
            expect(mediaStore.listenerCount('copied_embed_media_code')).toBe(0);
            jest.useRealTimers();
        });

        test('Close button triggers popup close callback', () => {
            const triggerPopupClose = jest.fn();
            const { container, unmount } = renderIntoContainer(<MediaShareEmbed triggerPopupClose={triggerPopupClose} />);
            click(container.querySelector('.on-right-top button'));
            expect(triggerPopupClose).toHaveBeenCalledTimes(1);
            unmount();
        });
    });
});
