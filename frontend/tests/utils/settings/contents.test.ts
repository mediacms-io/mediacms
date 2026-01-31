import { init, settings } from '../../../src/static/js/utils/settings/contents';

const contentsConfig = (obj: any) => {
    init(obj);
    return settings();
};

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

        // @todo: Revisit this behavior
        test('Sidebar menu items require text, link, icon and NOT get trimmed', () => {
            const cfg = contentsConfig({
                sidebar: {
                    mainMenuExtraItems: [
                        { text: ' A ', link: ' /a ', icon: ' i-a ', className: '  cls  ' },
                        { text: 'no-link', icon: 'i' },
                        { link: '/missing-text', icon: 'i' },
                        { text: 'no-icon', link: '/x' },
                    ],
                    navMenuItems: [
                        { text: ' B ', link: ' /b ', icon: ' i-b ' },
                        { text: ' ', link: '/bad', icon: 'i' },
                    ],
                },
            });

            expect(cfg.sidebar.mainMenuExtra.items).toStrictEqual([
                { text: ' A ', link: ' /a ', icon: ' i-a ', className: '  cls  ' },
            ]);

            expect(cfg.sidebar.navMenu.items).toStrictEqual([
                { text: ' B ', link: ' /b ', icon: ' i-b ', className: undefined },
                { text: ' ', link: '/bad', icon: 'i', className: undefined },
            ]);
        });
    });
});
