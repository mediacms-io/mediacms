let PAGES = null;

export function init(settings) {
  PAGES = {
    latest: {
      enabled: false,
      title: 'Recent uploads',
    },
    featured: {
      enabled: false,
      title: 'Featured',
    },
    recommended: {
      enabled: false,
      title: 'Recommended',
    },
    members: {
      enabled: false,
      title: 'Members',
    },
    liked: {
      enabled: false,
      title: 'Liked media',
    },
    history: {
      enabled: false,
      title: 'History',
    },
  };

  if (void 0 !== settings) {
    for (let k in PAGES) {
      if (void 0 !== settings[k]) {
        PAGES[k].enabled = true;

        if (void 0 !== settings[k].enabled && false === settings[k].enabled) {
          PAGES[k].enabled = false;
        }

        if ('string' === typeof settings[k].title) {
          PAGES[k].title = settings[k].title.trim();
        }
      }
    }
  }
}

export function settings() {
  return PAGES;
}
