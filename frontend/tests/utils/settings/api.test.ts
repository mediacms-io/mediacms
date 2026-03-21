import { apiConfig } from '../../../src/static/js/utils/settings/api';

const sampleGlobal = {
    site: { api: 'http://example.com/api///' },
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
        test('Builds search endpoints with expected query fragments', () => {
            const cfg = apiConfig(sampleGlobal.site.api, sampleGlobal.api as any);

            expect(cfg).toStrictEqual({
                media: 'http://example.com/api/v1/media/',
                featured: 'http://example.com/api/v1/media/?show=featured',
                recommended: 'http://example.com/api/v1/media/?show=recommended',
                playlists: 'http://example.com/api/v1/playlists',
                users: 'http://example.com/api/v1/users',
                user: {
                    liked: 'http://example.com/api/v1/user/liked',
                    history: 'http://example.com/api/v1/user/history',
                    playlists: 'http://example.com/api/v1/playlists?author=',
                },
                archive: {
                    tags: 'http://example.com/api/v1/tags',
                    categories: 'http://example.com/api/v1/categories',
                },
                manage: {
                    media: 'http://example.com/api/v1/manage/media',
                    users: 'http://example.com/api/v1/manage/users',
                    comments: 'http://example.com/api/v1/manage/comments',
                },
                search: {
                    query: 'http://example.com/api/v1/search?q=',
                    titles: 'http://example.com/api/v1/search?show=titles&q=',
                    tag: 'http://example.com/api/v1/search?t=',
                    category: 'http://example.com/api/v1/search?c=',
                },
            });
        });

        test('Handles base url with path and endpoint with existing query', () => {
            const base = 'https://domain.com/base/';

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
            };

            const cfg = apiConfig(base, endpoints as any);

            expect(cfg).toStrictEqual({
                media: 'https://domain.com/base/items?x=1',
                featured: 'https://domain.com/base/items?x=1?show=featured',
                recommended: 'https://domain.com/base/items?x=1?show=recommended',
                playlists: 'https://domain.com/base/pls/',
                users: 'https://domain.com/base/users',
                user: {
                    liked: 'https://domain.com/base/me/liked',
                    history: 'https://domain.com/base/me/history',
                    playlists: 'https://domain.com/base/pls/?author=',
                },
                archive: {
                    tags: 'https://domain.com/base/t',
                    categories: 'https://domain.com/base/c',
                },
                manage: {
                    media: 'https://domain.com/base/m/media',
                    users: 'https://domain.com/base/m/users',
                    comments: 'https://domain.com/base/m/comments',
                },
                search: {
                    query: 'https://domain.com/base/s?q=',
                    titles: 'https://domain.com/base/s?show=titles&q=',
                    tag: 'https://domain.com/base/s?t=',
                    category: 'https://domain.com/base/s?c=',
                },
            });
        });
    });
});
