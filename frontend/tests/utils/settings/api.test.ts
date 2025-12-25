import { init, endpoints } from '../../../src/static/js/utils/settings/api';

const apiConfig = (url: any, ep: any) => {
    init(url, ep);
    return endpoints();
};

describe('utils/settings', () => {
    describe('api', () => {
        const sampleGlobal = {
            site: { api: 'https://example.com/api/v1///' },
            // The endpoints below intentionally contain leading slashes to ensure they are stripped
            api: {
                media: '/media/',
                members: '/users//',
                playlists: '/playlists',
                liked: '/user/liked',
                history: '/user/history',
                tags: '/tags',
                categories: '/categories',
                manage_media: '/manage/media',
                manage_users: '/manage/users',
                manage_comments: '/manage/comments',
                search: '/search',
            },
        } as const;

        test('Trims trailing slashes on base and ensures single slash joins', () => {
            const cfg = apiConfig(sampleGlobal.site.api, sampleGlobal.api);
            // @todo: Check again the cases of trailing slashes
            expect(cfg.media).toBe('https://example.com/api/v1/media/');
            expect(cfg.users).toBe('https://example.com/api/v1/users//');
        });

        test('Adds featured/recommended query to media variants', () => {
            const cfg = apiConfig(sampleGlobal.site.api, sampleGlobal.api);
            expect(cfg.featured).toBe('https://example.com/api/v1/media/?show=featured');
            expect(cfg.recommended).toBe('https://example.com/api/v1/media/?show=recommended');
        });

        test('Builds nested user, archive, manage maps', () => {
            const cfg = apiConfig(sampleGlobal.site.api, sampleGlobal.api);

            expect(cfg.user.liked).toBe('https://example.com/api/v1/user/liked');
            expect(cfg.user.history).toBe('https://example.com/api/v1/user/history');
            expect(cfg.user.playlists).toBe('https://example.com/api/v1/playlists?author=');

            expect(cfg.archive.tags).toBe('https://example.com/api/v1/tags');
            expect(cfg.archive.categories).toBe('https://example.com/api/v1/categories');

            expect(cfg.manage.media).toBe('https://example.com/api/v1/manage/media');
            expect(cfg.manage.users).toBe('https://example.com/api/v1/manage/users');
            expect(cfg.manage.comments).toBe('https://example.com/api/v1/manage/comments');
        });

        test('Builds search endpoints with expected query fragments', () => {
            const cfg = apiConfig(sampleGlobal.site.api, sampleGlobal.api);
            expect(cfg.search.query).toBe('https://example.com/api/v1/search?q=');
            expect(cfg.search.titles).toBe('https://example.com/api/v1/search?show=titles&q=');
            expect(cfg.search.tag).toBe('https://example.com/api/v1/search?t=');
            expect(cfg.search.category).toBe('https://example.com/api/v1/search?c=');
        });

        test('Handles base url with path and endpoint with existing query', () => {
            const cfg = apiConfig('https://example.com/base/', {
                media: 'items?x=1',
                playlists: '/pls/',
                liked: 'me/liked',
                categories: '/c',
                search: '/s',
            });
            expect(cfg.media).toBe('https://example.com/base/items?x=1');
            expect(cfg.playlists).toBe('https://example.com/base/pls/');
            expect(cfg.user.liked).toBe('https://example.com/base/me/liked');
            expect(cfg.archive.categories).toBe('https://example.com/base/c');
            expect(cfg.search.query).toBe('https://example.com/base/s?q=');
        });
    });
});
