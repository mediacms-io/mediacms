import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export const sidebarConfig = (
    settings?: DeepPartial<GlobalMediaCMS['features']['sideBar']>
): MediaCMSConfig['sidebar'] => ({
    hideHomeLink: settings?.hideHomeLink === true,
    hideTagsLink: settings?.hideTagsLink === true,
    hideCategoriesLink: settings?.hideCategoriesLink === true,
});
