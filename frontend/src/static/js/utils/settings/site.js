let SITE = null;

export function init(settings) {
  SITE = {
    id: 'media-cms',
    url: '',
    api: '',
    title: '',
    useRoundedCorners: true,
  };

  if (void 0 !== settings) {
    if ('string' === typeof settings.id) {
      SITE.id = settings.id.trim();
    }

    if ('string' === typeof settings.url) {
      SITE.url = settings.url.trim();
    }

    if ('string' === typeof settings.api) {
      SITE.api = settings.api.trim();
    }

    if ('string' === typeof settings.title) {
      SITE.title = settings.title.trim();
    }

    if ('boolean' === typeof settings.useRoundedCorners) {
      SITE.useRoundedCorners = settings.useRoundedCorners;
    }
  }
}

export function settings() {
  return SITE;
}
