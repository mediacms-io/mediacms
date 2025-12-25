import { init, settings } from '../../../src/static/js/utils/settings/sidebar';

const sidebarConfig = (sett?: any) => {
    init(sett);
    return settings();
};

describe('utils/settings', () => {
    describe('sidebar', () => {
        test('Defaults to all links visible when no settings provided', () => {
            const cfg = sidebarConfig();
            expect(cfg).toStrictEqual({ hideHomeLink: false, hideTagsLink: false, hideCategoriesLink: false });
        });

        test('Hides only those explicitly set to true', () => {
            const cfg1 = sidebarConfig({ hideHomeLink: true });
            expect(cfg1).toStrictEqual({ hideHomeLink: true, hideTagsLink: false, hideCategoriesLink: false });

            const cfg2 = sidebarConfig({ hideTagsLink: true });
            expect(cfg2).toStrictEqual({ hideHomeLink: false, hideTagsLink: true, hideCategoriesLink: false });

            const cfg3 = sidebarConfig({ hideCategoriesLink: true });
            expect(cfg3).toStrictEqual({ hideHomeLink: false, hideTagsLink: false, hideCategoriesLink: true });

            const cfgAll = sidebarConfig({ hideHomeLink: true, hideTagsLink: true, hideCategoriesLink: true });
            expect(cfgAll).toStrictEqual({ hideHomeLink: true, hideTagsLink: true, hideCategoriesLink: true });
        });

        test('Treats non-true values as false', () => {
            // false
            expect(sidebarConfig({ hideHomeLink: false }).hideHomeLink).toBe(false);
            // undefined
            expect(sidebarConfig({}).hideHomeLink).toBe(false);
            // null
            expect(sidebarConfig({ hideTagsLink: null }).hideTagsLink).toBe(false);
            // other types
            expect(sidebarConfig({ hideCategoriesLink: 'yes' }).hideCategoriesLink).toBe(false);
            expect(sidebarConfig({ hideCategoriesLink: 1 }).hideCategoriesLink).toBe(false);
        });

        test('Is resilient to partial inputs and ignores extra properties', () => {
            const cfg = sidebarConfig({ hideTagsLink: true, extra: 'prop' });
            expect(cfg).toStrictEqual({ hideHomeLink: false, hideTagsLink: true, hideCategoriesLink: false });
        });

        test('Does not mutate input object', () => {
            const input: any = { hideHomeLink: true };
            const copy = JSON.parse(JSON.stringify(input));
            sidebarConfig(input);
            expect(input).toStrictEqual(copy);
        });
    });
});
