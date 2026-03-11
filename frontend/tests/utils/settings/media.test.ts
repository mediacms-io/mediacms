import { mediaConfig } from '../../../src/static/js/utils/settings/media';

describe('utils/settings', () => {
    describe('media', () => {
        test('Defaults display flags to true when not hidden', () => {
            const cfg = mediaConfig();
            expect(cfg.item.displayAuthor).toBe(true);
            expect(cfg.item.displayViews).toBe(true);
            expect(cfg.item.displayPublishDate).toBe(true);
            expect(cfg.share.options).toEqual([]);
        });

        test('Respects hide flags for author, views and date', () => {
            const cfg = mediaConfig({ hideAuthor: true, hideViews: true, hideDate: true });
            expect(cfg.item.displayAuthor).toBe(false);
            expect(cfg.item.displayViews).toBe(false);
            expect(cfg.item.displayPublishDate).toBe(false);
        });

        test('Returns empty share options when not provided', () => {
            const cfg = mediaConfig({ hideAuthor: false }, undefined);
            expect(cfg.share.options).toEqual([]);
        });

        test('Filters share options to valid ones and trims whitespace', () => {
            const cfg = mediaConfig(undefined, [' embed ', 'email', '  email  '] as unknown as Array<
                'embed' | 'email' | undefined
            >);
            expect(cfg.share.options).toEqual(['embed', 'email', 'email']); // @todo: Revisit this.
        });

        test('Ignores falsy and invalid share options', () => {
            const cfg = mediaConfig(undefined, [undefined, '', '  ', 'invalid', 'share', 'EMBED'] as unknown as Array<
                'embed' | 'email' | undefined
            >);
            expect(cfg.share.options).toEqual([]);
        });
    });
});
