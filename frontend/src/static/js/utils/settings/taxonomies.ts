import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function taxonomiesConfig(settings?: DeepPartial<GlobalMediaCMS['site']['taxonomies']>) {
    const ret: MediaCMSConfig['enabled']['taxonomies'] = {
        tags: { enabled: false, title: 'Tags' },
        categories: { enabled: false, title: 'Categories' },
    };

    // @todo: Similar code in 'pages.ts'
    for (let sk in settings) {
        const key = sk as keyof typeof settings;

        if (!ret[key]) {
            continue;
        }

        ret[key].enabled = settings[key]?.enabled === false ? false : true; // @todo: Check this again

        if (settings[key]?.title !== undefined) {
            ret[key].title = settings[key].title.trim();
        }
    }

    return ret;
}
