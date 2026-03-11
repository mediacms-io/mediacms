import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function optionsPagesConfig(
    home?: DeepPartial<GlobalMediaCMS['pages']['home']>,
    search?: DeepPartial<GlobalMediaCMS['pages']['search']>,
    media?: DeepPartial<GlobalMediaCMS['pages']['media']>,
    profile?: DeepPartial<GlobalMediaCMS['pages']['profile']>,
    VALID_PAGES?: MediaCMSConfig['enabled']['pages']
) {
    const ret: MediaCMSConfig['options']['pages'] = {
        home: {
            sections: {
                latest: { title: VALID_PAGES?.latest?.title || 'Latest' },
                featured: { title: VALID_PAGES?.featured?.title || 'Featured' },
                recommended: { title: VALID_PAGES?.recommended?.title || 'Recommended' },
            },
        },
        search: {
            advancedFilters: search?.advancedFilters === true,
        },
        media: {
            categoriesWithTitle: media?.categoriesWithTitle === true,
            htmlInDescription: media?.htmlInDescription === true,
            displayViews: media?.hideViews === true ? false : true,
            related: {
                initialSize:
                    'number' === typeof media?.related?.initialSize && !Number.isNaN(media.related.initialSize)
                        ? media.related.initialSize
                        : 10,
            },
        },
        profile: {
            htmlInDescription: profile?.htmlInDescription === true,
            includeHistory: profile?.includeHistory === true,
            includeLikedMedia: profile?.includeLikedMedia === true,
        },
    };

    if (home?.sections) {
        if (typeof home.sections.latest?.title === 'string') {
            const latestTitle = home.sections.latest.title.trim();
            if (latestTitle !== '') {
                ret.home.sections.latest.title = latestTitle;
            }
        }

        if (typeof home.sections.featured?.title === 'string') {
            const featuredTitle = home.sections.featured.title.trim();
            if (featuredTitle !== '') {
                ret.home.sections.featured.title = featuredTitle;
            }
        }

        if (typeof home.sections.recommended?.title === 'string') {
            const recommendedTitle = home.sections.recommended.title.trim();
            if (recommendedTitle !== '') {
                ret.home.sections.recommended.title = recommendedTitle;
            }
        }
    }

    return ret;
}
