import urlParse from 'url-parse'; // @todo: It's not necessary, 'URL.parse(...)' is sufficient
import { GlobalMediaCMS, MediaCMSConfig } from '../../types';

function formatEndpoints<K extends string = string>(baseUrl: string, endpoints: Record<K, string>) {
    for (let k in endpoints) {
        endpoints[k] = baseUrl + '/' + endpoints[k].replace(/^\//g, '');
    }
    return endpoints;
}

export function apiConfig(
    apiUrl: GlobalMediaCMS['site']['api'],
    endpoints: GlobalMediaCMS['api']
): MediaCMSConfig['api'] {
    const baseUrl = urlParse(apiUrl).toString().replace(/\/+$/, '');
    return {
        ...formatEndpoints(baseUrl, {
            media: endpoints.media,
            featured: endpoints.media + '?show=featured',
            recommended: endpoints.media + '?show=recommended',
            playlists: endpoints.playlists,
            users: endpoints.members,
        }),
        user: formatEndpoints(baseUrl, {
            liked: endpoints.liked,
            history: endpoints.history,
            playlists: endpoints.playlists + '?author=',
        }),
        archive: formatEndpoints(baseUrl, {
            tags: endpoints.tags,
            categories: endpoints.categories,
        }),
        manage: formatEndpoints(baseUrl, {
            media: endpoints.manage_media,
            users: endpoints.manage_users,
            comments: endpoints.manage_comments,
        }),
        search: formatEndpoints(baseUrl, {
            query: endpoints.search + '?q=',
            titles: endpoints.search + '?show=titles&q=',
            tag: endpoints.search + '?t=',
            category: endpoints.search + '?c=',
        }),
    };
}
