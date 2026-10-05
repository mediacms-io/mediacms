import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { LayoutProvider, LayoutConsumer } from '../../../src/static/js/utils/contexts/LayoutContext';
import { useLayout } from '../../../src/static/js/utils/hooks/useLayout';
import PageStore from '../../../src/static/js/utils/stores/PageStore';
import * as PageActions from '../../../src/static/js/utils/actions/PageActions';

const CACHE_KEY = 'MediaCMS[mediacms-test][layout][visible-sidebar]';

function cacheSidebar(value: boolean) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ value, expire: Date.now() + 60000 }));
}

function readCachedSidebar() {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw).value : undefined;
}

function renderLayout() {
    const ref: { current: any } = { current: null };
    function Probe() {
        ref.current = useLayout();
        return null;
    }
    const view = renderIntoContainer(
        <LayoutProvider>
            <Probe />
        </LayoutProvider>
    );
    return { ref, ...view };
}

describe('utils/contexts', () => {
    describe('LayoutContext', () => {
        const originalWidth = window.innerWidth;

        beforeEach(() => {
            localStorage.clear();
            sessionStorage.clear();
            document.body.className = '';
            document.body.innerHTML = '';
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
            PageActions.initPage('home');
        });

        afterEach(() => {
            PageStore.removeAllListeners('page_init');
            delete (window as any).MediaCMS.mediaId;
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
            jest.useRealTimers();
        });

        test('Shows the sidebar on wide screens when nothing is cached', () => {
            const { ref, unmount } = renderLayout();
            expect(ref.current.visibleSidebar).toBe(true);
            expect(ref.current.visibleMobileSearch).toBe(false);
            expect(ref.current.enabledSidebar).toBe(false);
            expect(document.body.classList.contains('visible-sidebar')).toBe(true);
            expect(readCachedSidebar()).toBe(true);
            unmount();
        });

        test('Respects a cached hidden sidebar', () => {
            cacheSidebar(false);
            const { ref, unmount } = renderLayout();
            expect(ref.current.visibleSidebar).toBe(false);
            expect(document.body.classList.contains('visible-sidebar')).toBe(false);
            unmount();
        });

        test('Hides the sidebar on narrow screens and does not cache the value', () => {
            window.innerWidth = 800;
            const { ref, unmount } = renderLayout();
            expect(ref.current.visibleSidebar).toBe(false);
            expect(readCachedSidebar()).toBeUndefined();
            unmount();
        });

        test('Detects an existing sidebar element', () => {
            document.body.innerHTML = '<div id="app-sidebar"></div>';
            const { ref, unmount } = renderLayout();
            expect(ref.current.enabledSidebar).toBe(true);
            unmount();
        });

        test('Keeps the sidebar hidden on media pages', () => {
            (window as any).MediaCMS.mediaId = 'abc';
            const { ref, unmount } = renderLayout();
            expect(ref.current.visibleSidebar).toBe(false);
            expect(document.body.classList.contains('visible-sidebar')).toBe(false);
            unmount();
        });

        test('Keeps the sidebar hidden inside an embedded LMS app', () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            const { ref, unmount } = renderLayout();
            expect(ref.current.visibleSidebar).toBe(false);
            unmount();
        });

        test('Page init hides the sidebar on media pages', () => {
            PageActions.initPage('media');
            const { ref, unmount } = renderLayout();
            act(() => {
                ref.current.setVisibleSidebar(true);
            });
            expect(ref.current.visibleSidebar).toBe(true);
            act(() => {
                PageActions.initPage('media');
            });
            expect(ref.current.visibleSidebar).toBe(false);
            expect(document.body.classList.contains('visible-sidebar')).toBe(false);
            unmount();
        });

        test('Page init leaves the sidebar alone on regular pages', () => {
            const { ref, unmount } = renderLayout();
            act(() => {
                PageActions.initPage('home');
            });
            expect(ref.current.visibleSidebar).toBe(true);
            unmount();
        });

        test('toggleMobileSearch flips the mobile search flag', () => {
            const { ref, unmount } = renderLayout();
            act(() => ref.current.toggleMobileSearch());
            expect(ref.current.visibleMobileSearch).toBe(true);
            act(() => ref.current.toggleMobileSearch());
            expect(ref.current.visibleMobileSearch).toBe(false);
            unmount();
        });

        test('toggleSidebar animates the body classes on regular pages', () => {
            jest.useFakeTimers();
            const { ref, unmount } = renderLayout();

            act(() => ref.current.toggleSidebar());
            expect(ref.current.visibleSidebar).toBe(false);
            expect(document.body.classList.contains('sliding-sidebar')).toBe(true);

            act(() => {
                jest.advanceTimersByTime(20);
            });
            expect(document.body.classList.contains('visible-sidebar')).toBe(false);
            expect(document.body.classList.contains('overflow-hidden')).toBe(false);
            expect(document.body.classList.contains('sliding-sidebar')).toBe(true);

            act(() => {
                jest.advanceTimersByTime(220);
            });
            expect(document.body.classList.contains('sliding-sidebar')).toBe(false);

            act(() => ref.current.toggleSidebar());
            act(() => {
                jest.runAllTimers();
            });
            expect(ref.current.visibleSidebar).toBe(true);
            expect(document.body.classList.contains('visible-sidebar')).toBe(true);
            expect(jest.getTimerCount()).toBe(0);
            unmount();
        });

        test('toggleSidebar locks body scrolling on narrow screens while visible', () => {
            jest.useFakeTimers();
            window.innerWidth = 600;
            const { ref, unmount } = renderLayout();

            act(() => ref.current.toggleSidebar());
            act(() => {
                jest.runAllTimers();
            });
            expect(ref.current.visibleSidebar).toBe(true);
            expect(document.body.classList.contains('overflow-hidden')).toBe(true);

            act(() => ref.current.toggleSidebar());
            act(() => {
                jest.runAllTimers();
            });
            expect(document.body.classList.contains('overflow-hidden')).toBe(false);
            unmount();
        });

        test('toggleSidebar locks body scrolling on media pages while visible', () => {
            jest.useFakeTimers();
            PageActions.initPage('media');
            const { ref, unmount } = renderLayout();

            act(() => ref.current.toggleSidebar());
            act(() => {
                jest.runAllTimers();
            });
            expect(document.body.classList.contains('overflow-hidden')).toBe(true);
            expect(document.body.classList.contains('visible-sidebar')).toBe(true);

            act(() => ref.current.toggleSidebar());
            act(() => {
                jest.runAllTimers();
            });
            expect(document.body.classList.contains('overflow-hidden')).toBe(false);
            unmount();
        });

        test('LayoutConsumer receives the provider value', () => {
            let value: any;
            const { unmount } = renderIntoContainer(
                <LayoutProvider>
                    <LayoutConsumer>
                        {(v: any) => {
                            value = v;
                            return null;
                        }}
                    </LayoutConsumer>
                </LayoutProvider>
            );
            expect(Object.keys(value).sort()).toStrictEqual([
                'enabledSidebar',
                'setVisibleSidebar',
                'toggleMobileSearch',
                'toggleSidebar',
                'visibleMobileSearch',
                'visibleSidebar',
            ]);
            unmount();
        });
    });
});
