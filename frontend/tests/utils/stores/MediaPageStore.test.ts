import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
    deleteRequest: jest.fn(),
}));

const api = 'https://example.com/api/v1';
const csrfConfig = { headers: { 'X-CSRFToken': 'csrf-3' } };

function loadStore(options: { search?: string; path?: string; mediaId?: string | null; overrides?: any } = {}) {
    const { search = '', path = '/view', mediaId = 'abc', overrides = {} } = options;
    installMediaCMSGlobal({ site: { url: 'https://example.com' }, ...overrides });
    if (null !== mediaId) {
        (window as any).MediaCMS.mediaId = mediaId;
    }
    window.history.replaceState(null, '', path + search);

    let store: any;
    let actions: any;
    let requests: any;
    let PageStore: any;
    jest.isolateModules(() => {
        requests = require('../../../src/static/js/utils/helpers/requests');
        PageStore = require('../../../src/static/js/utils/stores/PageStore').default;
        store = require('../../../src/static/js/utils/stores/MediaPageStore').default;
        actions = require('../../../src/static/js/utils/actions/MediaPageActions');
    });

    return {
        store,
        actions,
        PageStore,
        getRequest: requests.getRequest as jest.Mock,
        postRequest: requests.postRequest as jest.Mock,
        putRequest: requests.putRequest as jest.Mock,
        deleteRequest: requests.deleteRequest as jest.Mock,
    };
}

function findCall(mock: jest.Mock, url: string) {
    const call = mock.mock.calls.find((c) => c[0] === url);
    if (!call) {
        throw new Error('No request for ' + url);
    }
    return call;
}

const mediaData = {
    url: 'https://example.com/view?m=abc',
    add_subtitle_url: '/subtitles/abc',
    likes: 4,
    dislikes: 2,
    summary: 'Summary',
    categories_info: [{ title: 'Cat' }],
    tags_info: [{ title: 'Tag' }],
    media_type: 'video',
    original_media_url: '/orig.mp4',
    thumbnail_url: '/thumb.jpg',
    author_thumbnail: '/media/author.jpg',
    reported_times: 0,
};

function loadedStore(options: Parameters<typeof loadStore>[0] = {}, data: any = mediaData) {
    const ctx = loadStore(options);
    ctx.actions.loadMediaData();
    findCall(ctx.getRequest, api + '/media/abc')[2]({ data: { ...data } });
    return ctx;
}

describe('utils/stores', () => {
    describe('MediaPageStore', () => {
        beforeAll(() => {
            document.cookie = 'csrftoken=csrf-3';
        });

        afterAll(() => {
            document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            window.history.replaceState(null, '', '/');
            localStorage.clear();
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        describe('Loading media data', () => {
            test('Returns defaults before loading', () => {
                const { store } = loadStore();
                expect(store.get('media-data')).toBeNull();
                expect(store.get('media-url')).toBe('N/A');
                expect(store.get('media-likes')).toBe('N/A');
                expect(store.get('media-dislikes')).toBe('N/A');
                expect(store.get('media-summary')).toBeNull();
                expect(store.get('media-categories')).toStrictEqual([]);
                expect(store.get('media-tags')).toStrictEqual([]);
                expect(store.get('media-type')).toBeNull();
                expect(store.get('media-original-url')).toBeNull();
                expect(store.get('media-thumbnail-url')).toBeNull();
                expect(store.get('media-author-thumbnail-url')).toBeNull();
                expect(store.get('media-edit-subtitle-url')).toBeNull();
                expect(store.get('media-comments')).toStrictEqual([]);
                expect(store.get('playlists')).toStrictEqual([]);
                expect(store.get('users')).toStrictEqual([]);
                expect(store.get('media-load-error-type')).toBeNull();
                expect(store.get('media-load-error-message')).toBeNull();
                expect(store.get('user-liked-media')).toBe(false);
                expect(store.get('user-disliked-media')).toBe(false);
                expect(store.get('playlist-data')).toBeNull();
                expect(store.get('playlist-id')).toBeNull();
                expect(store.get('playlist-next-media-url')).toBeNull();
                expect(store.get('playlist-previous-media-url')).toBeNull();
                expect(store.get('unknown')).toBeNull();
                expect(store.isVideo()).toBe(false);
            });

            test('LOAD_MEDIA_DATA without playlist emits loaded_page_playlist_data and requests the media', () => {
                const { store, actions, getRequest } = loadStore();
                const listener = jest.fn();
                store.on('loaded_page_playlist_data', listener);

                actions.loadMediaData();

                expect(listener).toHaveBeenCalledTimes(1);
                expect(store.get('media-id')).toBe('abc');
                expect(getRequest).toHaveBeenCalledWith(api + '/media/abc', false, expect.any(Function), expect.any(Function));
            });

            test('Reads the media id from the m URL param when page config has none', () => {
                const { store, actions, getRequest } = loadStore({ mediaId: null, search: '?m=fromurl' });
                actions.loadMediaData();
                expect(store.get('media-id')).toBe('fromurl');
                expect(getRequest.mock.calls[0][0]).toBe(api + '/media/fromurl');
            });

            test('Warns and skips loading without any media id', () => {
                const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
                const { actions, getRequest } = loadStore({ mediaId: null });
                actions.loadMediaData();
                expect(getRequest).not.toHaveBeenCalled();
                expect(warn).toHaveBeenCalledWith('Invalid media id:', undefined);
            });

            test('Video data emits video events and loads playlists and comments', () => {
                const ctx = loadStore();
                const video = jest.fn();
                const media = jest.fn();
                ctx.store.on('loaded_video_data', video);
                ctx.store.on('loaded_media_data', media);

                ctx.actions.loadMediaData();
                findCall(ctx.getRequest, api + '/media/abc')[2]({ data: { ...mediaData } });

                expect(video).toHaveBeenCalledTimes(1);
                expect(media).toHaveBeenCalledTimes(1);
                expect(ctx.store.isVideo()).toBe(true);
                expect(ctx.getRequest.mock.calls.map((c) => c[0])).toStrictEqual([
                    api + '/media/abc',
                    api + '/playlists?author=john',
                    api + '/media/abc/comments',
                ]);
            });

            test('Audio data counts as video', () => {
                const { store } = loadedStore({}, { ...mediaData, media_type: 'audio' });
                expect(store.isVideo()).toBe(true);
            });

            test('Image data emits loaded_image_data', () => {
                const ctx = loadStore();
                const image = jest.fn();
                const video = jest.fn();
                ctx.store.on('loaded_image_data', image);
                ctx.store.on('loaded_video_data', video);
                ctx.actions.loadMediaData();
                ctx.getRequest.mock.calls[0][2]({ data: { ...mediaData, media_type: 'image' } });
                expect(image).toHaveBeenCalledTimes(1);
                expect(video).not.toHaveBeenCalled();
            });

            test('Loads users when comment mentions are enabled', () => {
                const ctx = loadedStore({ overrides: { features: { media: { actions: { comment_mention: true } } } } });
                expect(ctx.getRequest.mock.calls.map((c) => c[0])).toContain(api + '/users');

                const listener = jest.fn();
                ctx.store.on('users_load', listener);
                findCall(ctx.getRequest, api + '/users')[2]({ data: { count: 1, results: [{ username: 'jane' }] } });
                expect(ctx.store.get('users')).toStrictEqual([{ username: 'jane' }]);
                expect(listener).toHaveBeenCalledTimes(1);
            });

            test('Skips playlists and comments when user cannot save or read comments', () => {
                const ctx = loadedStore({
                    overrides: { user: { can: { readComment: false } }, features: { media: { actions: { save: false } } } },
                });
                expect(ctx.getRequest).toHaveBeenCalledTimes(1);
            });

            test('Skips extra requests in embed pages', () => {
                const ctx = loadedStore({ path: '/embed' });
                expect(ctx.getRequest).toHaveBeenCalledTimes(1);
            });

            test('Ignores empty media responses but still loads extras', () => {
                const ctx = loadStore();
                const media = jest.fn();
                ctx.store.on('loaded_media_data', media);
                ctx.actions.loadMediaData();
                ctx.getRequest.mock.calls[0][2](undefined);
                expect(media).not.toHaveBeenCalled();
                expect(ctx.store.get('media-data')).toBeNull();
            });

            test('Exposes loaded media fields', () => {
                const { store } = loadedStore();
                expect(store.get('media-data')).toStrictEqual(mediaData);
                expect(store.get('media-url')).toBe(mediaData.url);
                expect(store.get('media-edit-subtitle-url')).toBe('/subtitles/abc');
                expect(store.get('media-likes')).toBe(4);
                expect(store.get('media-dislikes')).toBe(2);
                expect(store.get('media-summary')).toBe('Summary');
                expect(store.get('media-categories')).toStrictEqual([{ title: 'Cat' }]);
                expect(store.get('media-tags')).toStrictEqual([{ title: 'Tag' }]);
                expect(store.get('media-type')).toBe('video');
                expect(store.get('media-original-url')).toBe('/orig.mp4');
                expect(store.get('media-thumbnail-url')).toBe('/thumb.jpg');
                expect(store.get('media-author-thumbnail-url')).toBe('https://example.com/media/author.jpg');
            });

            test.each([
                [{ type: 'network', error: 'e' }, 'network', "Αn error occurred while loading the media's data"],
                [{ type: 'private', message: 'Media is private' }, 'private', 'Media is private'],
                [{ type: 'unavailable', message: 'Media is unavailable' }, 'unavailable', 'Media is unavailable'],
            ])('Load error %j sets error type and message', (error, type, message) => {
                const ctx = loadStore();
                const listener = jest.fn();
                ctx.store.on('loaded_media_error', listener);
                ctx.actions.loadMediaData();
                ctx.getRequest.mock.calls[0][3](error);
                expect(ctx.store.get('media-load-error-type')).toBe(type);
                expect(ctx.store.get('media-load-error-message')).toBe(message);
                expect(listener).toHaveBeenCalledTimes(1);
            });

            test('Unknown load errors are ignored', () => {
                const ctx = loadStore();
                const listener = jest.fn();
                ctx.store.on('loaded_media_error', listener);
                ctx.actions.loadMediaData();
                ctx.getRequest.mock.calls[0][3]({ type: 'other' });
                ctx.getRequest.mock.calls[0][3]({});
                expect(listener).not.toHaveBeenCalled();
            });

            test('Error type and message can be set directly', () => {
                const { store } = loadStore();
                store.set('media-load-error-type', 'private');
                store.set('media-load-error-message', 'Nope');
                store.set('unknown', 'ignored');
                expect(store.get('media-load-error-type')).toBe('private');
                expect(store.get('media-load-error-message')).toBe('Nope');
            });
        });

        describe('Comments', () => {
            const comment = { uid: 'c1', text: 'First' };

            function withComments() {
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('comments_load', listener);
                findCall(ctx.getRequest, api + '/media/abc/comments')[2]({ data: { count: 1, results: [comment] } });
                expect(listener).toHaveBeenCalledTimes(1);
                return ctx;
            }

            test('Stores loaded comments and empty list when count is zero', () => {
                const ctx = withComments();
                expect(ctx.store.get('media-comments')).toStrictEqual([comment]);

                findCall(ctx.getRequest, api + '/media/abc/comments')[2]({ data: { count: 0, results: [comment] } });
                expect(ctx.store.get('media-comments')).toStrictEqual([]);
            });

            test('SUBMIT_COMMENT posts once at a time and prepends the created comment', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                const listener = jest.fn();
                ctx.store.on('comment_submit', listener);

                ctx.actions.submitComment('Hello');
                ctx.actions.submitComment('Again');

                expect(ctx.postRequest).toHaveBeenCalledTimes(1);
                expect(ctx.postRequest).toHaveBeenCalledWith(
                    api + '/media/abc/comments',
                    { text: 'Hello' },
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );

                ctx.postRequest.mock.calls[0][4]({ status: 201, data: { uid: 'c2', text: 'Hello' } });

                expect(listener).toHaveBeenCalledWith('c2');
                expect(ctx.store.get('media-comments').map((c: any) => c.uid)).toStrictEqual(['c2', 'c1']);

                ctx.actions.submitComment('Blocked');
                expect(ctx.postRequest).toHaveBeenCalledTimes(1);

                jest.advanceTimersByTime(100);
                ctx.actions.submitComment('Allowed');
                expect(ctx.postRequest).toHaveBeenCalledTimes(2);
            });

            test('SUBMIT_COMMENT ignores non-created responses', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                const listener = jest.fn();
                ctx.store.on('comment_submit', listener);
                ctx.actions.submitComment('Hello');
                ctx.postRequest.mock.calls[0][4]({ status: 200, data: { uid: 'x' } });
                expect(listener).not.toHaveBeenCalled();
                jest.runOnlyPendingTimers();
            });

            test('SUBMIT_COMMENT failure emits and unlocks after a delay', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                const listener = jest.fn();
                ctx.store.on('comment_submit_fail', listener);

                ctx.actions.submitComment('Hello');
                ctx.postRequest.mock.calls[0][5](new Error('x'));

                expect(listener).toHaveBeenCalledTimes(1);
                jest.advanceTimersByTime(100);
                ctx.actions.submitComment('Retry');
                expect(ctx.postRequest).toHaveBeenCalledTimes(2);
            });

            test('DELETE_COMMENT removes the comment on 204 and unlocks after a delay', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                const listener = jest.fn();
                ctx.store.on('comment_delete', listener);

                ctx.actions.deleteComment('c1');
                ctx.actions.deleteComment('c1');

                expect(ctx.deleteRequest).toHaveBeenCalledTimes(1);
                expect(ctx.deleteRequest).toHaveBeenCalledWith(
                    api + '/media/abc/comments/c1',
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );

                ctx.deleteRequest.mock.calls[0][3]({ status: 204 });

                expect(listener).toHaveBeenCalledWith('c1');
                expect(ctx.store.get('media-comments')).toStrictEqual([]);

                jest.advanceTimersByTime(100);
                ctx.actions.deleteComment('c9');
                expect(ctx.deleteRequest).toHaveBeenCalledTimes(2);
            });

            test('DELETE_COMMENT keeps comments on non-204 responses', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                ctx.actions.deleteComment('c1');
                ctx.deleteRequest.mock.calls[0][3]({ status: 500 });
                expect(ctx.store.get('media-comments')).toStrictEqual([comment]);
                jest.runOnlyPendingTimers();
            });

            test('DELETE_COMMENT failure emits with the comment id', () => {
                jest.useFakeTimers();
                const ctx = withComments();
                const listener = jest.fn();
                ctx.store.on('comment_delete_fail', listener);
                ctx.actions.deleteComment('c1');
                ctx.deleteRequest.mock.calls[0][4](new Error('x'));
                expect(listener).toHaveBeenCalledWith('c1');
                jest.advanceTimersByTime(100);
                ctx.actions.deleteComment('c1');
                expect(ctx.deleteRequest).toHaveBeenCalledTimes(2);
            });
        });

        describe('Media actions', () => {
            test('LIKE_MEDIA posts a like and increments likes once', () => {
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('liked_media', listener);

                ctx.actions.likeMedia();

                expect(ctx.postRequest).toHaveBeenCalledWith(
                    api + '/media/abc/actions',
                    { type: 'like' },
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );

                ctx.postRequest.mock.calls[0][4](new Error('ignored'));
                expect(listener).not.toHaveBeenCalled();

                ctx.postRequest.mock.calls[0][4]({ data: {} });

                expect(listener).toHaveBeenCalledTimes(1);
                expect(ctx.store.get('user-liked-media')).toBe(true);
                expect(ctx.store.get('media-likes')).toBe(5);

                ctx.actions.likeMedia();
                ctx.actions.dislikeMedia();
                expect(ctx.postRequest).toHaveBeenCalledTimes(1);
            });

            test('Like counts as one when media has no likes field', () => {
                const ctx = loadedStore({}, { media_type: 'video' });
                ctx.actions.likeMedia();
                ctx.postRequest.mock.calls[0][4]({ data: {} });
                expect(ctx.store.get('media-likes')).toBe(1);
            });

            test('LIKE_MEDIA failure emits liked_media_failed_request', () => {
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('liked_media_failed_request', listener);
                ctx.actions.likeMedia();
                ctx.postRequest.mock.calls[0][5]();
                expect(listener).toHaveBeenCalledTimes(1);
            });

            test('DISLIKE_MEDIA posts a dislike and increments dislikes', () => {
                const ctx = loadedStore();
                const listener = jest.fn();
                const failed = jest.fn();
                ctx.store.on('disliked_media', listener);
                ctx.store.on('disliked_media_failed_request', failed);

                ctx.actions.dislikeMedia();

                expect(ctx.postRequest.mock.calls[0][1]).toStrictEqual({ type: 'dislike' });
                ctx.postRequest.mock.calls[0][4](new Error('ignored'));
                ctx.postRequest.mock.calls[0][4]({ data: {} });
                ctx.postRequest.mock.calls[0][5]();

                expect(listener).toHaveBeenCalledTimes(1);
                expect(failed).toHaveBeenCalledTimes(1);
                expect(ctx.store.get('user-disliked-media')).toBe(true);
                expect(ctx.store.get('media-dislikes')).toBe(3);

                ctx.actions.likeMedia();
                expect(ctx.postRequest).toHaveBeenCalledTimes(1);
            });

            test('Dislike counts as one when media has no dislikes field', () => {
                const ctx = loadedStore({}, { media_type: 'video' });
                ctx.actions.dislikeMedia();
                ctx.postRequest.mock.calls[0][4]({ data: {} });
                expect(ctx.store.get('media-dislikes')).toBe(1);
            });

            test('REPORT_MEDIA posts the description and emits reported_media', () => {
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('reported_media', listener);

                ctx.actions.reportMedia('');
                expect(ctx.postRequest).not.toHaveBeenCalled();

                ctx.actions.reportMedia('bad content');

                expect(ctx.postRequest).toHaveBeenCalledWith(
                    api + '/media/abc/actions',
                    { type: 'report', extra_info: 'badcontent' },
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );

                ctx.postRequest.mock.calls[0][5](new Error('x'));
                expect(listener).not.toHaveBeenCalled();
                ctx.postRequest.mock.calls[0][4]({ data: {} });
                expect(listener).toHaveBeenCalledTimes(1);

                ctx.actions.reportMedia('again');
                expect(ctx.postRequest).toHaveBeenCalledTimes(1);
            });

            test('REPORT_MEDIA is skipped for already reported media', () => {
                const ctx = loadedStore({}, { ...mediaData, reported_times: 3 });
                ctx.actions.reportMedia('bad');
                expect(ctx.postRequest).not.toHaveBeenCalled();
            });

            test('Actions without a media id warn and do not post', () => {
                const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
                const ctx = loadStore({ mediaId: null });
                ctx.actions.likeMedia();
                ctx.actions.dislikeMedia();
                ctx.actions.reportMedia('x');
                expect(ctx.postRequest).not.toHaveBeenCalled();
                expect(warn).toHaveBeenCalledTimes(3);
            });

            test.each([
                ['copyShareLink', 'copied_media_link'],
                ['copyEmbedMediaCode', 'copied_embed_media_code'],
            ])('%s selects input, copies and emits %s', (actionName, eventName) => {
                const ctx = loadStore();
                const execCommand = jest.fn();
                (document as any).execCommand = execCommand;
                const listener = jest.fn();
                ctx.store.on(eventName, listener);
                const input = document.createElement('input');
                const select = jest.spyOn(input, 'select');

                ctx.actions[actionName]('not-an-element');
                expect(listener).not.toHaveBeenCalled();

                ctx.actions[actionName](input);

                expect(select).toHaveBeenCalledTimes(1);
                expect(execCommand).toHaveBeenCalledWith('copy');
                expect(listener).toHaveBeenCalledTimes(1);
                delete (document as any).execCommand;
            });

            test('REMOVE_MEDIA deletes once and emits media_delete on 204', () => {
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('media_delete', listener);

                ctx.actions.removeMedia();
                ctx.actions.removeMedia();

                expect(ctx.deleteRequest).toHaveBeenCalledTimes(1);
                expect(ctx.deleteRequest).toHaveBeenCalledWith(
                    api + '/media/abc',
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );

                ctx.deleteRequest.mock.calls[0][3]({ status: 200 });
                expect(listener).not.toHaveBeenCalled();
                ctx.deleteRequest.mock.calls[0][3]({ status: 204 });
                expect(listener).toHaveBeenCalledWith('abc');
            });

            test('REMOVE_MEDIA failure emits and allows a retry after a delay', () => {
                jest.useFakeTimers();
                const ctx = loadedStore();
                const listener = jest.fn();
                ctx.store.on('media_delete_fail', listener);

                ctx.actions.removeMedia();
                ctx.deleteRequest.mock.calls[0][4](new Error('x'));

                expect(listener).toHaveBeenCalledWith('abc');
                jest.advanceTimersByTime(100);
                ctx.actions.removeMedia();
                expect(ctx.deleteRequest).toHaveBeenCalledTimes(2);
            });
        });

        describe('User playlists', () => {
            const ownPlaylists = {
                count: 3,
                results: [
                    { user: 'john', url: '/playlists/P1', title: 'One', description: 'd1', add_date: 'x', api_url: '/api/v1/playlists/P1' },
                    { user: 'john', url: '/playlists/P2', title: 'Two', description: 'd2', add_date: 'y', api_url: '/api/v1/playlists/P2' },
                    { user: 'john', url: '/playlists/P3', title: 'Three', description: 'd3', add_date: 'z', api_url: '/api/v1/playlists/P3' },
                ],
            };

            function withPlaylists() {
                const ctx = loadedStore();
                findCall(ctx.getRequest, api + '/playlists?author=john')[2]({ data: ownPlaylists });
                findCall(ctx.getRequest, api + '/playlists/P1')[2]({
                    data: { playlist_media: [{ url: '/view?m=abc' }, { url: '/view?m=def' }, { url: '/bad' }] },
                });
                findCall(ctx.getRequest, api + '/playlists/P2')[2]({ data: { playlist_media: [] } });
                return ctx;
            }

            test('Builds playlist summaries with media tokens from playlist details', () => {
                const ctx = withPlaylists();
                const playlists = ctx.store.get('playlists');
                expect(playlists).toHaveLength(3);
                expect(playlists[0]).toStrictEqual({
                    playlist_id: 'P1',
                    title: 'One',
                    description: 'd1',
                    add_date: 'x',
                    media_list: ['abc', 'def'],
                });
                expect(playlists[1].media_list).toStrictEqual([]);
            });

            test('Empty playlist responses produce no playlists', () => {
                const ctx = loadedStore();
                findCall(ctx.getRequest, api + '/playlists?author=john')[2]({ data: { count: 0 } });
                expect(ctx.store.get('playlists')).toStrictEqual([]);
            });

            test('CREATE_PLAYLIST posts title and description and emits the outcome', () => {
                const ctx = loadedStore();
                const done = jest.fn();
                const failed = jest.fn();
                ctx.store.on('playlist_creation_completed', done);
                ctx.store.on('playlist_creation_failed', failed);

                ctx.actions.createPlaylist({ title: 'T', description: 'D', other: 1 });

                expect(ctx.postRequest).toHaveBeenCalledWith(
                    api + '/playlists',
                    { title: 'T', description: 'D' },
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );
                ctx.postRequest.mock.calls[0][4]({ data: { id: 1 } });
                ctx.postRequest.mock.calls[0][4](undefined);
                ctx.postRequest.mock.calls[0][5]();
                expect(done).toHaveBeenCalledWith({ id: 1 });
                expect(done).toHaveBeenCalledTimes(1);
                expect(failed).toHaveBeenCalledTimes(1);
            });

            test('ADD_MEDIA_TO_PLAYLIST appends the current media to the playlist', () => {
                const ctx = withPlaylists();
                const done = jest.fn();
                const failed = jest.fn();
                ctx.store.on('media_playlist_addition_completed', done);
                ctx.store.on('media_playlist_addition_failed', failed);

                ctx.actions.addMediaToPlaylist('P2', 'abc');

                expect(ctx.putRequest).toHaveBeenCalledWith(
                    api + '/playlists/P2',
                    { type: 'add', media_friendly_token: 'abc' },
                    csrfConfig,
                    false,
                    expect.any(Function),
                    expect.any(Function)
                );
                ctx.putRequest.mock.calls[0][4]({ status: 200 });
                ctx.putRequest.mock.calls[0][4](undefined);
                ctx.putRequest.mock.calls[0][5]();

                expect(ctx.store.get('playlists')[1].media_list).toStrictEqual(['abc']);
                expect(done).toHaveBeenCalledWith('P2');
                expect(done).toHaveBeenCalledTimes(1);
                expect(failed).toHaveBeenCalledTimes(1);
            });

            test('REMOVE_MEDIA_FROM_PLAYLIST drops the current media from the playlist', () => {
                const ctx = withPlaylists();
                const done = jest.fn();
                const failed = jest.fn();
                ctx.store.on('media_playlist_removal_completed', done);
                ctx.store.on('media_playlist_removal_failed', failed);

                ctx.actions.removeMediaFromPlaylist('P1', 'abc');

                expect(ctx.putRequest.mock.calls[0][1]).toStrictEqual({ type: 'remove', media_friendly_token: 'abc' });
                ctx.putRequest.mock.calls[0][4]({ status: 200 });
                ctx.putRequest.mock.calls[0][4](undefined);
                ctx.putRequest.mock.calls[0][5]();

                expect(ctx.store.get('playlists')[0].media_list).toStrictEqual(['def']);
                expect(done).toHaveBeenCalledWith('P1');
                expect(done).toHaveBeenCalledTimes(1);
                expect(failed).toHaveBeenCalledTimes(1);
            });

            test('APPEND_NEW_PLAYLIST adds the playlist and emits playlists_load', () => {
                const ctx = loadedStore();
                findCall(ctx.getRequest, api + '/playlists?author=john')[2]({ data: { count: 0 } });
                const listener = jest.fn();
                ctx.store.on('playlists_load', listener);

                ctx.actions.addNewPlaylist({ playlist_id: 'NEW', media_list: [] });

                expect(ctx.store.get('playlists')).toStrictEqual([{ playlist_id: 'NEW', media_list: [] }]);
                expect(listener).toHaveBeenCalledTimes(1);
            });
        });

        describe('Page playlist', () => {
            const playlist = {
                playlist_media: [
                    { friendly_token: 'aaa', url: '/view?m=aaa' },
                    { friendly_token: 'abc', url: '/view?m=abc' },
                    { friendly_token: 'zzz', url: '/view?m=zzz' },
                ],
            };

            function withPagePlaylist(mediaId = 'abc') {
                const ctx = loadStore({ search: '?m=' + mediaId + '&pl=PL1', mediaId });
                ctx.actions.loadMediaData();
                return ctx;
            }

            test('Requests the playlist referenced by the pl URL param', () => {
                const ctx = withPagePlaylist();
                expect(ctx.store.get('playlist-id')).toBe('PL1');
                expect(ctx.getRequest.mock.calls.map((c) => c[0])).toStrictEqual([api + '/playlists/PL1', api + '/media/abc']);
            });

            test('Keeps playlist data when the media belongs to it', () => {
                const ctx = withPagePlaylist();
                const viewer = jest.fn();
                const page = jest.fn();
                ctx.store.on('loaded_viewer_playlist_data', viewer);
                ctx.store.on('loaded_page_playlist_data', page);

                findCall(ctx.getRequest, api + '/playlists/PL1')[2]({ data: playlist });

                expect(ctx.store.get('playlist-data')).toBe(playlist);
                expect(ctx.store.get('playlist-id')).toBe('PL1');
                expect(viewer).toHaveBeenCalledTimes(1);
                expect(page).toHaveBeenCalledTimes(1);
                expect(ctx.store.get('playlist-next-media-url')).toBe('/view?m=zzz&pl=PL1');
                expect(ctx.store.get('playlist-previous-media-url')).toBe('/view?m=aaa&pl=PL1');
            });

            test('Drops the playlist when the media is not part of it', () => {
                const ctx = withPagePlaylist('other');
                findCall(ctx.getRequest, api + '/playlists/PL1')[2]({ data: playlist });
                expect(ctx.store.get('playlist-id')).toBeNull();
                expect(ctx.store.get('playlist-data')).toBeNull();
            });

            test('Drops the playlist on empty response and emits on error', () => {
                const ctx = withPagePlaylist();
                const page = jest.fn();
                const error = jest.fn();
                ctx.store.on('loaded_page_playlist_data', page);
                ctx.store.on('loaded_viewer_playlist_error', error);

                const call = findCall(ctx.getRequest, api + '/playlists/PL1');
                call[3]({ type: 'network' });
                expect(error).toHaveBeenCalledTimes(1);
                call[2](undefined);
                expect(ctx.store.get('playlist-id')).toBeNull();
                expect(page).toHaveBeenCalledTimes(2);
            });

            test('Ends at playlist edges unless loop is enabled', () => {
                const last = withPagePlaylist('zzz');
                findCall(last.getRequest, api + '/playlists/PL1')[2]({ data: playlist });
                expect(last.store.get('playlist-next-media-url')).toBeNull();

                const first = withPagePlaylist('aaa');
                findCall(first.getRequest, api + '/playlists/PL1')[2]({ data: playlist });
                expect(first.store.get('playlist-previous-media-url')).toBeNull();

                first.PageStore.get('browser-cache').set('loopPlaylist[PL1]', true);
                expect(first.store.get('playlist-previous-media-url')).toBe('/view?m=zzz&pl=PL1');
                expect(last.store.get('playlist-next-media-url')).toBe('/view?m=aaa&pl=PL1');
                localStorage.clear();
            });
        });
    });
});
