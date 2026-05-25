import React from 'react';
import { act, render } from '@testing-library/react';

import { useTheme as useThemeHook } from '../../../src/static/js/utils/hooks/useTheme';

import { sampleMediaCMSConfig } from '../../tests-constants';

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/dispatcher.js', () => ({
    register: jest.fn(),
}));

function getRenderers(ThemeProvider: React.FC<{ children: React.ReactNode }>, useTheme: typeof useThemeHook) {
    const data: { current: any } = { current: undefined };

    const Comp: React.FC = () => {
        data.current = useTheme();
        return null;
    };

    const wrapper: typeof ThemeProvider = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

    return { Comp, wrapper, data };
}

function getThemeConfig(override?: {
    logo?: Partial<(typeof sampleMediaCMSConfig.theme)['logo']>;
    mode?: (typeof sampleMediaCMSConfig.theme)['mode'];
    switch?: Partial<(typeof sampleMediaCMSConfig.theme)['switch']>;
}) {
    const { logo, mode, switch: sw } = override ?? {};
    const { lightMode, darkMode } = logo ?? {};

    const config = {
        logo: {
            lightMode: { img: lightMode?.img ?? '/img/light.png', svg: lightMode?.svg ?? '/img/light.svg' },
            darkMode: { img: darkMode?.img ?? '/img/dark.png', svg: darkMode?.svg ?? '/img/dark.svg' },
        },
        mode: mode ?? 'dark',
        switch: { enabled: sw?.enabled ?? true, position: sw?.position ?? 'sidebar' },
    };

    return config;
}

describe('utils/hooks', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    describe('useTheme', () => {
        const themeConfig = getThemeConfig();
        const darkThemeConfig = getThemeConfig({ mode: 'dark' });

        // @todo: Revisit this
        test.each([
            [
                darkThemeConfig,
                {
                    logo: darkThemeConfig.logo.darkMode.svg,
                    currentThemeMode: darkThemeConfig.mode,
                    changeThemeMode: expect.any(Function),
                    themeModeSwitcher: themeConfig.switch,
                },
            ],
        ])('Validate value', async (theme, expectedResult) => {
            jest.doMock('../../../src/static/js/utils/settings/config', () => ({
                config: jest.fn(() => ({ ...jest.requireActual('../../tests-constants').sampleMediaCMSConfig, theme })),
            }));

            const { ThemeProvider } = await import('../../../src/static/js/utils/contexts/ThemeContext');
            const { useTheme } = await import('../../../src/static/js/utils/hooks/useTheme');

            const { Comp, wrapper, data } = getRenderers(ThemeProvider, useTheme);

            render(<Comp />, { wrapper });

            expect(data.current).toStrictEqual(expectedResult);

            act(() => data.current.changeThemeMode());

            const newThemeMode = 'light' === expectedResult.currentThemeMode ? 'dark' : 'light';
            const newThemeLogo =
                'light' === newThemeMode ? themeConfig.logo.lightMode.svg : themeConfig.logo.darkMode.svg;

            expect(data.current).toStrictEqual({
                ...expectedResult,
                logo: newThemeLogo,
                currentThemeMode: newThemeMode,
            });
        });
    });
});
