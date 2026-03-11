import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserCache } from '../classes';
import { PageStore } from '../stores';
import { addClassname, removeClassname, inEmbeddedApp } from '../helpers';
import SiteContext from './SiteContext';

let slidingSidebarTimeout: NodeJS.Timeout | null = null;

function onSidebarVisibilityChange(visibleSidebar: boolean) {
    if (slidingSidebarTimeout) {
        clearTimeout(slidingSidebarTimeout);
    }

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

export const LayoutContext = createContext({
    enabledSidebar: true,
    visibleSidebar: true,
    setVisibleSidebar: (_: boolean) => {},
    visibleMobileSearch: false,
    toggleMobileSearch: () => {},
    toggleSidebar: () => {},
});

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
    const site = useContext(SiteContext);
    const cache = BrowserCache('MediaCMS[' + site.id + '][layout]', 86400);

    const isMediaPage = useMemo(() => PageStore.get('current-page') === 'media', []);
    const isEmbeddedApp = useMemo(() => inEmbeddedApp(), []);

    const enabledSidebar = Boolean(document.getElementById('app-sidebar') || document.querySelector('.page-sidebar'));

    const [visibleSidebar, setVisibleSidebar] = useState<boolean>(
        cache instanceof Error
            ? true // @todo: Check this again
            : cache.get('visible-sidebar')
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

        if (!isEmbeddedApp && !isMediaPage && 1023 < window.innerWidth) {
            if (!(cache instanceof Error)) {
                cache.set('visible-sidebar', visibleSidebar);
            }
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
            !isEmbeddedApp && !isMediaPage && 1023 < window.innerWidth && (null === visibleSidebar || visibleSidebar)
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
