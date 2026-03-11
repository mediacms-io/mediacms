import { urlConfig } from '../../../src/static/js/utils/settings/url';

describe('utils/settings', () => {
    describe('url', () => {
        const base = {
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

        test('non-admin authenticated user: admin hidden, signout/changePassword visible, manage visible', () => {
            const cfg = urlConfig(base as any);
            expect(cfg.admin).toBe('');
            expect(cfg.signout).toBe('/signout');
            expect(cfg.changePassword).toBe('/password');
            expect(cfg.manage.media).toBe('/manage/media');
            expect(cfg.manage.users).toBe('/manage/users');
            expect(cfg.manage.comments).toBe('/manage/comments');
        });

        test('anonymous user: admin, signout, changePassword, manage all hidden', () => {
            const cfg = urlConfig({
                ...base,
                user: { ...base.user, is: { anonymous: true, admin: false } },
            } as any);
            expect(cfg.admin).toBe('');
            expect(cfg.signout).toBe('');
            expect(cfg.changePassword).toBe('');
            expect(cfg.manage.media).toBe('');
            expect(cfg.manage.users).toBe('');
            expect(cfg.manage.comments).toBe('');
        });

        test('admin user: admin visible', () => {
            const cfg = urlConfig({
                ...base,
                user: { ...base.user, is: { anonymous: false, admin: true } },
            } as any);
            expect(cfg.admin).toBe('/admin');
        });

        test('embed URL strips trailing slashes from site.url', () => {
            const cfg1 = urlConfig(base as any);
            expect(cfg1.embed).toBe('https://example.com/embed?m=');

            const cfg2 = urlConfig({ ...base, site: { ...base.site, url: 'https://example.com////' } } as any);
            expect(cfg2.embed).toBe('https://example.com/embed?m=');
        });

        test('search URLs are composed correctly', () => {
            const cfg = urlConfig(base as any);
            expect(cfg.search.base).toBe('/search');
            expect(cfg.search.query).toBe('/search?q=');
            expect(cfg.search.tag).toBe('/search?t=');
            expect(cfg.search.category).toBe('/search?c=');
        });

        test('profile URLs: devEnv=false use site.url + profileId', () => {
            const cfg = urlConfig(base as any);
            expect(cfg.profile.media).toBe('https://example.com/user/john');
            expect(cfg.profile.about).toBe('https://example.com/user/john/about');
            expect(cfg.profile.playlists).toBe('https://example.com/user/john/playlists');
            expect(cfg.profile.shared_by_me).toBe('https://example.com/user/john/shared_by_me');
            expect(cfg.profile.shared_with_me).toBe('https://example.com/user/john/shared_with_me');
        });

        test('profile URLs: devEnv=true use user.pages and append shared paths', () => {
            const cfg = urlConfig({ ...base, site: { ...base.site, devEnv: true } } as any);
            expect(cfg.profile.media).toBe('/u/john');
            expect(cfg.profile.about).toBe('/u/john/about');
            expect(cfg.profile.playlists).toBe('/u/john/playlists');
            expect(cfg.profile.shared_by_me).toBe('/u/john/shared_by_me');
            expect(cfg.profile.shared_with_me).toBe('/u/john/shared_with_me');
        });

        test('passes through archive and user URLs', () => {
            const cfg = urlConfig(base as any);
            expect(cfg.user).toStrictEqual({
                liked: '/liked',
                history: '/history',
                addMedia: '/add',
                editChannel: '/edit/channel',
                editProfile: '/edit/profile',
            });
            expect(cfg.archive).toStrictEqual({ tags: '/tags', categories: '/categories' });
        });
    });
});
