import '../../_support/setupMediaCMS';
import * as stores from '../../../src/static/js/utils/stores';
import PageStore from '../../../src/static/js/utils/stores/PageStore';

describe('utils/stores', () => {
    describe('index', () => {
        test('Re-exports every store singleton', () => {
            expect(Object.keys(stores).sort()).toStrictEqual([
                'MediaPageStore',
                'PageStore',
                'PlaylistPageStore',
                'PlaylistViewStore',
                'ProfilePageStore',
                'SearchFieldStore',
                'VideoViewerStore',
            ]);
            expect(stores.PageStore).toBe(PageStore);
        });
    });
});
