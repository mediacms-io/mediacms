import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { PlaylistPageActions } from '../../../src/static/js/utils/actions/';
import { PlaylistActions, PlaylistDelete } from '../../../src/static/js/pages/PlaylistPage';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());
jest.mock('../../../src/static/js/components/playlist-form/PlaylistCreationForm', () => ({
    PlaylistCreationForm: () => null,
}));
jest.mock('../../../src/static/js/components/playlist-page/PlaylistMediaList', () => ({
    PlaylistMediaList: () => null,
}));
jest.mock('../../../src/static/js/pages/_Page', () => ({
    Page: class Page {},
}));

describe('pages/PlaylistPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Shows a labeled Delete button to the playlist owner', () => {
        const { container, unmount } = renderIntoContainer(<PlaylistActions loggedinUserPlaylist />);
        const button = container.querySelector('.delete-playlist > button');
        expect(button?.textContent).toContain('DELETE');
        expect(button?.querySelector('.material-icons')?.getAttribute('data-icon')).toBe('delete');
        unmount();
    });

    test('Hides the Delete button from other users', () => {
        const { container, unmount } = renderIntoContainer(<PlaylistActions loggedinUserPlaylist={false} />);
        expect(container.querySelector('.delete-playlist')).toBeNull();
        unmount();
    });

    test('Asks for confirmation and cancel keeps the playlist', () => {
        const { container, unmount } = renderIntoContainer(<PlaylistDelete />);
        click(container.querySelector('.delete-playlist > button'));
        expect(container.querySelector('.popup-message-title')?.textContent).toBe('Playlist removal');
        click(container.querySelector('.cancel-playlist-removal'));
        expect(container.querySelector('.popup-message')).toBeNull();
        expect((PlaylistPageActions as any).removePlaylist).not.toHaveBeenCalled();
        unmount();
    });

    test('Proceeding removes the playlist', () => {
        const { container, unmount } = renderIntoContainer(<PlaylistDelete />);
        click(container.querySelector('.delete-playlist > button'));
        click(container.querySelector('.proceed-playlist-removal'));
        expect((PlaylistPageActions as any).removePlaylist).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.popup-message')).toBeNull();
        unmount();
    });
});
