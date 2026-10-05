import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import ViewerError from '../../../src/static/js/components/media-page/ViewerError';
import { PlaylistPlaybackMedia } from '../../../src/static/js/components/media-page/PlaylistPlaybackMedia';
import { AutoPlay } from '../../../src/static/js/components/media-page/AutoPlay';
import { RelatedMedia } from '../../../src/static/js/components/media-page/RelatedMedia';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());
jest.mock('../../../src/static/js/components/item-list/ItemList', () => require('../../_support/compD_itemListMock'));

const { __calls: itemListCalls } = require('../../_support/compD_itemListMock');
const mediaStore = MediaPageStore as any;
const pageStore = PageStore as any;

function lastItemListProps() {
    return itemListCalls[itemListCalls.length - 1];
}

describe('components/media-page', () => {
    beforeEach(() => {
        itemListCalls.length = 0;
        mediaStore.__reset();
        pageStore.__reset({
            'media-auto-play': true,
            'config-media-item': { displayViews: false, displayAuthor: true },
            'config-options': { pages: { media: { related: { initialSize: 7 } } } },
        });
    });

    describe('ViewerError', () => {
        test('Shows the media load error message', () => {
            mediaStore.__set('media-load-error-message', 'Media is private');
            const { container, unmount } = renderIntoContainer(<ViewerError />);
            expect(container.querySelector('.player-container-error .msg-wrap')?.textContent).toBe('Media is private');
            unmount();
        });
    });

    describe('PlaylistPlaybackMedia', () => {
        test('Passes playlist playback options to ItemList', () => {
            const items = [{ id: 1 }];
            const { unmount } = renderIntoContainer(<PlaylistPlaybackMedia items={items} playlistActiveItem={3} />);
            expect(lastItemListProps()).toEqual(
                expect.objectContaining({ items, className: 'items-list-hor', inPlaylistView: true, playlistActiveItem: 3, hidePlaylistOrderNumber: false, pageItems: 9999 })
            );
            unmount();
        });

        test('Defaults the active item to the first', () => {
            const { unmount } = renderIntoContainer(<PlaylistPlaybackMedia items={[]} />);
            expect(lastItemListProps().playlistActiveItem).toBe(1);
            unmount();
        });
    });

    describe('AutoPlay', () => {
        test('Renders nothing without related media', () => {
            mediaStore.__set('media-data', { related_media: [] });
            const { container, unmount } = renderIntoContainer(<AutoPlay />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Shows the first related media as up next and updates on load', () => {
            mediaStore.__set('media-data', null);
            const { container, unmount } = renderIntoContainer(<AutoPlay />);
            expect(container.innerHTML).toBe('');
            mediaStore.__set('media-data', { related_media: [{ id: 'r1' }, { id: 'r2' }] });
            act(() => {
                mediaStore.emit('loaded_media_data');
                pageStore.emit('switched_media_auto_play');
            });
            expect(container.querySelector('.auto-play .next-label')?.textContent).toBe('Up next');
            expect(lastItemListProps()).toEqual(expect.objectContaining({ items: [{ id: 'r1' }], maxItems: 1, hideViews: true, hideAuthor: false }));
            unmount();
            expect(mediaStore.listenerCount('loaded_media_data')).toBe(0);
            expect(pageStore.listenerCount('switched_media_auto_play')).toBe(0);
        });
    });

    describe('RelatedMedia', () => {
        test('Renders nothing without related media', () => {
            const { container, unmount } = renderIntoContainer(<RelatedMedia />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Lists related media with configured page size', () => {
            mediaStore.__set('media-data', { related_media: [{ id: 'a' }, { id: 'b' }] });
            const { unmount } = renderIntoContainer(<RelatedMedia />);
            expect(lastItemListProps()).toEqual(expect.objectContaining({ items: [{ id: 'a' }, { id: 'b' }], pageItems: 7, hideViews: true, hideAuthor: false }));
            unmount();
        });

        test('Skips the first item for video once media data loads', () => {
            mediaStore.__set('media-data', { related_media: [{ id: 'a' }, { id: 'b' }] });
            const { unmount } = renderIntoContainer(<RelatedMedia />);
            mediaStore.__set('media-type', 'video');
            act(() => {
                mediaStore.emit('loaded_media_data');
            });
            expect(lastItemListProps().items).toEqual([{ id: 'b' }]);
            unmount();
        });

        test('Keeps the first item when hideFirst is false', () => {
            mediaStore.__set('media-data', { related_media: [{ id: 'a' }, { id: 'b' }] });
            const { unmount } = renderIntoContainer(<RelatedMedia hideFirst={false} />);
            mediaStore.__set('media-type', 'audio');
            act(() => {
                mediaStore.emit('loaded_media_data');
            });
            expect(lastItemListProps().items).toEqual([{ id: 'a' }, { id: 'b' }]);
            unmount();
        });
    });
});
