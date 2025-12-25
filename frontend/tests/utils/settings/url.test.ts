import { init, pages } from '../../../src/static/js/utils/settings/url';

const urlConfig = (pages_url?: any) => {
    init(pages_url);
    return pages();
};

describe('utils/settings', () => {
    describe('url', () => {
        const baseGlobal = {
            profileId: 'john',
            site: {
                url: 'https://example.com/',
                devEnv: false,
            },
            url: {
                home: '/',
                admin: '/admin',
                error404: '/404',
                latestMedia: '/latest',
                featuredMedia: '/featured',
                recommendedMedia: '/recommended',
                signin: '/signin',
                signout: '/signout',
                register: '/register',
                changePassword: '/password',
                members: '/members',
                search: '/search',
                likedMedia: '/liked',
                history: '/history',
                addMedia: '/add',
                editChannel: '/edit/channel',
                editProfile: '/edit/profile',
                tags: '/tags',
                categories: '/categories',
                manageMedia: '/manage/media',
                manageUsers: '/manage/users',
                manageComments: '/manage/comments',
            },
            user: {
                is: { anonymous: false, admin: false },
                pages: { media: '/u/john', about: '/u/john/about', playlists: '/u/john/playlists' },
            },
        } as const;

        test('Authenticated non-admin user', () => {
            const cfg = urlConfig(baseGlobal);

            expect(cfg).toStrictEqual({
                profileId: 'john',
                site: { url: 'https://example.com/', devEnv: false },
                url: {
                    home: '/',
                    admin: '/admin',
                    error404: '/404',
                    latestMedia: '/latest',
                    featuredMedia: '/featured',
                    recommendedMedia: '/recommended',
                    signin: '/signin',
                    signout: '/signout',
                    register: '/register',
                    changePassword: '/password',
                    members: '/members',
                    search: '/search',
                    likedMedia: '/liked',
                    history: '/history',
                    addMedia: '/add',
                    editChannel: '/edit/channel',
                    editProfile: '/edit/profile',
                    tags: '/tags',
                    categories: '/categories',
                    manageMedia: '/manage/media',
                    manageUsers: '/manage/users',
                    manageComments: '/manage/comments',
                },
                user: {
                    is: { anonymous: false, admin: false },
                    pages: { media: '/u/john', about: '/u/john/about', playlists: '/u/john/playlists' },
                },
            });
        });

        test('Admin user', () => {
            const cfg = urlConfig({
                ...baseGlobal,
                user: { ...baseGlobal.user, is: { anonymous: false, admin: true } },
            });
            expect(cfg.user.is).toStrictEqual({ anonymous: false, admin: true });
        });

        test('Anonymous user', () => {
            const cfg = urlConfig({
                ...baseGlobal,
                user: { ...baseGlobal.user, is: { anonymous: true, admin: true } },
            });
            expect(cfg.user.is).toStrictEqual({ anonymous: true, admin: true });
        });
    });
});
