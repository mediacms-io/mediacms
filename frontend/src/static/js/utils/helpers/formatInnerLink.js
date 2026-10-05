import urlParse from 'url-parse';

export function formatInnerLink(url, baseUrl) {
  let link = urlParse(url, {});

  if ('' === link.origin || 'null' === link.origin || !link.origin) {
    link = urlParse(String(baseUrl).replace(/\/+$/, '') + '/' + url.replace(/^\//g, ''), {});
  }

  return link.toString();
}
