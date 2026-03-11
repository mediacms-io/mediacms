import { GlobalMediaCMS, MediaCMSConfig } from '../../types';
import { apiConfig } from './api';
import { contentsConfig } from './contents';
import { mediaConfig } from './media';
import { memberConfig } from './member';
import { notificationsConfig } from './notifications';
import { optionsEmbeddedConfig } from './optionsEmbedded';
import { optionsPagesConfig } from './optionsPages';
import { pagesConfig } from './pages';
import { playlistsConfig } from './playlists';
import { sidebarConfig } from './sidebar';
import { siteConfig } from './site';
import { taxonomiesConfig } from './taxonomies';
import { themeConfig } from './theme';
import { urlConfig } from './url';

let DATA: MediaCMSConfig | null = null;

export function config(globalObj: GlobalMediaCMS) {
    if (DATA) {
        return DATA;
    }

    const { api, contents, features, pages, site, user } = globalObj;

    const enabledPages = pagesConfig({ ...site.pages, ...site.userPages });

    DATA = {
        api: apiConfig(site.api, api),
        contents: contentsConfig(contents),
        enabled: {
            pages: enabledPages,
            taxonomies: taxonomiesConfig(site.taxonomies),
        },
        media: mediaConfig(features.mediaItem, features.media.shareOptions),
        member: memberConfig(user, features),
        notifications: notificationsConfig(contents.notifications),
        options: {
            pages: optionsPagesConfig(pages.home, pages.search, pages.media, pages.profile, enabledPages),
            embedded: optionsEmbeddedConfig(features.embeddedVideo),
        },
        playlists: playlistsConfig(features.playlists),
        sidebar: sidebarConfig(features.sideBar),
        site: siteConfig(site),
        theme: themeConfig(site.theme, site.logo),
        url: urlConfig(globalObj),
    };

    return DATA;
}
