import urlParse from 'url-parse';

export function formatInnerLink(url: string, baseUrl: string) {
    let link = urlParse(url, {});

    if ('' === link.origin || 'null' === link.origin || !link.origin) {
        link = urlParse(baseUrl + '/' + url.replace(/^\//g, ''), {});
    }

    return link.toString();
}
