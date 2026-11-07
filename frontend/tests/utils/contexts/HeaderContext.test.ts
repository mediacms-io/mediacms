import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

function loadHeaderContextValue(overrides: Record<string, any> = {}) {
    installMediaCMSGlobal(overrides);
    let value: any;
    jest.isolateModules(() => {
        const React = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        const { HeaderConsumer } = require('../../../src/static/js/utils/contexts/HeaderContext');
        renderToStaticMarkup(
            React.createElement(HeaderConsumer, null, (v: any) => {
                value = v;
                return null;
            })
        );
    });
    return value;
}

describe('utils/contexts', () => {
    describe('HeaderContext', () => {
        afterEach(() => {
            delete (window as any).MediaCMS;
        });

        test('Admin member gets upload, media, sign out, profile, password and admin items', () => {
            const value = loadHeaderContextValue();

            expect(value.hasThemeSwitcher).toBe(false);

            expect(value.popupNavItems.top).toStrictEqual([
                {
                    link: '/upload',
                    icon: 'video_call',
                    text: 'Upload media',
                    itemAttr: { className: 'visible-only-in-small' },
                },
                { link: '/user/john', icon: 'video_library', text: 'My media' },
                { link: '/accounts/logout/', icon: 'exit_to_app', text: 'Sign out' },
            ]);

            expect(value.popupNavItems.middle).toStrictEqual([
                { link: '/user/john/edit', icon: 'brush', text: 'Edit profile' },
                { link: '/accounts/password/change/', icon: 'lock', text: 'Change password' },
            ]);

            expect(value.popupNavItems.bottom).toStrictEqual([
                { link: '/admin', icon: 'admin_panel_settings', text: 'MediaCMS administration' },
                { link: '/migrations', icon: 'move_to_inbox', text: 'Content migration' },
            ]);
        });

        test('Member without upload rights and password change gets only sign out and edit profile', () => {
            const value = loadHeaderContextValue({
                user: { is: { admin: false }, can: { addMedia: false, changePassword: false } },
            });

            expect(value.popupNavItems.top).toStrictEqual([
                { link: '/accounts/logout/', icon: 'exit_to_app', text: 'Sign out' },
            ]);
            expect(value.popupNavItems.middle).toStrictEqual([
                { link: '/user/john/edit', icon: 'brush', text: 'Edit profile' },
            ]);
            expect(value.popupNavItems.bottom).toStrictEqual([]);
        });

        test('Uploader without a media page does not get the my media item', () => {
            const value = loadHeaderContextValue({ user: { pages: { media: '' } } });
            expect(value.popupNavItems.top.map((i: any) => i.icon)).toStrictEqual(['video_call', 'exit_to_app']);
        });

        test('Admin without migrations url gets only the administration item', () => {
            const value = loadHeaderContextValue({ url: { migrations: undefined } });
            expect(value.popupNavItems.bottom.map((i: any) => i.icon)).toStrictEqual(['admin_panel_settings']);
        });

        test('Anonymous visitor with header theme switcher gets switcher, sign in and register', () => {
            const value = loadHeaderContextValue({
                user: { is: { anonymous: true, admin: false } },
                site: { theme: { switch: { enabled: true, position: 'header' } } },
            });

            expect(value.hasThemeSwitcher).toBe(true);
            expect(value.popupNavItems.top).toStrictEqual([]);
            expect(value.popupNavItems.middle).toStrictEqual([
                {
                    itemType: 'open-subpage',
                    icon: 'brightness_4',
                    iconPos: 'left',
                    text: 'Switch theme',
                    buttonAttr: { className: 'change-page', 'data-page-id': 'switch-theme' },
                },
                {
                    itemType: 'link',
                    icon: 'login',
                    iconPos: 'left',
                    text: 'Sign in',
                    link: '/accounts/login/',
                    linkAttr: { className: 'visible-only-in-small' },
                },
                {
                    itemType: 'link',
                    icon: 'person_add',
                    iconPos: 'left',
                    text: 'Register',
                    link: '/accounts/signup/',
                    linkAttr: { className: 'visible-only-in-small' },
                },
            ]);
            expect(value.popupNavItems.bottom).toStrictEqual([]);
        });

        test('Anonymous visitor without header switcher gets extra small only auth links', () => {
            const value = loadHeaderContextValue({ user: { is: { anonymous: true, admin: false } } });

            expect(value.hasThemeSwitcher).toBe(false);
            expect(value.popupNavItems.middle.map((i: any) => [i.icon, i.linkAttr.className])).toStrictEqual([
                ['login', 'visible-only-in-extra-small'],
                ['person_add', 'visible-only-in-extra-small'],
            ]);
        });

        test('Hidden login and register remove the anonymous auth links', () => {
            const value = loadHeaderContextValue({
                user: { is: { anonymous: true, admin: false } },
                features: { headerBar: { hideLogin: true, hideRegister: true } },
            });

            expect(value.popupNavItems.middle).toStrictEqual([]);
        });
    });
});
