import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function themeConfig(
    theme?: DeepPartial<GlobalMediaCMS['site']['theme']>,
    logo?: DeepPartial<GlobalMediaCMS['site']['logo']>
) {
    const ret: MediaCMSConfig['theme'] = {
        mode: 'light',
        switch: { enabled: true, position: 'header' },
        logo: { lightMode: { img: '', svg: '' }, darkMode: { img: '', svg: '' } },
    };

    if (theme) {
        if (theme.mode?.trim() === 'dark') {
            ret.mode = 'dark';
        }

        if (theme.switch) {
            if (theme.switch.enabled === false) {
                ret.switch.enabled = false;
            }
            if (theme.switch.position?.trim() === 'sidebar') {
                ret.switch.position = 'sidebar';
            }
        }
    }

    if (logo) {
        if (logo.lightMode) {
            if (logo.lightMode.img) {
                ret.logo.lightMode.img = logo.lightMode.img.trim();
            }

            if (logo.lightMode.svg) {
                ret.logo.lightMode.svg = logo.lightMode.svg.trim();
            }
        }

        if (logo.darkMode) {
            if (logo.darkMode?.img) {
                ret.logo.darkMode.img = logo.darkMode.img.trim();
            }

            if (logo.darkMode?.svg) {
                ret.logo.darkMode.svg = logo.darkMode.svg.trim();
            }
        }
    }

    return ret;
}
