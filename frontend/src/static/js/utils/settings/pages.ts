import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function pagesConfig(
    settings?: DeepPartial<GlobalMediaCMS['site']['pages']> & DeepPartial<GlobalMediaCMS['site']['userPages']>
) {
    const ret: MediaCMSConfig['enabled']['pages'] = {
        latest: { enabled: false, title: 'Recent uploads' },
        featured: { enabled: false, title: 'Featured' },
        recommended: { enabled: false, title: 'Recommended' },
        members: { enabled: false, title: 'Members' },
        liked: { enabled: false, title: 'Liked media' },
        history: { enabled: false, title: 'History' },
    };

    for (let sk in settings) {
        const key = sk as keyof typeof settings;

        if (!ret[key]) {
            continue;
        }

        ret[key].enabled = settings[key]?.enabled === false ? false : true;

        if (settings[key]?.title !== undefined) {
            ret[key].title = settings[key].title.trim();
        }
    }

    return ret;
}
