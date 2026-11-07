import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as PlaylistPageActions from '../../../src/static/js/utils/actions/PlaylistPageActions';

describe('utils/actions', () => {
    describe('PlaylistPageActions', () => {
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
            ['loadPlaylistData', [], { type: 'LOAD_PLAYLIST_DATA' }],
            ['toggleSave', [], { type: 'TOGGLE_SAVE' }],
            ['updatePlaylist', [{ title: 'T' }], { type: 'UPDATE_PLAYLIST', playlist_data: { title: 'T' } }],
            ['removePlaylist', [], { type: 'REMOVE_PLAYLIST' }],
            ['removedMediaFromPlaylist', ['m1', 'p1'], { type: 'MEDIA_REMOVED_FROM_PLAYLIST', media_id: 'm1', playlist_id: 'p1' }],
            ['reorderedMediaInPlaylist', [[1, 2]], { type: 'PLAYLIST_MEDIA_REORDERED', playlist_media: [1, 2] }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (PlaylistPageActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
