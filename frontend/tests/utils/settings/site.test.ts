import { init, settings } from '../../../src/static/js/utils/settings/site';

const siteConfig = (sett?: any) => {
    init(sett);
    return settings();
};

describe('utils/settings', () => {
    describe('site', () => {
        test('Applies defaults when no settings provided', () => {
            const cfg = siteConfig();
            expect(cfg).toStrictEqual({
                id: 'media-cms',
                url: '',
                api: '',
                title: '',
                useRoundedCorners: true,
                version: '1.0.0',
            });
        });

        test('Trims string fields (id, url, api, title, version)', () => {
            const cfg = siteConfig({
                id: ' my-site ',
                url: ' https://example.com/ ',
                api: ' https://example.com/api/ ',
                title: ' Media CMS ',
                version: ' 2.3.4 ',
            });
            expect(cfg).toStrictEqual({
                id: 'my-site',
                url: 'https://example.com/',
                api: 'https://example.com/api/',
                title: 'Media CMS',
                useRoundedCorners: true,
                version: '2.3.4',
            });
        });

        test('Handles useRoundedCorners: defaults to true unless explicitly false', () => {
            expect(siteConfig({}).useRoundedCorners).toBe(true);
            expect(siteConfig({ useRoundedCorners: true }).useRoundedCorners).toBe(true);
            expect(siteConfig({ useRoundedCorners: false }).useRoundedCorners).toBe(false);
            // non-boolean should still evaluate to default true because only === false toggles it off
            expect(siteConfig({ useRoundedCorners: 'no' }).useRoundedCorners).toBe(true);
            expect(siteConfig({ useRoundedCorners: 0 }).useRoundedCorners).toBe(true);
            expect(siteConfig({ useRoundedCorners: null }).useRoundedCorners).toBe(true);
        });

        test('Is resilient to partial inputs and ignores extra properties', () => {
            const cfg = siteConfig({ id: ' x ', extra: 'y' });
            expect(cfg).toMatchObject({ id: 'x' });
            expect(Object.keys(cfg).sort()).toEqual(['api', 'id', 'title', 'url', 'useRoundedCorners', 'version']);
        });

        test('Does not mutate input object', () => {
            const input = { id: ' my-id ', useRoundedCorners: false };
            const copy = JSON.parse(JSON.stringify(input));
            siteConfig(input);
            expect(input).toEqual(copy);
        });
    });
});
