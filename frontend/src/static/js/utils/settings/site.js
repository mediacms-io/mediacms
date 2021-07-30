let SITE = null;

export function init(settings) {
  SITE = {
    id: 'media-cms',
    url: '',
    api: '',
    title: '',
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
  }
}

export function settings() {
  return SITE;
}
