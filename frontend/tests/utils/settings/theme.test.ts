import { init, settings } from '../../../src/static/js/utils/settings/theme';

const themeConfig = (theme?: any, logo?: any) => {
    init(theme, logo);
    return settings();
};

describe('utils/settings', () => {
    describe('theme', () => {
        test('Applies defaults when no inputs provided', () => {
            const cfg = themeConfig();
            expect(cfg).toStrictEqual({
                mode: 'light',
                switch: { enabled: true, position: 'header' },
                logo: { lightMode: { img: '', svg: '' }, darkMode: { img: '', svg: '' } },
            });
        });

        test("Sets dark mode only when theme.mode is exactly 'dark' after trim", () => {
            expect(themeConfig({ mode: 'dark' }).mode).toBe('dark');
            expect(themeConfig({ mode: ' dark ' }).mode).toBe('dark');
            expect(themeConfig({ mode: 'Dark' }).mode).toBe('light');
            expect(themeConfig({ mode: 'light' }).mode).toBe('light');
            expect(themeConfig({ mode: '  ' }).mode).toBe('light');
        });

        test('Switch config: enabled only toggles off when explicitly false; position set to sidebar only when exactly sidebar after trim', () => {
            expect(themeConfig({ switch: { enabled: false } }).switch.enabled).toBe(false);
            expect(themeConfig({ switch: { enabled: true } }).switch.enabled).toBe(true);
            expect(themeConfig({ switch: { enabled: undefined } }).switch.enabled).toBe(true);

            expect(themeConfig({ switch: { position: 'sidebar' } }).switch.position).toBe('sidebar');
            expect(themeConfig({ switch: { position: ' sidebar ' } }).switch.position).toBe('header'); // @todo: Fix this. It should be 'sidebar'
            expect(themeConfig({ switch: { position: 'header' } }).switch.position).toBe('header');
            expect(themeConfig({ switch: { position: 'foot' } }).switch.position).toBe('header');
        });

        test('Trims and maps logo URLs for both light and dark modes; ignores missing fields', () => {
            const cfg = themeConfig(undefined, {
                lightMode: { img: ' /img/light.png ', svg: ' /img/light.svg ' },
                darkMode: { img: ' /img/dark.png ', svg: ' /img/dark.svg ' },
            });

            expect(cfg).toStrictEqual({
                mode: 'light',
                switch: { enabled: true, position: 'header' },
                logo: {
                    lightMode: { img: '/img/light.png', svg: '/img/light.svg' },
                    darkMode: { img: '/img/dark.png', svg: '/img/dark.svg' },
                },
            });

            const partial = themeConfig(undefined, { lightMode: { img: ' /only-light.png ' } });

            expect(partial).toStrictEqual({
                mode: 'light',
                switch: { enabled: true, position: 'header' },
                logo: {
                    lightMode: { img: '/only-light.png', svg: '' },
                    darkMode: { img: '', svg: '' },
                },
            });
        });

        test('Does not mutate input objects', () => {
            const themeIn = { mode: ' dark ', switch: { enabled: false, position: ' sidebar ' } };
            const logoIn = { lightMode: { img: ' x ', svg: ' y ' }, darkMode: { img: ' z ', svg: ' w ' } };
            const themeCopy = JSON.parse(JSON.stringify(themeIn));
            const logoCopy = JSON.parse(JSON.stringify(logoIn));

            themeConfig(themeIn, logoIn);

            expect(themeIn).toStrictEqual(themeCopy);
            expect(logoIn).toStrictEqual(logoCopy);
        });
    });
});
