import { pagesConfig } from '../../../src/static/js/utils/settings/pages';

describe('utils/settings', () => {
    describe('pages', () => {
        test('Defaults: all known pages disabled with default titles', () => {
            const cfg = pagesConfig();
            expect(cfg).toStrictEqual({
                latest: { enabled: false, title: 'Recent uploads' },
                featured: { enabled: false, title: 'Featured' },
                recommended: { enabled: false, title: 'Recommended' },
                members: { enabled: false, title: 'Members' },
                liked: { enabled: false, title: 'Liked media' },
                history: { enabled: false, title: 'History' },
            });
        });

        test('Enables each page unless explicitly disabled', () => {
            const cfg = pagesConfig({
                latest: {},
                featured: { enabled: true },
                recommended: { enabled: false },
                members: { enabled: undefined },
                liked: { enabled: null as any },
                history: { enabled: 0 as any },
            });

            expect(cfg.latest.enabled).toBe(true);
            expect(cfg.featured.enabled).toBe(true);
            expect(cfg.recommended.enabled).toBe(false);
            expect(cfg.members.enabled).toBe(true);
            expect(cfg.liked.enabled).toBe(true);
            expect(cfg.history.enabled).toBe(true);
        });

        test('Trims provided titles and preserves defaults when title is undefined', () => {
            const cfg = pagesConfig({
                latest: { title: '  Latest  ' },
                featured: { title: '\nFeatured' },
                recommended: {},
            });

            expect(cfg.latest.title).toBe('Latest');
            expect(cfg.featured.title).toBe('Featured');
            expect(cfg.recommended.title).toBe('Recommended');
        });

        test('Ignores non-string titles and keeps defaults', () => {
            const cfg = pagesConfig({
                latest: { title: null as any },
                featured: { title: 123 as any },
                recommended: { title: true as any },
            });

            expect(cfg.latest.title).toBe('Recent uploads');
            expect(cfg.featured.title).toBe('Featured');
            expect(cfg.recommended.title).toBe('Recommended');
        });

        test('Ignores unknown keys in settings', () => {
            const cfg = pagesConfig({
                // @ts-ignore
                unknownKey: { enabled: true, title: 'X' },
                latest: { enabled: true },
            });

            expect(cfg.latest.enabled).toBe(true);
            expect((cfg as any).unknownKey).toBeUndefined();
        });

        test('Does not mutate the input settings object', () => {
            const input = {
                latest: { enabled: false, title: ' A ' },
                featured: { enabled: true, title: ' B ' },
            };
            const snapshot = JSON.parse(JSON.stringify(input));
            pagesConfig(input);
            expect(input).toStrictEqual(snapshot);
        });
    });
});
