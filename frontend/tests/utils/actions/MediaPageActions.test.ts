import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as MediaPageActions from '../../../src/static/js/utils/actions/MediaPageActions';

describe('utils/actions', () => {
    describe('MediaPageActions', () => {
        const received: any[] = [];
        let token: string;

        beforeAll(() => {
            token = (Dispatcher as any).register((payload: any) => received.push(payload));
        });

        afterAll(() => {
            (Dispatcher as any).unregister(token);
        });

        beforeEach(() => {
            received.length = 0;
        });

        test.each([
            ['loadMediaData', [], { type: 'LOAD_MEDIA_DATA' }],
            ['likeMedia', [], { type: 'LIKE_MEDIA' }],
            ['dislikeMedia', [], { type: 'DISLIKE_MEDIA' }],
            ['reportMedia', [' spam  here '], { type: 'REPORT_MEDIA', reportDescription: 'spamhere' }],
            ['reportMedia', [undefined], { type: 'REPORT_MEDIA', reportDescription: '' }],
            ['reportMedia', [''], { type: 'REPORT_MEDIA', reportDescription: '' }],
            ['copyShareLink', ['input-el'], { type: 'COPY_SHARE_LINK', inputElement: 'input-el' }],
            ['copyEmbedMediaCode', ['input-el'], { type: 'COPY_EMBED_MEDIA_CODE', inputElement: 'input-el' }],
            ['removeMedia', [], { type: 'REMOVE_MEDIA' }],
            ['submitComment', ['Nice'], { type: 'SUBMIT_COMMENT', commentText: 'Nice' }],
            ['deleteComment', ['c1'], { type: 'DELETE_COMMENT', commentId: 'c1' }],
            ['createPlaylist', [{ title: 'P' }], { type: 'CREATE_PLAYLIST', playlist_data: { title: 'P' } }],
            ['addMediaToPlaylist', ['p1', 'm1'], { type: 'ADD_MEDIA_TO_PLAYLIST', playlist_id: 'p1', media_id: 'm1' }],
            ['removeMediaFromPlaylist', ['p1', 'm1'], { type: 'REMOVE_MEDIA_FROM_PLAYLIST', playlist_id: 'p1', media_id: 'm1' }],
            ['addNewPlaylist', [{ title: 'N' }], { type: 'APPEND_NEW_PLAYLIST', playlist_data: { title: 'N' } }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (MediaPageActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
