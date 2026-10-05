import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
    deleteRequest: jest.fn(),
}));

installMediaCMSGlobal({ site: { url: 'https://example.com' } });

const playlistApi = 'https://example.com/api/v1/playlists/PL9';

function loadStore(playlistId: string | null = 'PL9') {
    (window as any).MediaCMS.playlistId = playlistId;
    let store: any;
    let actions: any;
    let requests: any;
    jest.isolateModules(() => {
        requests = require('../../../src/static/js/utils/helpers/requests');
        store = require('../../../src/static/js/utils/stores/PlaylistPageStore').default;
        actions = require('../../../src/static/js/utils/actions/PlaylistPageActions');
    });
    return { store, actions, requests };
}

const playlistData = {
    title: 'My list',
    description: 'Desc',
    user: 'john',
    user_thumbnail_url: '/media/john.jpg',
    add_date: '2024-03-05T10:00:00Z',
    playlist_media: [
        { url: '/view?m=aaa', thumbnail_url: '/t/a.jpg' },
        { url: '/view?m=bbb', thumbnail_url: '/t/b.jpg' },
    ],
};

function loaded() {
    const ctx = loadStore();
    ctx.actions.loadPlaylistData();
    ctx.requests.getRequest.mock.calls[0][2]({ data: JSON.parse(JSON.stringify(playlistData)) });
    return ctx;
}

describe('utils/stores', () => {
    describe('PlaylistPageStore', () => {
        beforeAll(() => {
            document.cookie = 'csrftoken=csrf-2';
        });

        afterAll(() => {
            document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            delete (window as any).MediaCMS.playlistId;
            window.history.replaceState(null, '', '/');
        });

        test('Returns defaults before data loads', () => {
            const { store } = loadStore();
            expect(store.get('playlistId')).toBeNull();
            expect(store.get('playlist-media')).toStrictEqual([]);
            expect(store.get('title')).toBeNull();
            expect(store.get('thumb')).toBeNull();
            expect(store.get('author-link')).toBeNull();
            expect(store.get('author-thumb')).toBeNull();
            expect(store.get('date-label')).toBeNull();
            expect(store.get('visibility')).toBe('public');
            expect(store.get('visibility-icon')).toBeNull();
            expect(store.get('views-count')).toBe('N/A');
            expect(store.get('edit-link')).toBe('#');
            expect(store.get('saved-playlist')).toBe(false);
            expect(store.get('logged-in-user-playlist')).toBe(false);
            expect(store.get('unknown')).toBeNull();
        });

        test('LOAD_PLAYLIST_DATA requests the playlist from page config id and emits on success', () => {
            const { store, actions, requests } = loadStore();
            const listener = jest.fn();
            store.on('loaded_playlist_data', listener);

            actions.loadPlaylistData();

            expect(requests.getRequest).toHaveBeenCalledWith(playlistApi, false, expect.any(Function), expect.any(Function));
            requests.getRequest.mock.calls[0][2]({ data: playlistData });
            requests.getRequest.mock.calls[0][2](undefined);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(store.get('playlistId')).toBe('PL9');
        });

        test('Falls back to the last URL segment for the playlist id', () => {
            window.history.replaceState(null, '', '/playlists/FROMURL');
            const { store, actions, requests } = loadStore(null);
            actions.loadPlaylistData();
            expect(store.get('playlistId')).toBe('FROMURL');
            expect(requests.getRequest.mock.calls[0][0]).toBe('https://example.com/api/v1/playlists/FROMURL');
        });

        test('Warns and skips the request without a playlist id', () => {
            window.history.replaceState(null, '', '/playlists/');
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const { actions, requests } = loadStore(null);
            actions.loadPlaylistData();
            expect(requests.getRequest).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });

        test('Emits loaded_playlist_error on request failure', () => {
            const { store, actions, requests } = loadStore();
            const listener = jest.fn();
            store.on('loaded_playlist_error', listener);
            actions.loadPlaylistData();
            requests.getRequest.mock.calls[0][3]({ type: 'network' });
            requests.getRequest.mock.calls[0][3]({});
            expect(listener).toHaveBeenCalledTimes(2);
        });

        test('Exposes loaded playlist fields', () => {
            const { store } = loaded();
            expect(store.get('title')).toBe('My list');
            expect(store.get('description')).toBe('Desc');
            expect(store.get('author-username')).toBe('john');
            expect(store.get('author-name')).toBe('john');
            expect(store.get('author-link')).toBe('https://example.com/user/john');
            expect(store.get('author-thumb')).toBe('https://example.com/media/john.jpg');
            expect(store.get('thumb')).toBe('/t/a.jpg');
            expect(store.get('total-items')).toBe(2);
            expect(store.get('playlist-media')).toHaveLength(2);
            expect(store.get('logged-in-user-playlist')).toBe(true);
            expect(store.get('date-label')).toMatch(/^Created on /);
            expect(store.get('date-label')).toBe(store.get('date-label'));
        });

        test('TOGGLE_SAVE flips saved state', () => {
            const { store, actions } = loadStore();
            const listener = jest.fn();
            store.on('saved-updated', listener);
            actions.toggleSave();
            expect(store.get('saved-playlist')).toBe(true);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('UPDATE_PLAYLIST posts title and description and applies the response', () => {
            const { store, actions, requests } = loaded();
            const done = jest.fn();
            const failed = jest.fn();
            store.on('playlist_update_completed', done);
            store.on('playlist_update_failed', failed);

            actions.updatePlaylist({ title: 'New', description: 'New desc', extra: 1 });

            expect(requests.postRequest).toHaveBeenCalledWith(
                playlistApi,
                { title: 'New', description: 'New desc' },
                { headers: { 'X-CSRFToken': 'csrf-2' } },
                false,
                expect.any(Function),
                expect.any(Function)
            );

            const [, , , , onSuccess, onFail] = requests.postRequest.mock.calls[0];
            onSuccess({ data: { title: 'New', description: 'New desc' } });
            onSuccess(undefined);
            onFail();

            expect(store.get('title')).toBe('New');
            expect(store.get('description')).toBe('New desc');
            expect(done).toHaveBeenCalledWith({ title: 'New', description: 'New desc' });
            expect(done).toHaveBeenCalledTimes(1);
            expect(failed).toHaveBeenCalledTimes(1);
        });

        test('REMOVE_PLAYLIST emits completion unless forbidden or missing status', () => {
            const { store, actions, requests } = loaded();
            const done = jest.fn();
            const failed = jest.fn();
            store.on('playlist_removal_completed', done);
            store.on('playlist_removal_failed', failed);

            actions.removePlaylist();

            expect(requests.deleteRequest).toHaveBeenCalledWith(
                playlistApi,
                { headers: { 'X-CSRFToken': 'csrf-2' } },
                false,
                expect.any(Function),
                expect.any(Function)
            );

            const [, , , onSuccess, onFail] = requests.deleteRequest.mock.calls[0];
            onSuccess({ status: 204 });
            onSuccess({ status: 403 });
            onSuccess({});
            onFail();

            expect(done).toHaveBeenCalledWith({ status: 204 });
            expect(failed).toHaveBeenCalledTimes(3);
        });

        test('PLAYLIST_MEDIA_REORDERED replaces the media list', () => {
            const { store, actions } = loaded();
            const listener = jest.fn();
            store.on('reordered_media_in_playlist', listener);
            const reordered = [playlistData.playlist_media[1], playlistData.playlist_media[0]];
            actions.reorderedMediaInPlaylist(reordered);
            expect(store.get('playlist-media')).toBe(reordered);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('MEDIA_REMOVED_FROM_PLAYLIST drops the matching media token', () => {
            const { store, actions } = loaded();
            const listener = jest.fn();
            store.on('removed_media_from_playlist', listener);
            actions.removedMediaFromPlaylist('aaa', 'PL9');
            expect(store.get('playlist-media').map((m: any) => m.url)).toStrictEqual(['/view?m=bbb']);
            expect(store.get('thumb')).toBe('/t/b.jpg');
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('Is not the logged in user playlist for other authors', () => {
            const { store, actions, requests } = loadStore();
            actions.loadPlaylistData();
            requests.getRequest.mock.calls[0][2]({ data: { ...playlistData, user: 'jane' } });
            expect(store.get('logged-in-user-playlist')).toBe(false);
        });
    });
});
