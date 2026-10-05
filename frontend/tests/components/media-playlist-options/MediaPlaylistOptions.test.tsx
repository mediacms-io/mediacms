import '../../_support/setupMediaCMS';
import React from 'react';
import axios from 'axios';
import { renderIntoContainer, act } from '../../_support/render';
import { click, flush } from '../../_support/compD_dom';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { PageActions, PlaylistPageActions } from '../../../src/static/js/utils/actions/';
import { MediaPlaylistOptions } from '../../../src/static/js/components/media-playlist-options/MediaPlaylistOptions';

jest.mock('axios');
jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('components/media-playlist-options', () => {
    describe('MediaPlaylistOptions', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.clearAllMocks();
            (PageStore as any).__reset({ 'api-playlists': '/api/v1/playlists' });
            document.cookie = 'csrftoken=tok';
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function openRemoval(container: HTMLElement) {
            click(container.querySelector('.item-playlist-options-wrap > button'));
            click(container.querySelector('[data-page-id="proceedMediaPlaylistRemoval"]'));
        }

        test('Starts on the main page and navigates to the confirmation page', () => {
            const { container, unmount } = renderIntoContainer(<MediaPlaylistOptions media_id="m1" playlist_id="p1" />);
            expect(container.firstElementChild?.className).toBe('item-playlist-options-wrap item-playlist-options-main');
            click(container.querySelector('.item-playlist-options-wrap > button'));
            expect(container.querySelector('.change-page')?.textContent).toContain('Remove from playlist');
            click(container.querySelector('[data-page-id="proceedMediaPlaylistRemoval"]'));
            expect(container.firstElementChild?.className).toBe('item-playlist-options-wrap');
            expect(container.querySelector('.popup-message-title')?.textContent).toBe('Media playlist removal');
            click(container.querySelector('.cancel-playlist-removal'));
            expect(container.querySelector('.popup-message')).toBeNull();
            expect(container.firstElementChild?.className).toBe('item-playlist-options-wrap item-playlist-options-main');
            unmount();
        });

        test('Proceeding removes the media and notifies after a delay', async () => {
            mockedAxios.put.mockResolvedValueOnce({ status: 200 } as any);
            const { container, unmount } = renderIntoContainer(<MediaPlaylistOptions media_id="m1" playlist_id="p1" />);
            openRemoval(container);
            click(container.querySelector('.proceed-playlist-removal'));
            await flush();
            expect(mockedAxios.put).toHaveBeenCalledWith(
                '/api/v1/playlists/p1',
                { type: 'remove', media_friendly_token: 'm1' },
                { headers: { 'X-CSRFToken': 'tok' } }
            );
            expect(container.querySelector('.popup-message')).toBeNull();
            act(() => {
                jest.advanceTimersByTime(100);
            });
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Media removed from playlist', 'mediaPlaylistRemove');
            expect((PlaylistPageActions as any).removedMediaFromPlaylist).toHaveBeenCalledWith('m1', 'p1');
            unmount();
        });

        test('Failure notifies after a delay', async () => {
            mockedAxios.put.mockRejectedValueOnce(new Error('x'));
            const { container, unmount } = renderIntoContainer(<MediaPlaylistOptions media_id="m1" playlist_id="p1" />);
            openRemoval(container);
            click(container.querySelector('.proceed-playlist-removal'));
            await flush();
            act(() => {
                jest.advanceTimersByTime(100);
            });
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Media removal from playlist failed', 'mediaPlaylistRemoveFail');
            expect((PlaylistPageActions as any).removedMediaFromPlaylist).not.toHaveBeenCalled();
            unmount();
        });
    });
});
