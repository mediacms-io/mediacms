let PAGES = null;

export function init(home, search, media, profile, VALID_PAGES) {
  PAGES = {
    home: {
      sections: {
        latest: {
          title: '',
        },
        featured: {
          title: '',
        },
        recommended: {
          title: '',
        },
      },
    },
    search: {
      advancedFilters: false,
    },
    media: {
      categoriesWithTitle: false,
      htmlInDescription: false,
      displayViews: true,
      related: {
        initialSize: 10,
      },
    },
    profile: {
      htmlInDescription: false,
      includeHistory: false,
      includeLikedMedia: false,
    },
  };

  if (void 0 !== home) {
    if (void 0 !== home.sections) {
      if (void 0 !== home.sections.latest) {
        if ('string' === typeof home.sections.latest.title) {
          PAGES.home.sections.latest.title = home.sections.latest.title.trim();
        }
      }

      if (void 0 !== home.sections.featured) {
        if ('string' === typeof home.sections.featured.title) {
          PAGES.home.sections.featured.title = home.sections.featured.title.trim();
        }
      }

      if (void 0 !== home.sections.recommended) {
        if ('string' === typeof home.sections.recommended.title) {
          PAGES.home.sections.recommended.title = home.sections.recommended.title.trim();
        }
      }
    }
  }

  if (void 0 !== search) {
    if (true === search.advancedFilters) {
      PAGES.search.advancedFilters = search.advancedFilters;
    }
  }

  if ('' === PAGES.home.sections.latest.title) {
    PAGES.home.sections.latest.title = void 0 !== VALID_PAGES.latest ? VALID_PAGES.latest.title : 'Latest';
  }

  if ('' === PAGES.home.sections.featured.title) {
    PAGES.home.sections.featured.title = void 0 !== VALID_PAGES.featured ? VALID_PAGES.featured.title : 'Featured';
  }

  if ('' === PAGES.home.sections.recommended.title) {
    PAGES.home.sections.recommended.title =
      void 0 !== VALID_PAGES.recommended ? VALID_PAGES.recommended.title : 'Recommended';
  }

  if (void 0 !== media) {
    if (true === media.categoriesWithTitle) {
      PAGES.media.categoriesWithTitle = media.categoriesWithTitle;
    }

    if (true === media.hideViews) {
      PAGES.media.displayViews = false;
    }

    if (true === media.htmlInDescription) {
      PAGES.media.htmlInDescription = media.htmlInDescription;
    }
  }

  if (void 0 !== profile) {
    if (true === profile.htmlInDescription) {
      PAGES.profile.htmlInDescription = profile.htmlInDescription;
    }

    if (true === profile.includeHistory) {
      PAGES.profile.includeHistory = profile.includeHistory;
    }

    if (true === profile.includeLikedMedia) {
      PAGES.profile.includeLikedMedia = profile.includeLikedMedia;
    }
  }
}

export function settings() {
  return PAGES;
}
