import { apiConfig } from '../../../src/static/js/utils/settings/api';

const sampleGlobal = {
    site: { api: 'https://example.com/api///' },
    // endpoints below intentionally contain leading slashes to ensure they are stripped
    api: {
        media: '/v1/media/',
        playlists: '/v1/playlists',
        members: '/v1/users',
        liked: '/v1/user/liked',
        history: '/v1/user/history',
        tags: '/v1/tags',
        categories: '/v1/categories',
        manage_media: '/v1/manage/media',
        manage_users: '/v1/manage/users',
        manage_comments: '/v1/manage/comments',
        search: '/v1/search',
    },
} as const;

describe('utils/settings', () => {
    describe('api', () => {
        test('trims trailing slashes on base and ensures single slash joins', () => {
            const cfg = apiConfig(sampleGlobal.site.api as any, sampleGlobal.api as any);
            expect(cfg.media).toBe('https://example.com/api/v1/media/');
            // base should not end with a slash and endpoint leading slash stripped
            expect(cfg.users).toBe('https://example.com/api/v1/users');
        });

        test('adds featured/recommended query to media variants', () => {
            const cfg = apiConfig(sampleGlobal.site.api as any, sampleGlobal.api as any);
            expect(cfg.featured).toBe('https://example.com/api/v1/media/?show=featured');
            expect(cfg.recommended).toBe('https://example.com/api/v1/media/?show=recommended');
        });

        test('builds nested user, archive, manage maps', () => {
            const cfg = apiConfig(sampleGlobal.site.api as any, sampleGlobal.api as any);
            expect(cfg.user.liked).toBe('https://example.com/api/v1/user/liked');
            expect(cfg.user.history).toBe('https://example.com/api/v1/user/history');
            expect(cfg.user.playlists).toBe('https://example.com/api/v1/playlists?author=');

            expect(cfg.archive.tags).toBe('https://example.com/api/v1/tags');
            expect(cfg.archive.categories).toBe('https://example.com/api/v1/categories');

            expect(cfg.manage.media).toBe('https://example.com/api/v1/manage/media');
            expect(cfg.manage.users).toBe('https://example.com/api/v1/manage/users');
            expect(cfg.manage.comments).toBe('https://example.com/api/v1/manage/comments');
        });

        test('builds search endpoints with expected query fragments', () => {
            const cfg = apiConfig(sampleGlobal.site.api as any, sampleGlobal.api as any);
            expect(cfg.search.query).toBe('https://example.com/api/v1/search?q=');
            expect(cfg.search.titles).toBe('https://example.com/api/v1/search?show=titles&q=');
            expect(cfg.search.tag).toBe('https://example.com/api/v1/search?t=');
            expect(cfg.search.category).toBe('https://example.com/api/v1/search?c=');
        });

        test('handles base url with path and endpoint with existing query', () => {
            const base = 'https://example.com/base/';
            const endpoints = {
                media: 'items?x=1',
                playlists: '/pls/',
                members: 'users',
                liked: 'me/liked',
                history: 'me/history',
                tags: 't',
                categories: '/c',
                manage_media: 'm/media',
                manage_users: 'm/users',
                manage_comments: 'm/comments',
                search: '/s',
            } as any;
            const cfg = apiConfig(base as any, endpoints);
            expect(cfg.media).toBe('https://example.com/base/items?x=1');
            expect(cfg.playlists).toBe('https://example.com/base/pls/');
            expect(cfg.user.liked).toBe('https://example.com/base/me/liked');
            expect(cfg.archive.categories).toBe('https://example.com/base/c');
            expect(cfg.search.query).toBe('https://example.com/base/s?q=');
        });
    });
});
