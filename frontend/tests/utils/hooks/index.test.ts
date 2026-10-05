import '../../_support/setupMediaCMS';
import * as hooks from '../../../src/static/js/utils/hooks';

describe('utils/hooks', () => {
    describe('index', () => {
        test('Re-exports every hook', () => {
            expect(Object.keys(hooks).sort()).toStrictEqual(
                [
                    'itemClassname',
                    'useBulkActions',
                    'useItem',
                    'useItemList',
                    'useItemListInlineSlider',
                    'useItemListLazyLoad',
                    'useItemListSync',
                    'useLayout',
                    'useManagementTableHeader',
                    'useMediaFilter',
                    'useMediaItem',
                    'usePopup',
                    'useTheme',
                    'useUser',
                ].sort()
            );
        });
    });
});
