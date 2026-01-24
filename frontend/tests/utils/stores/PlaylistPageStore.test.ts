import {
    publishedOnDate,
    getRequest,
    postRequest,
    deleteRequest,
    csrfToken,
} from '../../../src/static/js/utils/helpers';
import store from '../../../src/static/js/utils/stores/PlaylistPageStore';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    publishedOnDate: jest.fn(),
    exportStore: jest.fn((store) => store),
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    deleteRequest: jest.fn(),
    csrfToken: jest.fn(),
}));

describe('utils/store', () => {
    beforeAll(() => {
        (globalThis as any).window.MediaCMS = { playlistId: null };
    });

    afterAll(() => {
        delete (globalThis as any).window.MediaCMS;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('PlaylistPageStore', () => {
        const handler = store.actions_handler.bind(store);

        const onLoadedPlaylistData = jest.fn();
        const onLoadedPlaylistEerror = jest.fn();
        const onLoadedMediaError = jest.fn();
        const onPlaylistUpdateCompleted = jest.fn();
        const onPlaylistUpdateFailed = jest.fn();
        const onPlaylistRemovalCompleted = jest.fn();
        const onPlaylistRemovalFailed = jest.fn();
        const onSavedUpdated = jest.fn();
        const onReorderedMediaInPlaylist = jest.fn();
        const onRemovedMediaFromPlaylist = jest.fn();

        store.on('loaded_playlist_data', onLoadedPlaylistData);
        store.on('loaded_playlist_error', onLoadedPlaylistEerror);
        store.on('loaded_media_error', onLoadedMediaError); // @todo: It doesn't get called
        store.on('playlist_update_completed', onPlaylistUpdateCompleted);
        store.on('playlist_update_failed', onPlaylistUpdateFailed);
        store.on('playlist_removal_completed', onPlaylistRemovalCompleted);
        store.on('playlist_removal_failed', onPlaylistRemovalFailed);
        store.on('saved-updated', onSavedUpdated);
        store.on('reordered_media_in_playlist', onReorderedMediaInPlaylist);
        store.on('removed_media_from_playlist', onRemovedMediaFromPlaylist);

        test('Validate initial values', () => {
            expect(store.get('INVALID_TYPE')).toBe(null);
            expect(store.get('playlistId')).toBe(null);
            expect(store.get('logged-in-user-playlist')).toBe(false);
            expect(store.get('playlist-media')).toStrictEqual([]);
            expect(store.get('visibility')).toBe('public');
            expect(store.get('visibility-icon')).toBe(null);
            //     // expect(store.get('total-items')).toBe(0); // @todo: It throws error
            expect(store.get('views-count')).toBe('N/A');
            expect(store.get('title')).toBe(null);
            expect(store.get('edit-link')).toBe('#');
            expect(store.get('thumb')).toBe(null);
            expect(store.get('description')).toBe(null);
            expect(store.get('author-username')).toBe(null);
            expect(store.get('author-name')).toBe(null);
            expect(store.get('author-link')).toBe(null);
            expect(store.get('author-thumb')).toBe(null);
            expect(store.get('saved-playlist')).toBe(false);
            expect(store.get('date-label')).toBe(null);
        });

        describe('Trigger and validate actions behavior', () => {
            test('Action type: "LOAD_PLAYLIST_DATA" - failed', () => {
                const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
                const loadDataSpy = jest.spyOn(store, 'loadData');

                handler({ type: 'LOAD_PLAYLIST_DATA' });

                expect(loadDataSpy).toHaveBeenCalledTimes(1);
                expect(loadDataSpy).toHaveReturnedWith(false);

                expect(warnSpy).toHaveBeenCalledTimes(1);
                expect(warnSpy).toHaveBeenCalledWith('Invalid playlist id:', '');

                expect(store.get('playlistId')).toBe(null);

                loadDataSpy.mockRestore();
                warnSpy.mockRestore();
            });

            test('Action type: "LOAD_PLAYLIST_DATA" - completed successful', () => {
                const playlistId = 'PLAYLIST_ID_1';
                window.history.pushState({}, '', `/playlists/${playlistId}`);

                // Mock get request
                const mockGetRequestResponse = {
                    data: {
                        add_date: Date.now(),
                        description: 'DESCRIPTION',
                        playlist_media: [],
                        title: 'TITLE',
                        user: 'USER',
                        user_thumbnail_url: 'USER_THUMB_URL',
                    },
                };

                (getRequest as jest.Mock).mockImplementation((_url, _cache, successCallback, _failCallback) =>
                    successCallback(mockGetRequestResponse)
                );

                const loadDataSpy = jest.spyOn(store, 'loadData');
                const dataResponseSpy = jest.spyOn(store, 'dataResponse');

                handler({ type: 'LOAD_PLAYLIST_DATA' });

                expect(store.get('playlistId')).toBe(playlistId);
                expect(store.get('author-name')).toBe(mockGetRequestResponse.data.user);
                expect(store.get('author-link')).toBe(`/user/${mockGetRequestResponse.data.user}`);
                expect(store.get('author-thumb')).toBe(`/${mockGetRequestResponse.data.user_thumbnail_url}`);

                expect(store.get('date-label')).toBe('Created on undefined');
                expect(publishedOnDate).toHaveBeenCalledWith(new Date(mockGetRequestResponse.data.add_date), 3);

                expect(loadDataSpy).toHaveBeenCalledTimes(1);
                expect(loadDataSpy).toHaveReturnedWith(undefined);

                expect(dataResponseSpy).toHaveBeenCalledTimes(1);
                expect(dataResponseSpy).toHaveBeenCalledWith(mockGetRequestResponse);

                // Verify getRequest was called with correct parameters
                expect(getRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    false,
                    store.dataResponse,
                    store.dataErrorResponse
                );

                expect(onLoadedPlaylistData).toHaveBeenCalledTimes(1);
                expect(onLoadedPlaylistData).toHaveBeenCalledWith();

                loadDataSpy.mockRestore();
                dataResponseSpy.mockRestore();
            });

            test('Action type: "LOAD_PLAYLIST_DATA" - completed with error', () => {
                const playlistId = 'PLAYLIST_ID_2';
                window.history.pushState({}, '', `/playlists/${playlistId}`);

                // Mock get request
                const mockGetRequestResponse = { type: 'private' };
                (getRequest as jest.Mock).mockImplementation((_url, _cache, _successCallback, failCallback) =>
                    failCallback(mockGetRequestResponse)
                );

                const loadDataSpy = jest.spyOn(store, 'loadData');
                const dataErrorResponseSpy = jest.spyOn(store, 'dataErrorResponse');

                handler({ type: 'LOAD_PLAYLIST_DATA' });

                expect(store.get('playlistId')).toBe(playlistId);

                expect(loadDataSpy).toHaveBeenCalledTimes(1);
                expect(loadDataSpy).toHaveReturnedWith(undefined);

                expect(dataErrorResponseSpy).toHaveBeenCalledTimes(1);
                expect(dataErrorResponseSpy).toHaveBeenCalledWith(mockGetRequestResponse);

                // Verify getRequest was called with correct parameters
                expect(getRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    false,
                    store.dataResponse,
                    store.dataErrorResponse
                );

                expect(onLoadedPlaylistEerror).toHaveBeenCalledTimes(1);
                expect(onLoadedPlaylistEerror).toHaveBeenCalledWith();

                loadDataSpy.mockRestore();
                dataErrorResponseSpy.mockRestore();
            });

            test('Action type: "TOGGLE_SAVE"', () => {
                const initialValue = store.get('saved-playlist');

                handler({ type: 'TOGGLE_SAVE' });

                expect(onSavedUpdated).toHaveBeenCalledTimes(1);
                expect(onSavedUpdated).toHaveBeenCalledWith();

                expect(store.get('saved-playlist')).toBe(!initialValue);
            });

            test('Action type: "UPDATE_PLAYLIST" - failed', () => {
                // Mock (updated) playlist data
                const mockPlaylistData = { title: 'PLAYLIST_TITLE', description: 'PLAYLIST_DESCRIPTION' };

                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock post request
                (postRequest as jest.Mock).mockImplementation(
                    (_url, _postData, _configData, _sync, _successCallback, failCallback) => failCallback()
                );

                const initialStoreData = {
                    title: store.get('title'),
                    description: store.get('description'),
                };

                expect(store.get('title')).toBe(initialStoreData.title);
                expect(store.get('description')).toBe(initialStoreData.description);

                handler({ type: 'UPDATE_PLAYLIST', playlist_data: mockPlaylistData });

                expect(store.get('title')).toBe(initialStoreData.title);
                expect(store.get('description')).toBe(initialStoreData.description);

                // Verify postRequest was called with correct parameters
                expect(postRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    mockPlaylistData,
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.onPlaylistUpdateCompleted,
                    store.onPlaylistUpdateFailed
                );

                expect(onPlaylistUpdateFailed).toHaveBeenCalledWith();
            });

            test('Action type: "UPDATE_PLAYLIST" - successful', () => {
                // Mock (updated) playlist data
                const mockPlaylistData = { title: 'PLAYLIST_TITLE', description: 'PLAYLIST_DESCRIPTION' };

                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock post request
                (postRequest as jest.Mock).mockImplementation(
                    (_url, _postData, _configData, _sync, successCallback, _failCallback) =>
                        successCallback({ data: mockPlaylistData })
                );

                const initialStoreData = {
                    title: store.get('title'),
                    description: store.get('description'),
                };

                expect(store.get('title')).toBe(initialStoreData.title);
                expect(store.get('description')).toBe(initialStoreData.description);

                handler({ type: 'UPDATE_PLAYLIST', playlist_data: mockPlaylistData });

                expect(store.get('title')).toBe(mockPlaylistData.title);
                expect(store.get('description')).toBe(mockPlaylistData.description);

                // Verify postRequest was called with correct parameters
                expect(postRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    mockPlaylistData,
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.onPlaylistUpdateCompleted,
                    store.onPlaylistUpdateFailed
                );

                expect(onPlaylistUpdateCompleted).toHaveBeenCalledWith(mockPlaylistData);
            });

            test('Action type: "REMOVE_PLAYLIST" - failed', () => {
                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock delete request
                (deleteRequest as jest.Mock).mockImplementation(
                    (_url, _config, _sync, _successCallback, failCallback) => failCallback()
                );

                handler({ type: 'REMOVE_PLAYLIST' });

                // Verify deleteRequest was called with correct parameters
                expect(deleteRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.onPlaylistRemovalCompleted,
                    store.onPlaylistRemovalFailed
                );

                expect(onPlaylistRemovalFailed).toHaveBeenCalledWith();
            });

            test('Action type: "REMOVE_PLAYLIST" - completed successful', () => {
                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock delete request
                const deleteRequestResponse = { status: 204 };
                (deleteRequest as jest.Mock).mockImplementation(
                    (_url, _config, _sync, successCallback, _failCallback) => successCallback(deleteRequestResponse)
                );

                handler({ type: 'REMOVE_PLAYLIST' });

                // Verify deleteRequest was called with correct parameters
                expect(deleteRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.onPlaylistRemovalCompleted,
                    store.onPlaylistRemovalFailed
                );

                expect(onPlaylistRemovalCompleted).toHaveBeenCalledWith(deleteRequestResponse);
            });

            test('Action type: "REMOVE_PLAYLIST" - completed with invalid status code', () => {
                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock delete request
                const deleteRequestResponse = { status: 403 };
                (deleteRequest as jest.Mock).mockImplementation(
                    (_url, _config, _sync, successCallback, _failCallback) => successCallback(deleteRequestResponse)
                );

                handler({ type: 'REMOVE_PLAYLIST' });

                // Verify deleteRequest was called with correct parameters
                expect(deleteRequest).toHaveBeenCalledWith(
                    store.playlistAPIUrl,
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.onPlaylistRemovalCompleted,
                    store.onPlaylistRemovalFailed
                );

                expect(onPlaylistRemovalFailed).toHaveBeenCalledWith();
            });

            test('Action type: "PLAYLIST_MEDIA_REORDERED"', () => {
                // Mock playlist media data
                const mockPlaylistMedia = [
                    { thumbnail_url: 'THUMB_URL_1', url: '?id=MEDIA_ID_1' },
                    { thumbnail_url: 'THUMB_URL_2', url: '?id=MEDIA_ID_2' },
                ];

                handler({ type: 'PLAYLIST_MEDIA_REORDERED', playlist_media: mockPlaylistMedia });

                expect(onReorderedMediaInPlaylist).toHaveBeenCalledWith();

                expect(store.get('playlist-media')).toStrictEqual(mockPlaylistMedia);
                expect(store.get('thumb')).toBe(mockPlaylistMedia[0].thumbnail_url);
                expect(store.get('total-items')).toBe(mockPlaylistMedia.length);
            });

            test('Action type: "MEDIA_REMOVED_FROM_PLAYLIST"', () => {
                // Mock playlist media data
                const mockPlaylistMedia = [
                    { thumbnail_url: 'THUMB_URL_1', url: '?id=MEDIA_ID_1' },
                    { thumbnail_url: 'THUMB_URL_2', url: '?id=MEDIA_ID_2' },
                ];

                handler({ type: 'PLAYLIST_MEDIA_REORDERED', playlist_media: mockPlaylistMedia });

                handler({ type: 'MEDIA_REMOVED_FROM_PLAYLIST', media_id: 'MEDIA_ID_2' });

                expect(store.get('playlist-media')).toStrictEqual([mockPlaylistMedia[0]]);
                expect(store.get('thumb')).toBe(mockPlaylistMedia[0].thumbnail_url);
                expect(store.get('total-items')).toBe(mockPlaylistMedia.length - 1);
            });
        });
    });
});
