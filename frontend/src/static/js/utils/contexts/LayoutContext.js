import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PageStore } from '../stores/';
import { addClassname, removeClassname, inEmbeddedApp } from '../helpers/';
import SiteContext from './SiteContext';

let slidingSidebarTimeout;

const WIDE_SCREEN_MIN_WIDTH = 1280;

function storedSidebar(key) {
    try {
        const value = localStorage.getItem(key);
        return 'true' === value ? true : 'false' === value ? false : null;
    } catch (error) {
        return null;
    }
}

function storeSidebar(key, visible) {
    try {
        localStorage.setItem(key, visible ? 'true' : 'false');
    } catch (error) {}
}

function onSidebarVisibilityChange(visibleSidebar) {
    clearTimeout(slidingSidebarTimeout);

    addClassname(document.body, 'sliding-sidebar');

    slidingSidebarTimeout = setTimeout(function () {
        if ('media' === PageStore.get('current-page')) {
            if (visibleSidebar) {
                addClassname(document.body, 'overflow-hidden');
            } else {
                removeClassname(document.body, 'overflow-hidden');
            }
        } else {
            if (!visibleSidebar || 767 < window.innerWidth) {
                removeClassname(document.body, 'overflow-hidden');
            } else {
                addClassname(document.body, 'overflow-hidden');
            }
        }

        if (visibleSidebar) {
            addClassname(document.body, 'visible-sidebar');
        } else {
            removeClassname(document.body, 'visible-sidebar');
        }

        slidingSidebarTimeout = setTimeout(function () {
            slidingSidebarTimeout = null;
            removeClassname(document.body, 'sliding-sidebar');
        }, 220);
    }, 20);
}

export const LayoutContext = createContext();

export const LayoutProvider = ({ children }) => {
    const site = useContext(SiteContext);
    const storageKey = 'MediaCMS[' + site.id + '][layout][visible-sidebar]';

    const isMediaPage = useMemo(() => PageStore.get('current-page') === 'media' || window.MediaCMS?.mediaId !== undefined, []);
    const isEmbeddedApp = useMemo(() => inEmbeddedApp(), []);

    const enabledSidebar = Boolean(document.getElementById('app-sidebar') || document.querySelector('.page-sidebar'));

    const [visibleSidebar, setVisibleSidebar] = useState(
        isMediaPage || isEmbeddedApp ? false : storedSidebar(storageKey)
    );
    const [visibleMobileSearch, setVisibleMobileSearch] = useState(false);

    const toggleMobileSearch = () => {
        setVisibleMobileSearch(!visibleMobileSearch);
    };

    const toggleSidebar = () => {
        const newval = !visibleSidebar;
        onSidebarVisibilityChange(newval);
        setVisibleSidebar(newval);
    };

    useEffect(() => {
        if (!isEmbeddedApp && visibleSidebar) {
            addClassname(document.body, 'visible-sidebar');
        } else {
            removeClassname(document.body, 'visible-sidebar');
        }

        if (!isEmbeddedApp && !isMediaPage && WIDE_SCREEN_MIN_WIDTH <= window.innerWidth) {
            storeSidebar(storageKey, visibleSidebar);
        }
    }, [isEmbeddedApp, isMediaPage, visibleSidebar]);

    useEffect(() => {
        PageStore.once('page_init', () => {
            if (isEmbeddedApp || isMediaPage) {
                setVisibleSidebar(false);
                removeClassname(document.body, 'visible-sidebar');
            }
        });

        setVisibleSidebar(
            !isEmbeddedApp && !isMediaPage && WIDE_SCREEN_MIN_WIDTH <= window.innerWidth && (null === visibleSidebar || visibleSidebar)
        );
    }, []);

    const value = {
        enabledSidebar,
        visibleSidebar,
        setVisibleSidebar,
        visibleMobileSearch,
        toggleMobileSearch,
        toggleSidebar,
    };

    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};

export const LayoutConsumer = LayoutContext.Consumer;
