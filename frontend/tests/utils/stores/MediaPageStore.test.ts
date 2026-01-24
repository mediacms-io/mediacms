import { csrfToken, deleteRequest, getRequest, postRequest, putRequest } from '../../../src/static/js/utils/helpers';

const MEDIA_ID = 'MEDIA_ID';
const PLAYLIST_ID = 'PLAYLIST_ID';

window.history.pushState({}, '', `/?m=${MEDIA_ID}&pl=${PLAYLIST_ID}`);

import store from '../../../src/static/js/utils/stores/MediaPageStore';

import { sampleGlobalMediaCMS, sampleMediaCMSConfig } from '../../tests-constants';

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    BrowserEvents: jest.fn().mockImplementation(() => ({
        doc: jest.fn(),
        win: jest.fn(),
    })),
    csrfToken: jest.fn(),
    deleteRequest: jest.fn(),
    exportStore: jest.fn((store) => store),
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
}));

describe('utils/store', () => {
    describe('MediaPageStore', () => {
        const handler = store.actions_handler.bind(store);

        const onLoadedViewerPlaylistData = jest.fn();
        const onLoadedPagePlaylistData = jest.fn();
        const onLoadedViewerPlaylistError = jest.fn();
        const onLoadedVideoData = jest.fn();
        const onLoadedImageData = jest.fn();
        const onLoadedMediaData = jest.fn();
        const onLoadedMediaError = jest.fn();
        const onCommentsLoad = jest.fn();
        const onUsersLoad = jest.fn();
        const onPlaylistsLoad = jest.fn();
        const onLikedMediaFailedRequest = jest.fn();
        const onLikedMedia = jest.fn();
        const onDislikedMediaFailedRequest = jest.fn();
        const onDislikedMedia = jest.fn();
        const onReportedMedia = jest.fn();
        const onPlaylistCreationCompleted = jest.fn();
        const onPlaylistCreationFailed = jest.fn();
        const onMediaPlaylistAdditionCompleted = jest.fn();
        const onMediaPlaylistAdditionFailed = jest.fn();
        const onMediaPlaylistRemovalCompleted = jest.fn();
        const onMediaPlaylistRemovalFailed = jest.fn();
        const onCopiedMediaLink = jest.fn();
        const onCopiedEmbedMediaCode = jest.fn();
        const onMediaDelete = jest.fn();
        const onMediaDeleteFail = jest.fn();
        const onCommentDeleteFail = jest.fn();
        const onCommentDelete = jest.fn();
        const onCommentSubmitFail = jest.fn();
        const onCommentSubmit = jest.fn();

        store.on('loaded_viewer_playlist_data', onLoadedViewerPlaylistData);
        store.on('loaded_page_playlist_data', onLoadedPagePlaylistData);
        store.on('loaded_viewer_playlist_error', onLoadedViewerPlaylistError);
        store.on('loaded_video_data', onLoadedVideoData);
        store.on('loaded_image_data', onLoadedImageData);
        store.on('loaded_media_data', onLoadedMediaData);
        store.on('loaded_media_error', onLoadedMediaError);
        store.on('comments_load', onCommentsLoad);
        store.on('users_load', onUsersLoad);
        store.on('playlists_load', onPlaylistsLoad);
        store.on('liked_media_failed_request', onLikedMediaFailedRequest);
        store.on('liked_media', onLikedMedia);
        store.on('disliked_media_failed_request', onDislikedMediaFailedRequest);
        store.on('disliked_media', onDislikedMedia);
        store.on('reported_media', onReportedMedia);
        store.on('playlist_creation_completed', onPlaylistCreationCompleted);
        store.on('playlist_creation_failed', onPlaylistCreationFailed);
        store.on('media_playlist_addition_completed', onMediaPlaylistAdditionCompleted);
        store.on('media_playlist_addition_failed', onMediaPlaylistAdditionFailed);
        store.on('media_playlist_removal_completed', onMediaPlaylistRemovalCompleted);
        store.on('media_playlist_removal_failed', onMediaPlaylistRemovalFailed);
        store.on('copied_media_link', onCopiedMediaLink);
        store.on('copied_embed_media_code', onCopiedEmbedMediaCode);
        store.on('media_delete', onMediaDelete);
        store.on('media_delete_fail', onMediaDeleteFail);
        store.on('comment_delete_fail', onCommentDeleteFail);
        store.on('comment_delete', onCommentDelete);
        store.on('comment_submit_fail', onCommentSubmitFail);
        store.on('comment_submit', onCommentSubmit);

        beforeAll(() => {
            (globalThis as any).window.MediaCMS = {
                // mediaId: MEDIA_ID, // @note: It doesn't belong in 'sampleGlobalMediaCMS, but it could be used
                features: sampleGlobalMediaCMS.features,
            };
        });

        afterAll(() => {
            delete (globalThis as any).window.MediaCMS;
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        test('Validate initial values', () => {
            expect(store.get('users')).toStrictEqual([]);
            expect(store.get('playlists')).toStrictEqual([]);
            expect(store.get('media-load-error-type')).toBe(null);
            expect(store.get('media-load-error-message')).toBe(null);
            expect(store.get('media-comments')).toStrictEqual([]);
            expect(store.get('media-data')).toBe(null);
            expect(store.get('media-id')).toBe(MEDIA_ID);
            expect(store.get('media-url')).toBe('N/A');
            expect(store.get('media-edit-subtitle-url')).toBe(null);
            expect(store.get('media-likes')).toBe('N/A');
            expect(store.get('media-dislikes')).toBe('N/A');
            expect(store.get('media-summary')).toBe(null);
            expect(store.get('media-categories')).toStrictEqual([]);
            expect(store.get('media-tags')).toStrictEqual([]);
            expect(store.get('media-type')).toBe(null);
            expect(store.get('media-original-url')).toBe(null);
            expect(store.get('media-thumbnail-url')).toBe(null);
            expect(store.get('user-liked-media')).toBe(false);
            expect(store.get('user-disliked-media')).toBe(false);
            expect(store.get('media-author-thumbnail-url')).toBe(null);
            expect(store.get('playlist-data')).toBe(null);
            expect(store.get('playlist-id')).toBe(null);
            expect(store.get('playlist-next-media-url')).toBe(null);
            expect(store.get('playlist-previous-media-url')).toBe(null);
        });

        describe('Trigger and validate actions behavior', () => {
            const MEDIA_DATA = {
                add_subtitle_url: '/MEDIA_DATA_ADD_SUBTITLE_URL',
                author_thumbnail: 'MEDIA_DATA_AUTHOR_THUMBNAIL',
                categories_info: [
                    { title: 'Art', url: '/search?c=Art' },
                    { title: 'Documentary', url: '/search?c=Documentary' },
                ],
                likes: 12,
                dislikes: 4,
                media_type: 'video',
                original_media_url: 'MEDIA_DATA_ORIGINAL_MEDIA_URL',
                reported_times: 0,
                summary: 'MEDIA_DATA_SUMMARY',
                tags_info: [
                    { title: 'and', url: '/search?t=and' },
                    { title: 'behavior', url: '/search?t=behavior' },
                ],
                thumbnail_url: 'MEDIA_DATA_THUMBNAIL_URL',
                url: '/MEDIA_DATA_URL',
            };
            const PLAYLIST_DATA = {
                playlist_media: [
                    { friendly_token: `${MEDIA_ID}_2`, url: '/PLAYLIT_MEDIA_URL_2' },
                    { friendly_token: MEDIA_ID, url: '/PLAYLIT_MEDIA_URL_1' },
                    { friendly_token: `${MEDIA_ID}_3`, url: '/PLAYLIT_MEDIA_URL_3' },
                ],
            };
            const USER_PLAYLIST_DATA = { playlist_media: [{ url: 'm=PLAYLIST_MEDIA_ID' }] };

            test('Action type: "LOAD_MEDIA_DATA"', () => {
                const MEDIA_API_URL = `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}`;
                const MEDIA_COMMENTS_API_URL = `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}/comments`;
                const PLAYLIST_API_URL = `${sampleMediaCMSConfig.api.playlists}/${PLAYLIST_ID}`;
                const USERS_API_URL = sampleMediaCMSConfig.api.users;
                const USER_PLAYLISTS_API_URL = `${sampleMediaCMSConfig.api.user.playlists}${sampleMediaCMSConfig.member.username}`;
                const USER_PLAYLIST_API_URL = `${sampleMediaCMSConfig.site.url}/${'PLAYLIST_API_URL'.replace(/^\//g, '')}`;

                const MEDIA_COMMENTS_RESULTS = ['COMMENT_ID_1'];
                const USERS_RESULTS = ['USER_ID_1'];
                const USER_PLAYLISTS_RESULTS = [
                    {
                        url: `/${PLAYLIST_ID}`,
                        user: sampleMediaCMSConfig.member.username,
                        title: 'PLAYLIST_TITLE',
                        description: 'PLAYLIST_DECRIPTION',
                        add_date: 'PLAYLIST_ADD_DATE',
                        api_url: 'PLAYLIST_API_URL',
                    },
                ];

                (getRequest as jest.Mock).mockImplementation((url, _cache, successCallback, _failCallback) => {
                    if (url === PLAYLIST_API_URL) {
                        return successCallback({ data: PLAYLIST_DATA });
                    }

                    if (url === USER_PLAYLIST_API_URL) {
                        return successCallback({ data: USER_PLAYLIST_DATA });
                    }

                    if (url === MEDIA_API_URL) {
                        return successCallback({ data: MEDIA_DATA });
                    }

                    if (url === USERS_API_URL) {
                        return successCallback({ data: { count: USERS_RESULTS.length, results: USERS_RESULTS } });
                    }

                    if (url === MEDIA_COMMENTS_API_URL) {
                        return successCallback({
                            data: { count: MEDIA_COMMENTS_RESULTS.length, results: MEDIA_COMMENTS_RESULTS },
                        });
                    }

                    if (url === USER_PLAYLISTS_API_URL) {
                        return successCallback({
                            data: { count: USER_PLAYLISTS_RESULTS.length, results: USER_PLAYLISTS_RESULTS },
                        });
                    }
                });

                handler({ type: 'LOAD_MEDIA_DATA' });

                expect(getRequest).toHaveBeenCalledTimes(6);

                expect(getRequest).toHaveBeenCalledWith(
                    PLAYLIST_API_URL,
                    false,
                    store.playlistDataResponse,
                    store.playlistDataErrorResponse
                );
                expect(getRequest).toHaveBeenCalledWith(
                    MEDIA_API_URL,
                    false,
                    store.dataResponse,
                    store.dataErrorResponse
                );
                expect(getRequest).toHaveBeenCalledWith(MEDIA_COMMENTS_API_URL, false, store.commentsResponse);
                expect(getRequest).toHaveBeenCalledWith(USERS_API_URL, false, store.usersResponse);
                expect(getRequest).toHaveBeenCalledWith(USER_PLAYLISTS_API_URL, false, store.playlistsResponse);
                expect(getRequest).toHaveBeenCalledWith(USER_PLAYLIST_API_URL, false, expect.any(Function));

                expect(onLoadedViewerPlaylistData).toHaveBeenCalledTimes(1);
                expect(onLoadedPagePlaylistData).toHaveBeenCalledTimes(1);
                expect(onLoadedViewerPlaylistError).toHaveBeenCalledTimes(0);
                expect(onLoadedVideoData).toHaveBeenCalledTimes(1);
                expect(onLoadedImageData).toHaveBeenCalledTimes(0);
                expect(onLoadedMediaData).toHaveBeenCalledTimes(1);
                expect(onLoadedMediaError).toHaveBeenCalledTimes(0);
                expect(onCommentsLoad).toHaveBeenCalledTimes(1);
                expect(onUsersLoad).toHaveBeenCalledTimes(1);
                expect(onPlaylistsLoad).toHaveBeenCalledTimes(1);
                expect(onLikedMediaFailedRequest).toHaveBeenCalledTimes(0);
                expect(onLikedMedia).toHaveBeenCalledTimes(0);
                expect(onDislikedMediaFailedRequest).toHaveBeenCalledTimes(0);
                expect(onDislikedMedia).toHaveBeenCalledTimes(0);
                expect(onReportedMedia).toHaveBeenCalledTimes(0);
                expect(onPlaylistCreationCompleted).toHaveBeenCalledTimes(0);
                expect(onPlaylistCreationFailed).toHaveBeenCalledTimes(0);
                expect(onMediaPlaylistAdditionCompleted).toHaveBeenCalledTimes(0);
                expect(onMediaPlaylistAdditionFailed).toHaveBeenCalledTimes(0);
                expect(onMediaPlaylistRemovalCompleted).toHaveBeenCalledTimes(0);
                expect(onMediaPlaylistRemovalFailed).toHaveBeenCalledTimes(0);
                expect(onCopiedMediaLink).toHaveBeenCalledTimes(0);
                expect(onCopiedEmbedMediaCode).toHaveBeenCalledTimes(0);
                expect(onMediaDelete).toHaveBeenCalledTimes(0);
                expect(onMediaDeleteFail).toHaveBeenCalledTimes(0);
                expect(onCommentDeleteFail).toHaveBeenCalledTimes(0);
                expect(onCommentDelete).toHaveBeenCalledTimes(0);
                expect(onCommentSubmitFail).toHaveBeenCalledTimes(0);
                expect(onCommentSubmit).toHaveBeenCalledTimes(0);

                expect(store.isVideo()).toBeTruthy();

                expect(store.get('users')).toStrictEqual(USERS_RESULTS);
                expect(store.get('playlists')).toStrictEqual([
                    {
                        playlist_id: PLAYLIST_ID,
                        title: 'PLAYLIST_TITLE',
                        description: 'PLAYLIST_DECRIPTION',
                        add_date: 'PLAYLIST_ADD_DATE',
                        media_list: ['PLAYLIST_MEDIA_ID'],
                    },
                ]);
                expect(store.get('media-load-error-type')).toBe(null);
                expect(store.get('media-load-error-message')).toBe(null);
                expect(store.get('media-comments')).toStrictEqual(MEDIA_COMMENTS_RESULTS);
                expect(store.get('media-data')).toBe(MEDIA_DATA);
                expect(store.get('media-id')).toBe(MEDIA_ID);
                expect(store.get('media-url')).toBe(MEDIA_DATA.url);
                expect(store.get('media-edit-subtitle-url')).toBe(MEDIA_DATA.add_subtitle_url);
                expect(store.get('media-likes')).toBe(MEDIA_DATA.likes);
                expect(store.get('media-dislikes')).toBe(MEDIA_DATA.dislikes);
                expect(store.get('media-summary')).toBe(MEDIA_DATA.summary);
                expect(store.get('media-categories')).toStrictEqual(MEDIA_DATA.categories_info);
                expect(store.get('media-tags')).toStrictEqual(MEDIA_DATA.tags_info);
                expect(store.get('media-type')).toBe(MEDIA_DATA.media_type);
                expect(store.get('media-original-url')).toBe(MEDIA_DATA.original_media_url);
                expect(store.get('media-thumbnail-url')).toBe(MEDIA_DATA.thumbnail_url);
                expect(store.get('user-liked-media')).toBe(false);
                expect(store.get('user-disliked-media')).toBe(false);
                expect(store.get('media-author-thumbnail-url')).toBe(`/${MEDIA_DATA.author_thumbnail}`);
                expect(store.get('playlist-data')).toBe(PLAYLIST_DATA);
                expect(store.get('playlist-id')).toBe(PLAYLIST_ID);
                expect(store.get('playlist-next-media-url')).toBe(
                    `${PLAYLIST_DATA.playlist_media[2].url}&pl=${PLAYLIST_ID}`
                );
                expect(store.get('playlist-previous-media-url')).toBe(
                    `${PLAYLIST_DATA.playlist_media[0].url}&pl=${PLAYLIST_ID}`
                );
            });

            test('Action type: "LIKE_MEDIA"', () => {
                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock post request
                (postRequest as jest.Mock).mockImplementation(
                    (_url, _postData, _configData, _sync, successCallback, _failCallback) =>
                        successCallback({ data: {} })
                );

                handler({ type: 'LIKE_MEDIA' });

                // Verify postRequest was called with correct parameters
                expect(postRequest).toHaveBeenCalledWith(
                    `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}/actions`,
                    { type: 'like' },
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.likeActionResponse,
                    expect.any(Function)
                );

                expect(onLikedMedia).toHaveBeenCalledTimes(1);

                expect(store.get('media-likes')).toBe(MEDIA_DATA.likes + 1);
                expect(store.get('media-dislikes')).toBe(MEDIA_DATA.dislikes);
                expect(store.get('user-liked-media')).toBe(true);
                expect(store.get('user-disliked-media')).toBe(false);
            });

            test('Action type: "DISLIKE_MEDIA"', () => {
                handler({ type: 'DISLIKE_MEDIA' });

                expect(postRequest).toHaveBeenCalledTimes(0);
                expect(onDislikedMedia).toHaveBeenCalledTimes(0);

                expect(store.get('media-likes')).toBe(MEDIA_DATA.likes + 1);
                expect(store.get('media-dislikes')).toBe(MEDIA_DATA.dislikes);
                expect(store.get('user-liked-media')).toBe(true);
                expect(store.get('user-disliked-media')).toBe(false);
            });

            test('Action type: "REPORT_MEDIA"', () => {
                const REPORT_DESCRIPTION = 'REPORT_DESCRIPTION';

                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock post request
                (postRequest as jest.Mock).mockImplementation(
                    (_url, _postData, _configData, _sync, successCallback, _failCallback) =>
                        successCallback({ data: {} })
                );

                handler({ type: 'REPORT_MEDIA', reportDescription: REPORT_DESCRIPTION });

                // Verify postRequest was called with correct parameters
                expect(postRequest).toHaveBeenCalledWith(
                    `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}/actions`,
                    { type: 'report', extra_info: REPORT_DESCRIPTION },
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.reportActionResponse,
                    store.reportActionResponse
                );

                expect(onReportedMedia).toHaveBeenCalledTimes(1);
            });

            test('Action type: "COPY_SHARE_LINK"', () => {
                document.execCommand = jest.fn(); // @deprecated
                const inputElement = document.createElement('input');
                handler({ type: 'COPY_SHARE_LINK', inputElement });
                expect(onCopiedMediaLink).toHaveBeenCalledTimes(1);
                expect(document.execCommand).toHaveBeenCalledWith('copy');
            });

            test('Action type: "COPY_EMBED_MEDIA_CODE"', () => {
                document.execCommand = jest.fn(); // @deprecated
                const inputElement = document.createElement('input');
                handler({ type: 'COPY_EMBED_MEDIA_CODE', inputElement });
                expect(onCopiedEmbedMediaCode).toHaveBeenCalledTimes(1);
                expect(document.execCommand).toHaveBeenCalledWith('copy');
            });

            describe('Action type: "REMOVE_MEDIA"', () => {
                const mockCSRFtoken = 'test-csrf-token';

                beforeEach(() => {
                    // Mock the CSRF token
                    (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                    jest.useFakeTimers();
                });

                afterEach(() => {
                    // Verify deleteRequest was called with correct parameters
                    expect(deleteRequest).toHaveBeenCalledWith(
                        `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}`,
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        store.removeMediaResponse,
                        store.removeMediaFail
                    );

                    // Fast-forward time
                    jest.advanceTimersByTime(100);

                    jest.useRealTimers();
                });

                test('Successful', () => {
                    // Mock delete request
                    (deleteRequest as jest.Mock).mockImplementation(
                        (_url, _configData, _sync, successCallback, _failCallback) => successCallback({ status: 204 })
                    );

                    handler({ type: 'REMOVE_MEDIA' });

                    expect(onMediaDelete).toHaveBeenCalledTimes(1);
                    expect(onMediaDelete).toHaveBeenCalledWith(MEDIA_ID);
                });

                test('Failed', () => {
                    // Mock delete request
                    (deleteRequest as jest.Mock).mockImplementation(
                        (_url, _configData, _sync, _successCallback, failCallback) => failCallback({})
                    );

                    handler({ type: 'REMOVE_MEDIA' });

                    expect(onMediaDeleteFail).toHaveBeenCalledTimes(1);
                });
            });

            describe('Action type: "SUBMIT_COMMENT"', () => {
                const COMMENT_TEXT = 'COMMENT_TEXT';
                const COMMENT_UID = 'COMMENT_UID';

                const mockCSRFtoken = 'test-csrf-token';

                beforeEach(() => {
                    // Mock the CSRF token
                    (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                    jest.useFakeTimers();
                });

                afterEach(() => {
                    // Verify postRequest was called with correct parameters
                    expect(postRequest).toHaveBeenCalledWith(
                        `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}/comments`,
                        { text: COMMENT_TEXT },
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        store.submitCommentResponse,
                        store.submitCommentFail
                    );

                    // Fast-forward time
                    jest.advanceTimersByTime(100);

                    jest.useRealTimers();
                });

                test('Successful', () => {
                    // Mock post request
                    (postRequest as jest.Mock).mockImplementation(
                        (_url, _postData, _configData, _sync, successCallback, _failCallback) =>
                            successCallback({ data: { uid: COMMENT_UID }, status: 201 })
                    );

                    handler({ type: 'SUBMIT_COMMENT', commentText: COMMENT_TEXT });

                    expect(onCommentSubmit).toHaveBeenCalledTimes(1);
                    expect(onCommentSubmit).toHaveBeenCalledWith(COMMENT_UID);
                });

                test('Failed', () => {
                    // Mock post request
                    (postRequest as jest.Mock).mockImplementation(
                        (_url, _postData, _configData, _sync, _successCallback, failCallback) => failCallback()
                    );

                    handler({ type: 'SUBMIT_COMMENT', commentText: COMMENT_TEXT });

                    expect(onCommentSubmitFail).toHaveBeenCalledTimes(1);
                });
            });

            describe('Action type: "DELETE_COMMENT"', () => {
                const COMMENT_ID = 'COMMENT_ID';

                const mockCSRFtoken = 'test-csrf-token';

                beforeEach(() => {
                    // Mock the CSRF token
                    (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                    jest.useFakeTimers();
                });

                afterEach(() => {
                    // Verify deleteRequest was called with correct parameters
                    expect(deleteRequest).toHaveBeenCalledWith(
                        `${sampleMediaCMSConfig.api.media}/${MEDIA_ID}/comments/${COMMENT_ID}`,
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        store.removeCommentResponse,
                        store.removeCommentFail
                    );

                    // Fast-forward time
                    jest.advanceTimersByTime(100);

                    jest.useRealTimers();
                });

                test('Successful', () => {
                    // Mock delete request
                    (deleteRequest as jest.Mock).mockImplementation(
                        (_url, _configData, _sync, successCallback, _failCallback) => successCallback({ status: 204 })
                    );

                    handler({ type: 'DELETE_COMMENT', commentId: COMMENT_ID });

                    expect(onCommentDelete).toHaveBeenCalledTimes(1);
                });

                test('Failed', () => {
                    // Mock delete request
                    (deleteRequest as jest.Mock).mockImplementation(
                        (_url, _configData, _sync, _successCallback, failCallback) => failCallback()
                    );

                    handler({ type: 'DELETE_COMMENT', commentId: COMMENT_ID });

                    expect(onCommentDeleteFail).toHaveBeenCalledTimes(1);
                });
            });

            describe('Action type: "CREATE_PLAYLIST"', () => {
                const NEW_PLAYLIST_DATA = {
                    title: 'NEW_PLAYLIST_DATA_TITLE',
                    description: 'NEW_PLAYLIST_DATA_DESCRIPTION',
                };

                const mockCSRFtoken = 'test-csrf-token';

                beforeEach(() => {
                    // Mock the CSRF token
                    (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);
                });

                afterEach(() => {
                    // Verify postRequest was called with correct parameters
                    expect(postRequest).toHaveBeenCalledWith(
                        sampleMediaCMSConfig.api.playlists,
                        NEW_PLAYLIST_DATA,
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        expect.any(Function),
                        expect.any(Function)
                    );
                });

                test('Successful', () => {
                    const NEW_PLAYLIST_RESPONSE_DATA = { uid: 'COMMENT_UID' };

                    // Mock post request
                    (postRequest as jest.Mock).mockImplementation(
                        (_url, _postData, _configData, _sync, successCallback, _failCallback) =>
                            successCallback({ data: NEW_PLAYLIST_RESPONSE_DATA, status: 201 })
                    );

                    handler({ type: 'CREATE_PLAYLIST', playlist_data: NEW_PLAYLIST_DATA });

                    // Verify postRequest was called with correct parameters
                    expect(postRequest).toHaveBeenCalledWith(
                        sampleMediaCMSConfig.api.playlists,
                        NEW_PLAYLIST_DATA,
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        expect.any(Function),
                        expect.any(Function)
                    );

                    expect(onPlaylistCreationCompleted).toHaveBeenCalledTimes(1);
                    expect(onPlaylistCreationCompleted).toHaveBeenCalledWith(NEW_PLAYLIST_RESPONSE_DATA);
                });

                test('Failed', () => {
                    // Mock post request
                    (postRequest as jest.Mock).mockImplementation(
                        (_url, _postData, _configData, _sync, _successCallback, failCallback) => failCallback()
                    );

                    handler({ type: 'CREATE_PLAYLIST', playlist_data: NEW_PLAYLIST_DATA });

                    expect(onPlaylistCreationFailed).toHaveBeenCalledTimes(1);
                });
            });

            describe('Action type: "ADD_MEDIA_TO_PLAYLIST"', () => {
                const NEW_PLAYLIST_MEDIA_ID = 'NEW_PLAYLIST_MEDIA_ID';
                const mockCSRFtoken = 'test-csrf-token';

                beforeEach(() => {
                    // Mock the CSRF token
                    (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);
                });

                afterEach(() => {
                    // Verify postRequest was called with correct parameters
                    expect(putRequest).toHaveBeenCalledWith(
                        `${sampleMediaCMSConfig.api.playlists}/${PLAYLIST_ID}`,
                        { type: 'add', media_friendly_token: NEW_PLAYLIST_MEDIA_ID },
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        expect.any(Function),
                        expect.any(Function)
                    );
                });

                test('Successful', () => {
                    // Mock put request
                    (putRequest as jest.Mock).mockImplementation(
                        (_url, _putData, _configData, _sync, successCallback, _failCallback) =>
                            successCallback({ data: {} })
                    );

                    handler({
                        type: 'ADD_MEDIA_TO_PLAYLIST',
                        playlist_id: PLAYLIST_ID,
                        media_id: NEW_PLAYLIST_MEDIA_ID,
                    });

                    expect(onMediaPlaylistAdditionCompleted).toHaveBeenCalledTimes(1);
                });

                test('Failed', () => {
                    // Mock put request
                    (putRequest as jest.Mock).mockImplementation(
                        (_url, _putData, _configData, _sync, _successCallback, failCallback) => failCallback()
                    );

                    handler({
                        type: 'ADD_MEDIA_TO_PLAYLIST',
                        playlist_id: PLAYLIST_ID,
                        media_id: NEW_PLAYLIST_MEDIA_ID,
                    });

                    expect(onMediaPlaylistAdditionFailed).toHaveBeenCalledTimes(1);
                });
            });

            describe('Action type: "REMOVE_MEDIA_FROM_PLAYLIST"', () => {
                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                afterEach(() => {
                    // Verify postRequest was called with correct parameters
                    expect(putRequest).toHaveBeenCalledWith(
                        `${sampleMediaCMSConfig.api.playlists}/${PLAYLIST_ID}`,
                        { type: 'remove', media_friendly_token: MEDIA_ID },
                        { headers: { 'X-CSRFToken': mockCSRFtoken } },
                        false,
                        expect.any(Function),
                        expect.any(Function)
                    );
                });

                test('Successful', () => {
                    // Mock put request
                    (putRequest as jest.Mock).mockImplementation(
                        (_url, _putData, _configData, _sync, successCallback, _failCallback) =>
                            successCallback({ data: {} })
                    );

                    handler({ type: 'REMOVE_MEDIA_FROM_PLAYLIST', playlist_id: PLAYLIST_ID, media_id: MEDIA_ID });

                    expect(onMediaPlaylistRemovalCompleted).toHaveBeenCalledTimes(1);
                });

                test('Failed', () => {
                    // Mock put request
                    (putRequest as jest.Mock).mockImplementation(
                        (_url, _putData, _configData, _sync, _successCallback, failCallback) => failCallback()
                    );

                    handler({ type: 'REMOVE_MEDIA_FROM_PLAYLIST', playlist_id: PLAYLIST_ID, media_id: MEDIA_ID });

                    expect(onMediaPlaylistRemovalFailed).toHaveBeenCalledTimes(1);
                });
            });

            test('Action type: "APPEND_NEW_PLAYLIST"', () => {
                const NEW_USER_PLAYLIST = {
                    add_date: 'PLAYLIST_ADD_DATE_2',
                    description: 'PLAYLIST_DECRIPTION_2',
                    media_list: ['PLAYLIST_MEDIA_ID'],
                    playlist_id: 'PLAYLIST_ID',
                    title: 'PLAYLIST_TITLE_2',
                };

                handler({ type: 'APPEND_NEW_PLAYLIST', playlist_data: NEW_USER_PLAYLIST });

                expect(onPlaylistsLoad).toHaveBeenCalledTimes(1);

                expect(store.get('playlists')).toStrictEqual([
                    {
                        add_date: 'PLAYLIST_ADD_DATE',
                        description: 'PLAYLIST_DECRIPTION',
                        media_list: ['PLAYLIST_MEDIA_ID'],
                        playlist_id: PLAYLIST_ID,
                        title: 'PLAYLIST_TITLE',
                    },
                    NEW_USER_PLAYLIST,
                ]);
            });
        });
    });
});
