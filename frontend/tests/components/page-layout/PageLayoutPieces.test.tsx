import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { LayoutContext } from '../../../src/static/js/utils/contexts/LayoutContext';
import { ThemeContext } from '../../../src/static/js/utils/contexts/ThemeContext';
import { PageMain } from '../../../src/static/js/components/page-layout/PageMain';
import { PageSidebarContentOverlay } from '../../../src/static/js/components/page-layout/PageSidebarContentOverlay';
import { SidebarBottom } from '../../../src/static/js/components/page-layout/sidebar/SidebarBottom';
import { SidebarBelowNavigationMenu } from '../../../src/static/js/components/page-layout/sidebar/SidebarBelowNavigationMenu';
import { SidebarBelowThemeSwitcher } from '../../../src/static/js/components/page-layout/sidebar/SidebarBelowThemeSwitcher';
import { SidebarThemeSwitcher } from '../../../src/static/js/components/page-layout/sidebar/SidebarThemeSwitcher';
import { Logo as LogoComponent } from '../../../src/static/js/components/page-layout/PageHeader/Logo';

const Logo = LogoComponent as React.ComponentType<any>;

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;

describe('components/page-layout', () => {
    describe('PageMain', () => {
        test('Renders children and the overlay only when the sidebar is enabled', () => {
            const withSidebar = renderIntoContainer(
                <LayoutContext.Provider value={{ enabledSidebar: true } as any}>
                    <PageMain>
                        <p className="kid" />
                    </PageMain>
                </LayoutContext.Provider>
            );
            expect(withSidebar.container.querySelector('.page-main .kid')).not.toBeNull();
            expect(withSidebar.container.querySelector('.page-main .page-sidebar-content-overlay')).not.toBeNull();
            withSidebar.unmount();

            const without = renderIntoContainer(
                <LayoutContext.Provider value={{ enabledSidebar: false } as any}>
                    <PageMain />
                </LayoutContext.Provider>
            );
            expect(without.container.innerHTML).toBe('<div class="page-main"></div>');
            without.unmount();
        });
    });

    describe('PageSidebarContentOverlay', () => {
        test('Renders the overlay element', () => {
            const { container, unmount } = renderIntoContainer(<PageSidebarContentOverlay />);
            expect(container.innerHTML).toBe('<div class="page-sidebar-content-overlay"></div>');
            unmount();
        });
    });

    describe('Sidebar html blocks', () => {
        test.each([
            ['footer', SidebarBottom, 'page-sidebar-bottom'],
            ['belowNavMenu', SidebarBelowNavigationMenu, 'page-sidebar-under-nav-menus'],
            ['belowThemeSwitcher', SidebarBelowThemeSwitcher, 'page-sidebar-below-theme-switcher'],
        ] as Array<[string, React.ComponentType, string]>)('Renders %s html content when configured', (key, Component, className) => {
            pageStore.__reset({ 'config-contents': { sidebar: { [key]: '<b>Hi</b>' } } });
            const filled = renderIntoContainer(<Component />);
            expect(filled.container.innerHTML).toBe(`<div class="${className}"><b>Hi</b></div>`);
            filled.unmount();

            pageStore.__reset({ 'config-contents': { sidebar: { [key]: '' } } });
            const empty = renderIntoContainer(<Component />);
            expect(empty.container.innerHTML).toBe('');
            empty.unmount();
        });
    });

    describe('SidebarThemeSwitcher', () => {
        function render(value: { [key: string]: any }) {
            return renderIntoContainer(
                <ThemeContext.Provider value={value as any}>
                    <SidebarThemeSwitcher />
                </ThemeContext.Provider>
            );
        }

        test('Shows the switcher in the sidebar and toggles the theme', () => {
            const changeThemeMode = jest.fn();
            const { container, unmount } = render({
                currentThemeMode: 'dark',
                changeThemeMode,
                themeModeSwitcher: { enabled: true, position: 'sidebar' },
            });
            const icons = container.querySelectorAll('.theme-icon');
            expect(icons[0].className).toBe('theme-icon');
            expect(icons[1].className).toBe('theme-icon active');
            expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
            click(container.querySelector('input'));
            expect(changeThemeMode).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Marks light icon active in light mode', () => {
            const { container, unmount } = render({ currentThemeMode: 'light', changeThemeMode: jest.fn(), themeModeSwitcher: { enabled: true, position: 'sidebar' } });
            expect(container.querySelectorAll('.theme-icon')[0].className).toBe('theme-icon active');
            unmount();
        });

        test.each([
            [{ enabled: false, position: 'sidebar' }],
            [{ enabled: true, position: 'header' }],
        ])('Renders nothing for %p', (themeModeSwitcher) => {
            const { container, unmount } = render({ currentThemeMode: 'light', changeThemeMode: jest.fn(), themeModeSwitcher });
            expect(container.querySelector('.sidebar-theme-switcher')).toBeNull();
            unmount();
        });
    });

    describe('Logo', () => {
        test('Renders linked image with defaults', () => {
            const { container, unmount } = renderIntoContainer(<Logo src="/logo.svg" title="Site" />);
            const a = container.querySelector('.logo a') as HTMLAnchorElement;
            expect(a.getAttribute('href')).toBe('#');
            const img = container.querySelector('img') as HTMLImageElement;
            expect(img.getAttribute('src')).toBe('/logo.svg');
            expect(img.alt).toBe('Site');
            expect(img.getAttribute('loading')).toBe('lazy');
            unmount();
        });

        test('Uses explicit alt, href and loading', () => {
            const { container, unmount } = renderIntoContainer(<Logo src="/l.png" title="T" alt="A" href="/" loading="eager" />);
            expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
            expect(container.querySelector('img')?.alt).toBe('A');
            expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager');
            unmount();
        });

        test('Renders nothing without a source', () => {
            const { container, unmount } = renderIntoContainer(<Logo title="T" />);
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });
});
