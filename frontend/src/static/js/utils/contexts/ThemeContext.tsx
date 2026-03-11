import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { GlobalMediaCMS } from '../../types';
import { BrowserCache } from '../classes';
import { addClassname, removeClassname, supportsSvgAsImg } from '../helpers';
import { config as mediacmsConfig } from '../settings/config';
import SiteContext from './SiteContext';

const config = mediacmsConfig(window.MediaCMS);

function initLogo(logo: GlobalMediaCMS['site']['logo']) {
    let light = null;
    let dark = null;

    if (void 0 !== logo.darkMode) {
        if (supportsSvgAsImg() && void 0 !== logo.darkMode.svg && '' !== logo.darkMode.svg) {
            dark = logo.darkMode.svg;
        } else if (void 0 !== logo.darkMode.img && '' !== logo.darkMode.img) {
            dark = logo.darkMode.img;
        }
    }

    if (void 0 !== logo.lightMode) {
        if (supportsSvgAsImg() && void 0 !== logo.lightMode.svg && '' !== logo.lightMode.svg) {
            light = logo.lightMode.svg;
        } else if (void 0 !== logo.lightMode.img && '' !== logo.lightMode.img) {
            light = logo.lightMode.img;
        }
    }

    if (null !== light || null !== dark) {
        if (null === light) {
            light = dark;
        } else if (null === dark) {
            dark = light;
        }
    }

    return {
        light,
        dark,
    };
}

function initMode(cachedValue: string | undefined, defaultValue: GlobalMediaCMS['site']['theme']['mode']) {
    return 'light' === cachedValue || 'dark' === cachedValue ? cachedValue : defaultValue;
}

export const ThemeContext = createContext({
    logo: initLogo(config.theme.logo)[config.theme.mode],
    currentThemeMode: config.theme.mode,
    changeThemeMode: () => {},
    themeModeSwitcher: config.theme.switch,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const site = useContext(SiteContext);

    const cache = BrowserCache('MediaCMS[' + site.id + '][theme]', 86400);

    const [themeMode, setThemeMode] = useState(
        initMode(cache instanceof Error ? undefined : cache.get('mode'), config.theme.mode)
    );

    const logos = initLogo(config.theme.logo);
    const [logo, setLogo] = useState(logos[themeMode]);

    const changeMode = () => {
        setThemeMode('light' === themeMode ? 'dark' : 'light');
    };

    useEffect(() => {
        if ('dark' === themeMode) {
            addClassname(document.body, 'dark_theme');
        } else {
            removeClassname(document.body, 'dark_theme');
        }

        if (!(cache instanceof Error)) {
            cache.set('mode', themeMode);
        }

        setLogo(logos[themeMode]);
    }, [themeMode]);

    const value = {
        logo,
        currentThemeMode: themeMode,
        changeThemeMode: changeMode,
        themeModeSwitcher: config.theme.switch,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const ThemeConsumer = ThemeContext.Consumer;
