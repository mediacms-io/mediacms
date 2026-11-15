import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, findByText } from '../../_support/compD_dom';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { LayoutContext } from '../../../src/static/js/utils/contexts/LayoutContext';
import { ThemeContext } from '../../../src/static/js/utils/contexts/ThemeContext';
import { MemberContext } from '../../../src/static/js/utils/contexts/MemberContext';
import { HeaderContext } from '../../../src/static/js/utils/contexts/HeaderContext';
import { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';
import { HeaderLeft } from '../../../src/static/js/components/page-layout/PageHeader/HeaderLeft';
import { HeaderRight } from '../../../src/static/js/components/page-layout/PageHeader/HeaderRight';
import { HeaderThemeSwitcher } from '../../../src/static/js/components/page-layout/PageHeader/HeaderThemeSwitcher';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;

function layout(extra: { [key: string]: any } = {}) {
    return { enabledSidebar: true, toggleMobileSearch: jest.fn(), toggleSidebar: jest.fn(), ...extra } as any;
}

function theme(extra: { [key: string]: any } = {}) {
    return { logo: '/logo.svg', currentThemeMode: 'light', changeThemeMode: jest.fn(), themeModeSwitcher: { enabled: true, position: 'header' }, ...extra } as any;
}

describe('components/page-layout', () => {
    beforeEach(() => {
        pageStore.__reset({ 'config-contents': { header: { onLogoRight: '', right: '' } } });
    });

    describe('HeaderLeft', () => {
        function render(layoutValue: any) {
            return renderIntoContainer(
                <LayoutContext.Provider value={layoutValue}>
                    <ThemeContext.Provider value={theme()}>
                        <HeaderLeft />
                    </ThemeContext.Provider>
                </LayoutContext.Provider>
            );
        }

        test('Renders logo linked home and wires toggle buttons', () => {
            const value = layout();
            const { container, unmount } = render(value);
            const logoLink = container.querySelector('.logo a') as HTMLAnchorElement;
            expect(logoLink.getAttribute('href')).toBe('/');
            expect(logoLink.title).toBe('MediaCMS Test');
            click(container.querySelector('.close-search-field button'));
            expect(value.toggleMobileSearch).toHaveBeenCalled();
            click(container.querySelector('.toggle-sidebar button'));
            expect(value.toggleSidebar).toHaveBeenCalled();
            expect(container.querySelector('.on-logo-right')).toBeNull();
            unmount();
        });

        test('Hides sidebar toggle and renders custom html next to the logo', () => {
            pageStore.__set('config-contents', { header: { onLogoRight: '<em>Beta</em>' } });
            const { container, unmount } = render(layout({ enabledSidebar: false }));
            expect(container.querySelector('.toggle-sidebar')).toBeNull();
            expect(container.querySelector('.on-logo-right')?.innerHTML).toBe('<em>Beta</em>');
            unmount();
        });
    });

    describe('HeaderThemeSwitcher', () => {
        test('Clicking the row, changing the input and pressing Enter toggle the theme once each', () => {
            const value = theme({ currentThemeMode: 'dark' });
            const { container, unmount } = renderIntoContainer(
                <ThemeContext.Provider value={value}>
                    <HeaderThemeSwitcher />
                </ThemeContext.Provider>
            );
            expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
            click(container.querySelector('.theme-switch > span'));
            expect(value.changeThemeMode).toHaveBeenCalledTimes(1);
            click(container.querySelector('input'));
            expect(value.changeThemeMode).toHaveBeenCalledTimes(2);
            act(() => {
                container.querySelector('.theme-switch')!.dispatchEvent(new KeyboardEvent('keypress', { keyCode: 13, charCode: 13, bubbles: true }));
            });
            expect(value.changeThemeMode).toHaveBeenCalledTimes(3);
            unmount();
        });
    });

    describe('HeaderRight', () => {
        const anonymous = {
            is: { anonymous: true, admin: false },
            can: { login: true, register: true, addMedia: false },
            pages: {},
        };

        function render(member: any, header: any, layoutValue = layout()) {
            return renderIntoContainer(
                <UserProvider>
                    <LayoutContext.Provider value={layoutValue}>
                        <ThemeContext.Provider value={theme()}>
                            <MemberContext.Provider value={member}>
                                <HeaderContext.Provider value={header}>
                                    <HeaderRight />
                                </HeaderContext.Provider>
                            </MemberContext.Provider>
                        </ThemeContext.Provider>
                    </LayoutContext.Provider>
                </UserProvider>
            );
        }

        test('Anonymous users get sign in and register links and a settings popup', () => {
            const header = {
                hasThemeSwitcher: false,
                popupNavItems: { top: [], middle: [{ link: '/accounts/login/', text: 'Sign in', itemType: 'link' }], bottom: [] },
            };
            const layoutValue = layout();
            const { container, unmount } = render(anonymous, header, layoutValue);
            expect(container.querySelector('.user-options')?.className).toBe('user-options visible-only-in-extra-small');
            const signIn = container.querySelector('.sign-in') as HTMLAnchorElement;
            expect(signIn.getAttribute('href')).toBe('/accounts/login/');
            expect(signIn.className).toBe('button-link sign-in hidden-only-in-extra-small');
            expect(container.querySelector('.register-link')?.getAttribute('href')).toBe('/accounts/signup/');
            expect(container.querySelector('[title="Upload media"]')).toBeNull();
            click(container.querySelector('.mobile-search-toggle button'));
            expect(layoutValue.toggleMobileSearch).toHaveBeenCalled();
            click(container.querySelector('.user-options button'));
            expect(Array.from(container.querySelectorAll('.user-options a')).map((a) => a.textContent)).toEqual(['Sign in']);
            unmount();
        });

        test('Header theme switcher changes link classes and adds a theme page', () => {
            const header = {
                hasThemeSwitcher: true,
                popupNavItems: {
                    top: [],
                    middle: [{ itemType: 'open-subpage', text: 'Switch theme', buttonAttr: { className: 'change-page', 'data-page-id': 'switch-theme' } }],
                    bottom: [],
                },
            };
            const { container, unmount } = render({ ...anonymous, can: { login: true, register: false } }, header);
            expect(container.querySelector('.user-options')?.className).toBe('user-options');
            expect(container.querySelector('.sign-in')?.className).toBe('button-link sign-in hidden-only-in-small');
            expect(container.querySelector('.register-wrap')).toBeNull();
            click(container.querySelector('.user-options button'));
            click(container.querySelector('[data-page-id="switch-theme"]'));
            expect(container.querySelector('.theme-switch')).not.toBeNull();
            unmount();
        });

        test('Signed in users get thumbnail menu, upload popup and custom html', () => {
            pageStore.__set('config-contents', { header: { right: '<span class="x">x</span>' } });
            const member = {
                is: { anonymous: false, admin: true },
                can: { addMedia: true },
                username: 'john',
                name: 'John',
                pages: { about: '/user/john/about' },
            };
            const header = {
                hasThemeSwitcher: false,
                popupNavItems: { top: [{ link: '/user/john', text: 'My media' }], middle: [{ link: '/edit', text: 'Edit profile' }], bottom: [] },
            };
            const { container, unmount } = render(member, header);
            expect(container.querySelector('.user-thumb')).not.toBeNull();
            expect(container.querySelector('.sign-in-wrap')).toBeNull();
            expect(container.querySelector('.on-header-right')?.innerHTML).toBe('<span class="x">x</span>');

            const uploadWrap = (container.querySelector('[title="Upload media"]') as HTMLElement).parentElement as HTMLElement;
            click(uploadWrap.querySelector('button'));
            expect(Array.from(uploadWrap.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual(['/upload', '/record_screen']);

            click(container.querySelector('.user-thumb button'));
            const top = container.querySelector('.user-menu-top-link') as HTMLAnchorElement;
            expect(top.getAttribute('href')).toBe('/user/john/about');
            expect(container.querySelector('.user-thumb .username')?.textContent).toBe('John');
            expect(container.querySelectorAll('.user-thumb hr').length).toBe(1);
            expect(findByText(container, '.user-thumb a', 'Edit profile')).toBeDefined();
            unmount();
        });

        test('Falls back to a generic user label', () => {
            const member = { is: { anonymous: false }, can: { addMedia: false }, pages: {} };
            const header = { hasThemeSwitcher: false, popupNavItems: { top: [], middle: [], bottom: [] } };
            const { container, unmount } = render(member, header);
            click(container.querySelector('.user-thumb button'));
            expect(container.querySelector('.user-thumb .username')?.textContent).toBe('User');
            expect(container.querySelector('.user-thumb hr')).toBeNull();
            unmount();
        });
    });
});
