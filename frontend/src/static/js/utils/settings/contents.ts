import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

const headerContents = (settings?: DeepPartial<GlobalMediaCMS['contents']['header']>) => ({
    right: settings?.right !== undefined ? settings.right.trim() : '',
    onLogoRight: settings?.onLogoRight !== undefined ? settings.onLogoRight.trim() : '',
});

function sidebarContents(settings?: DeepPartial<GlobalMediaCMS['contents']['sidebar']>) {
    const sidebar: MediaCMSConfig['contents']['sidebar'] = {
        belowNavMenu: settings?.belowNavMenu ? settings.belowNavMenu.trim() : '',
        belowThemeSwitcher: settings?.belowThemeSwitcher ? settings.belowThemeSwitcher.trim() : '',
        footer: settings?.footer ? settings.footer.trim() : '',
        mainMenuExtra: { items: [] },
        navMenu: { items: [] },
    };

    if (settings?.mainMenuExtraItems) {
        for (const item of settings.mainMenuExtraItems) {
            if (!item) {
                continue;
            }

            const text = item.text ? item.text.trim() : '';
            const link = item.link ? item.link.trim() : '';
            const icon = item.icon ? item.icon.trim() : '';

            const className = item.className ? item.className.trim() : '';

            if (text && link && icon) {
                sidebar.mainMenuExtra.items.push({ text, link, icon, className });
            }
        }
    }

    if (settings?.navMenuItems) {
        for (const item of settings.navMenuItems) {
            if (!item) {
                continue;
            }

            const text = item.text ? item.text.trim() : '';
            const link = item.link ? item.link.trim() : '';
            const icon = item.icon ? item.icon.trim() : '';

            const className = item.className ? item.className.trim() : '';

            if (text && link && icon) {
                sidebar.navMenu.items.push({ text, link, icon, className });
            }
        }
    }

    return sidebar;
}

const uploaderContents = (settings?: DeepPartial<GlobalMediaCMS['contents']['uploader']>) => ({
    belowUploadArea: settings?.belowUploadArea ? settings?.belowUploadArea.trim() : '',
    postUploadMessage: settings?.postUploadMessage ? settings?.postUploadMessage.trim() : '',
});

export const contentsConfig = (
    settings?: DeepPartial<Omit<GlobalMediaCMS['contents'], 'notifications'>>
): MediaCMSConfig['contents'] => ({
    header: headerContents(settings?.header),
    sidebar: sidebarContents(settings?.sidebar),
    uploader: uploaderContents(settings?.uploader),
});
