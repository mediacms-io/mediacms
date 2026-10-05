import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { UserProvider, UserContext } from '../../../src/static/js/utils/contexts/UserContext';
import { SidebarContext } from '../../../src/static/js/utils/contexts/SidebarContext';
import { LayoutContext } from '../../../src/static/js/utils/contexts/LayoutContext';
import { ThemeContext } from '../../../src/static/js/utils/contexts/ThemeContext';
import { SidebarNavigationMenu } from '../../../src/static/js/components/page-layout/sidebar/SidebarNavigationMenu';
import { PageSidebar } from '../../../src/static/js/components/page-layout/PageSidebar';

function classes(container: HTMLElement) {
    return Array.from(container.querySelectorAll('li')).map((li) => li.className.split(' ').find((c) => c.startsWith('nav-item-')));
}

describe('components/page-layout', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    describe('SidebarNavigationMenu', () => {
        test('Lists sections for a signed in admin from the page config', () => {
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <SidebarNavigationMenu />
                </UserProvider>
            );
            expect(classes(container)).toEqual([
                'nav-item-home',
                'nav-item-featured',
                'nav-item-recommended',
                'nav-item-latest',
                'nav-item-tags',
                'nav-item-categories',
                'nav-item-members',
                'nav-item-upload-media',
                'nav-item-my-media',
                'nav-item-my-playlists',
                'nav-item-history',
                'nav-item-liked',
                'nav-item-about',
                'nav-item-terms',
                'nav-item-contact',
                'nav-item-language',
                'nav-item-manage-media',
                'nav-item-manage-users',
                'nav-item-manage-comments',
            ]);
            expect(container.querySelector('.nav-item-manage-users a')?.getAttribute('href')).toBe('/manage/users');
            unmount();
        });

        test('Marks the current page link active', () => {
            window.history.replaceState(null, '', '/tags');
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <SidebarNavigationMenu />
                </UserProvider>
            );
            expect(container.querySelector('.nav-item-tags')?.className).toContain('active');
            expect(container.querySelector('.nav-item-home')?.className).not.toContain('active');
            unmount();
        });

        test('Respects sidebar hide flags and anonymous users', () => {
            const user = { isAnonymous: true, userCan: { canSeeMembersPage: false }, pages: {} };
            const { container, unmount } = renderIntoContainer(
                <UserContext.Provider value={user as any}>
                    <SidebarContext.Provider value={{ hideHomeLink: true, hideTagsLink: true, hideCategoriesLink: true } as any}>
                        <SidebarNavigationMenu />
                    </SidebarContext.Provider>
                </UserContext.Provider>
            );
            expect(classes(container)).toEqual([
                'nav-item-featured',
                'nav-item-recommended',
                'nav-item-latest',
                'nav-item-history',
                'nav-item-about',
                'nav-item-terms',
                'nav-item-contact',
                'nav-item-language',
            ]);
            unmount();
        });
    });

    describe('PageSidebar', () => {
        test('Renders sidebar sections and closes the sidebar from the content overlay', () => {
            jest.useFakeTimers();
            const overlay = document.createElement('div');
            overlay.className = 'page-sidebar-content-overlay';
            document.body.appendChild(overlay);
            const toggleSidebar = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <LayoutContext.Provider value={{ visibleSidebar: true, toggleSidebar } as any}>
                        <ThemeContext.Provider value={{ currentThemeMode: 'light', changeThemeMode: jest.fn(), themeModeSwitcher: { enabled: true, position: 'sidebar' } } as any}>
                            <PageSidebar />
                        </ThemeContext.Provider>
                    </LayoutContext.Provider>
                </UserProvider>
            );
            expect(container.querySelector('.page-sidebar')?.className).toContain('page-sidebar');
            expect(container.querySelector('.sidebar-theme-switcher')).not.toBeNull();
            expect(container.querySelector('.page-sidebar-bottom')?.textContent).toBe('Powered by MediaCMS');
            expect(container.querySelector('.nav-item-home')).not.toBeNull();
            overlay.click();
            expect(toggleSidebar).toHaveBeenCalledTimes(1);
            jest.runOnlyPendingTimers();
            unmount();
            overlay.click();
            expect(toggleSidebar).toHaveBeenCalledTimes(1);
            overlay.remove();
            jest.clearAllTimers();
            jest.useRealTimers();
        });
    });
});
