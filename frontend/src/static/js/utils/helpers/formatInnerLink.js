import urlParse from 'url-parse';

export function formatInnerLink(url, baseUrl) {
  let link = urlParse(url, {});

  if ('' === link.origin || 'null' === link.origin || !link.origin) {
    href = baseUrl + '/' + url.replace(/^\//g, '');
    if (href.indexOf("/") == 0) {
      href = href.substring(1);
    }
    link = urlParse(href, {});
  }

  return link.toString();
}
