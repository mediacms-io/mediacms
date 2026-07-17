import urlParse from 'url-parse';

export function formatInnerLink(url, baseUrl) {
  if ('string' === typeof url && /^https?:\/\//i.test(url)) {
    return url;
  }

  let link = urlParse(url, {});

  if ('' === link.origin || 'null' === link.origin || !link.origin) {
    link = urlParse(baseUrl + '/' + url.replace(/^\//g, ''), {});
  }

  return link.toString();
}
