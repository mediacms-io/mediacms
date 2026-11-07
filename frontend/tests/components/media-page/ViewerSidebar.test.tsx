import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import ViewerSidebar from '../../../src/static/js/components/media-page/ViewerSidebar';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());
jest.mock('../../../src/static/js/components/item-list/ItemList', () => require('../../_support/compD_itemListMock'));
jest.mock('../../../src/static/js/components/media-page/PlaylistView', () => ({
    __esModule: true,
    default: (props: any) => require('react').createElement('div', { className: 'mock-playlist-view', 'data-active': props.activeItem }),
}));

const Sidebar = ViewerSidebar as unknown as React.ComponentType<any>;
const mediaStore = MediaPageStore as any;

describe('components/media-page', () => {
    describe('ViewerSidebar', () => {
        beforeEach(() => {
            mediaStore.__reset({ 'media-type': 'image', 'media-data': { related_media: [{ id: 'r1' }, { id: 'r2' }] } });
            (PageStore as any).__reset({
                'config-media-item': { displayViews: true, displayAuthor: true },
                'config-options': { pages: { media: { related: { initialSize: 5 } } } },
            });
        });

        test('Shows only related media for non playable media', () => {
            const { container, unmount } = renderIntoContainer(<Sidebar mediaId="m1" />);
            expect(container.querySelector('.auto-play')).toBeNull();
            expect(container.querySelector('.mock-playlist-view')).toBeNull();
            expect(container.querySelectorAll('.mock-item-list').length).toBe(1);
            unmount();
        });

        test('Adds auto play once a video loads', () => {
            const { container, unmount } = renderIntoContainer(<Sidebar mediaId="m1" />);
            mediaStore.__set('media-type', 'video');
            act(() => {
                mediaStore.emit('loaded_media_data');
            });
            expect(container.querySelector('.auto-play')).not.toBeNull();
            unmount();
            expect(mediaStore.listenerCount('loaded_media_data')).toBe(0);
        });

        test('Shows the playlist view with the active item for playlist pages', () => {
            const playlistData = { playlist_media: [{ friendly_token: 'x' }, { friendly_token: 'm1' }] };
            const { container, unmount } = renderIntoContainer(<Sidebar mediaId="m1" playlistData={playlistData} />);
            expect(container.querySelector('.mock-playlist-view')?.getAttribute('data-active')).toBe('2');
            expect(container.querySelector('.auto-play')).toBeNull();
            unmount();
        });
    });
});
