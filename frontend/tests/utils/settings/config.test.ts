import { config } from '../../../src/static/js/utils/settings/config';

describe('utils/settings', () => {
    describe('config', () => {
        const baseGlobal = {
            profileId: 'john',
            site: {
                id: 'my-site',
                url: 'https://example.com/',
                api: 'https://example.com/api/',
                title: 'Example',
                theme: { mode: 'dark', switch: { enabled: true, position: 'sidebar' } },
                logo: {
                    lightMode: { img: '/img/light.png', svg: '/img/light.svg' },
                    darkMode: { img: '/img/dark.png', svg: '/img/dark.svg' },
                },
                devEnv: false,
                useRoundedCorners: true,
                version: '2.0.0',
                taxonomies: {
                    tags: { enabled: true, title: 'Topic Tags' },
                    categories: { enabled: false, title: 'Kinds' },
                },
                pages: {
                    latest: { enabled: true, title: 'Recent uploads' },
                    featured: { enabled: true, title: 'Featured picks' },
                    recommended: { enabled: false, title: 'You may like' },
                },
                userPages: {
                    members: { enabled: true, title: 'People' },
                    liked: { enabled: true, title: 'Favorites' },
                    history: { enabled: true, title: 'Watched' },
                },
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
            api: {
                media: 'v1/media/',
                playlists: 'v1/playlists',
                members: 'v1/users',
                liked: 'v1/user/liked',
                history: 'v1/user/history',
                tags: 'v1/tags',
                categories: 'v1/categories',
                manage_media: 'v1/manage/media',
                manage_users: 'v1/manage/users',
                manage_comments: 'v1/manage/comments',
                search: 'v1/search',
            },
            contents: {
                notifications: {
                    messages: {
                        addToLiked: 'Yay',
                        removeFromLiked: 'Oops',
                        addToDisliked: 'nay',
                        removeFromDisliked: 'ok',
                    },
                },
            },
            pages: {
                home: { sections: { latest: { title: 'Latest T' } } },
                search: { advancedFilters: true },
                media: { categoriesWithTitle: true, hideViews: true, related: { initialSize: 5 } },
                profile: { htmlInDescription: true, includeHistory: true, includeLikedMedia: true },
            },
            features: {
                mediaItem: { hideAuthor: true, hideViews: false, hideDate: true },
                media: {
                    actions: {
                        like: true,
                        dislike: true,
                        report: true,
                        comment: true,
                        comment_mention: true,
                        download: true,
                        save: true,
                        share: true,
                    },
                    shareOptions: ['embed', 'email', 'invalid'],
                },
                playlists: { mediaTypes: ['audio'] },
                sideBar: { hideHomeLink: false, hideTagsLink: true, hideCategoriesLink: false },
                embeddedVideo: { initialDimensions: { width: 640, height: 360 } },
                headerBar: { hideLogin: false, hideRegister: true },
            },
            user: {
                is: { anonymous: false, admin: true },
                name: ' John ',
                username: ' john ',
                thumbnail: ' /img/j.png ',
                can: {
                    changePassword: true,
                    deleteProfile: true,
                    addComment: true,
                    mentionComment: true,
                    deleteComment: true,
                    editMedia: true,
                    deleteMedia: true,
                    editSubtitle: true,
                    manageMedia: true,
                    manageUsers: true,
                    manageComments: true,
                    contactUser: true,
                    canSeeMembersPage: true,
                    usersNeedsToBeApproved: false,
                    addMedia: true,
                    editProfile: true,
                    readComment: true,
                },
                pages: { about: '/u/john/about ', media: '/u/john ', playlists: '/u/john/playlists ' },
            },
        } as const;

        test('merges enabled pages and passes titles into options.pages.home sections', () => {
            const cfg = config(baseGlobal);
            expect(cfg.enabled.pages.latest).toStrictEqual({ enabled: true, title: 'Recent uploads' });
            expect(cfg.enabled.pages.featured).toStrictEqual({ enabled: true, title: 'Featured picks' });
            expect(cfg.enabled.pages.recommended).toStrictEqual({ enabled: false, title: 'You may like' });
            expect(cfg.enabled.pages.members).toStrictEqual({ enabled: true, title: 'People' });
            expect(cfg.options.pages.home.sections.latest.title).toBe('Latest T');
            expect(cfg.options.pages.home.sections.featured.title).toBe('Featured picks');
        });

        test('produces api endpoints based on site.api and api endpoints', () => {
            const cfg = config(baseGlobal);
            expect(cfg.api.media).toBe('https://example.com/api/v1/media/');
            expect(cfg.api.user.liked).toBe('https://example.com/api/v1/user/liked');
            expect(cfg.api.search.query).toBe('https://example.com/api/v1/search?q=');
        });

        test('member and url manage links reflect user and feature flags', () => {
            const cfg = config(baseGlobal);
            expect(cfg.member.is).toStrictEqual({ admin: true, anonymous: false });
            expect(cfg.member.can).toMatchObject({
                manageMedia: true,
                manageUsers: true,
                manageComments: true,
                likeMedia: true,
            });
            expect(cfg.url.manage.media).toBe('/manage/media');
            expect(cfg.url.signout).toBe('/signout');
            // admin visible
            expect(cfg.url.admin).toBe('/admin');
        });

        test('theme and site defaults propagate correctly', () => {
            const cfg = config(baseGlobal);
            expect(cfg.theme.mode).toBe('dark');
            expect(cfg.theme.switch.position).toBe('sidebar');
            expect(cfg.theme.logo.darkMode.img).toBe('/img/dark.png');
            expect(cfg.site.id).toBe('my-site');
            expect(cfg.site.version).toBe('2.0.0');
        });

        test('memoizes and returns the same object instance on repeated calls', () => {
            const first = config(baseGlobal);
            const second = config(baseGlobal);
            expect(second).toBe(first);
        });

        test('url profile paths use site.url when not in dev env', () => {
            const cfg = config(baseGlobal);
            expect(cfg.url.profile.media).toBe('https://example.com/user/john');
            expect(cfg.url.embed).toBe('https://example.com/embed?m=');
        });
    });
});
