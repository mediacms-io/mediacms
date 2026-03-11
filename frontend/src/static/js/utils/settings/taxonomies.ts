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

        const title = settings[key]?.title;
        if (typeof title === 'string') {
            ret[key].title = title.trim();
        }
    }

    return ret;
}
