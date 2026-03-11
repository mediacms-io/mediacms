import { contentsConfig } from '../../../src/static/js/utils/settings/contents';

describe('utils/settings', () => {
    describe('contents', () => {
        test('Strings are trimmed and default to empty', () => {
            const cfg1 = contentsConfig({
                header: { right: '  R  ', onLogoRight: '  OLR  ' },
                sidebar: { belowNavMenu: '  X  ', belowThemeSwitcher: '  Y  ', footer: '  Z  ' },
                uploader: { belowUploadArea: '  U1  ', postUploadMessage: '  U2  ' },
            });
            const cfg2 = contentsConfig({});
            const cfg3 = contentsConfig({ header: {}, sidebar: {}, uploader: {} });

            expect(cfg1).toStrictEqual({
                header: { right: 'R', onLogoRight: 'OLR' },
                sidebar: {
                    navMenu: { items: [] },
                    mainMenuExtra: { items: [] },
                    belowNavMenu: 'X',
                    belowThemeSwitcher: 'Y',
                    footer: 'Z',
                },
                uploader: { belowUploadArea: 'U1', postUploadMessage: 'U2' },
            });

            expect(cfg2).toStrictEqual({
                header: { right: '', onLogoRight: '' },
                sidebar: {
                    navMenu: { items: [] },
                    mainMenuExtra: { items: [] },
                    belowNavMenu: '',
                    belowThemeSwitcher: '',
                    footer: '',
                },
                uploader: { belowUploadArea: '', postUploadMessage: '' },
            });

            expect(cfg3).toStrictEqual({
                header: { right: '', onLogoRight: '' },
                sidebar: {
                    navMenu: { items: [] },
                    mainMenuExtra: { items: [] },
                    belowNavMenu: '',
                    belowThemeSwitcher: '',
                    footer: '',
                },
                uploader: { belowUploadArea: '', postUploadMessage: '' },
            });
        });

        test('Sidebar menu items require text, link, icon and get trimmed', () => {
            const cfg = contentsConfig({
                sidebar: {
                    mainMenuExtraItems: [
                        { text: ' A ', link: ' /a ', icon: ' i-a ', className: '  cls  ' },
                        { text: 'no-link', icon: 'i' },
                        { link: '/missing-text', icon: 'i' },
                        { text: 'no-icon', link: '/x' },
                        null as any,
                        undefined,
                    ],
                    navMenuItems: [
                        { text: ' B ', link: ' /b ', icon: ' i-b ' },
                        { text: ' ', link: '/bad', icon: 'i' },
                        null as any,
                        undefined,
                    ],
                },
            });

            expect(cfg.sidebar.mainMenuExtra.items).toEqual([{ text: 'A', link: '/a', icon: 'i-a', className: 'cls' }]);

            expect(cfg.sidebar.navMenu.items).toEqual([{ text: 'B', link: '/b', icon: 'i-b', className: '' }]);
        });

        test('sidebar strings are trimmed or default to empty', () => {
            const cfg = contentsConfig({
                sidebar: {
                    belowNavMenu: '  X  ',
                    belowThemeSwitcher: '  Y  ',
                    footer: '  Z  ',
                },
            } as any);

            expect(cfg.sidebar.belowNavMenu).toBe('X');
            expect(cfg.sidebar.belowThemeSwitcher).toBe('Y');
            expect(cfg.sidebar.footer).toBe('Z');

            const cfg2 = contentsConfig({ sidebar: {} } as any);
            expect(cfg2.sidebar.belowNavMenu).toBe('');
            expect(cfg2.sidebar.belowThemeSwitcher).toBe('');
            expect(cfg2.sidebar.footer).toBe('');
        });

        test('uploader strings are trimmed or default to empty', () => {
            const cfg = contentsConfig({
                uploader: { belowUploadArea: '  U1  ', postUploadMessage: '  U2  ' },
            } as any);

            expect(cfg.uploader.belowUploadArea).toBe('U1');
            expect(cfg.uploader.postUploadMessage).toBe('U2');

            const cfg2 = contentsConfig({ uploader: {} } as any);
            expect(cfg2.uploader.belowUploadArea).toBe('');
            expect(cfg2.uploader.postUploadMessage).toBe('');
        });

        test('handles completely missing settings by returning defaults', () => {
            const cfg = contentsConfig(undefined as any);
            expect(cfg.header.right).toBe('');
            expect(cfg.header.onLogoRight).toBe('');
            expect(cfg.sidebar.mainMenuExtra.items).toEqual([]);
            expect(cfg.sidebar.navMenu.items).toEqual([]);
            expect(cfg.sidebar.footer).toBe('');
            expect(cfg.uploader.postUploadMessage).toBe('');
        });
    });
});
