import * as actions from '../../../src/static/js/utils/actions';
import * as MediaPageActions from '../../../src/static/js/utils/actions/MediaPageActions';
import * as VideoViewerActions from '../../../src/static/js/utils/actions/VideoViewerActions';

describe('utils/actions', () => {
    describe('index', () => {
        test('Re-exports every action module as a namespace', () => {
            expect(Object.keys(actions).sort()).toStrictEqual([
                'MediaPageActions',
                'PageActions',
                'PlaylistPageActions',
                'PlaylistViewActions',
                'ProfilePageActions',
                'SearchFieldActions',
                'VideoViewerActions',
            ]);
            expect(actions.MediaPageActions.likeMedia).toBe(MediaPageActions.likeMedia);
            expect(actions.VideoViewerActions.set_viewer_mode).toBe(VideoViewerActions.set_viewer_mode);
        });
    });
});
