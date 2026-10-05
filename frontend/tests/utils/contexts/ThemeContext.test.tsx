import '../../_support/setupMediaCMS';
import React from 'react';
import { renderHook, renderIntoContainer, act } from '../../_support/render';
import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';
import { ThemeProvider, ThemeConsumer } from '../../../src/static/js/utils/contexts/ThemeContext';
import { useTheme } from '../../../src/static/js/utils/hooks/useTheme';

const CACHE_KEY = 'MediaCMS[mediacms-test][theme][mode]';

function renderTheme() {
    return renderHook(() => useTheme() as any);
}

function readCachedMode() {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw).value : null;
}

function isolatedThemeValue(overrides: Record<string, any>) {
    const original = (window as any).MediaCMS;
    installMediaCMSGlobal(overrides);
    let value: any;
    jest.isolateModules(() => {
        const IsolatedReact = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        const ctx = require('../../../src/static/js/utils/contexts/ThemeContext');
        renderToStaticMarkup(
            IsolatedReact.createElement(
                ctx.ThemeProvider,
                null,
                IsolatedReact.createElement(ctx.ThemeConsumer, null, (v: any) => {
                    value = v;
                    return null;
                })
            )
        );
    });
    (window as any).MediaCMS = original;
    return value;
}

describe('utils/contexts', () => {
    describe('ThemeContext', () => {
        beforeEach(() => {
            localStorage.clear();
            document.body.className = '';
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('Starts in configured light mode with the light svg logo', () => {
            let value: any;
            const view = renderWithProvider((v) => (value = v));
            expect(value.currentThemeMode).toBe('light');
            expect(value.logo).toBe('/img/light.svg');
            expect(value.themeModeSwitcher).toStrictEqual({ enabled: true, position: 'sidebar' });
            expect(document.body.classList.contains('dark_theme')).toBe(false);
            expect(readCachedMode()).toBe('light');
            view.unmount();
        });

        test('changeThemeMode toggles between dark and light and updates body, logo and cache', () => {
            let value: any;
            const view = renderWithProvider((v) => (value = v));

            act(() => value.changeThemeMode());
            expect(value.currentThemeMode).toBe('dark');
            expect(value.logo).toBe('/img/dark.svg');
            expect(document.body.classList.contains('dark_theme')).toBe(true);
            expect(readCachedMode()).toBe('dark');

            act(() => value.changeThemeMode());
            expect(value.currentThemeMode).toBe('light');
            expect(document.body.classList.contains('dark_theme')).toBe(false);
            expect(readCachedMode()).toBe('light');
            view.unmount();
        });

        test('Restores a valid cached mode', () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ value: 'dark', expire: Date.now() + 60000 }));
            let value: any;
            const view = renderWithProvider((v) => (value = v));
            expect(value.currentThemeMode).toBe('dark');
            expect(document.body.classList.contains('dark_theme')).toBe(true);
            view.unmount();
        });

        test('Ignores an invalid cached mode', () => {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ value: 'sepia', expire: Date.now() + 60000 }));
            let value: any;
            const view = renderWithProvider((v) => (value = v));
            expect(value.currentThemeMode).toBe('light');
            view.unmount();
        });

        test('useTheme returns undefined outside a provider', () => {
            const { result, unmount } = renderTheme();
            expect(result.current).toBeUndefined();
            unmount();
        });

        test('useTheme returns the provider value', () => {
            let hookValue: any;
            function Probe() {
                hookValue = useTheme();
                return null;
            }
            const view = renderIntoContainer(
                <ThemeProvider>
                    <Probe />
                </ThemeProvider>
            );
            expect(hookValue.currentThemeMode).toBe('light');
            expect(typeof hookValue.changeThemeMode).toBe('function');
            view.unmount();
        });

        test('Falls back to png logos when svg images are not supported', () => {
            jest.spyOn(document.implementation, 'hasFeature').mockReturnValue(false as any);
            const value = isolatedThemeValue({});
            expect(value.logo).toBe('/img/light.png');
        });

        test('Uses the light logo for dark mode when no dark logo is configured', () => {
            const value = isolatedThemeValue({
                site: { theme: { mode: 'dark' }, logo: { darkMode: { img: '', svg: '' } } },
            });
            expect(value.currentThemeMode).toBe('dark');
            expect(value.logo).toBe('/img/light.svg');
        });

        test('Uses the dark logo for light mode when no light logo is configured', () => {
            const value = isolatedThemeValue({ site: { logo: { lightMode: { img: '', svg: '' } } } });
            expect(value.logo).toBe('/img/dark.svg');
        });

        test('Logo is null when no logo is configured', () => {
            const value = isolatedThemeValue({
                site: { logo: { lightMode: { img: '', svg: '' }, darkMode: { img: '', svg: '' } } },
            });
            expect(value.logo).toBeNull();
        });
    });
});

function renderWithProvider(onValue: (v: any) => void) {
    return renderIntoContainer(
        <ThemeProvider>
            <ThemeConsumer>
                {(v: any) => {
                    onValue(v);
                    return null;
                }}
            </ThemeConsumer>
        </ThemeProvider>
    );
}
