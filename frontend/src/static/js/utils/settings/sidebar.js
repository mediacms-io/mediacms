let SIDEBAR = null;

export function init(settings) {
  SIDEBAR = {
    hideHomeLink: false,
    hideTagsLink: false,
    hideCategoriesLink: false,
    hideContactLink: false,
  };

  if (void 0 !== settings) {
    if ('boolean' === typeof settings.hideHomeLink) {
      SIDEBAR.hideHomeLink = settings.hideHomeLink;
    }

    if ('boolean' === typeof settings.hideTagsLink) {
      SIDEBAR.hideTagsLink = settings.hideTagsLink;
    }

    if ('boolean' === typeof settings.hideCategoriesLink) {
      SIDEBAR.hideCategoriesLink = settings.hideCategoriesLink;
    }

    if ('boolean' === typeof settings.hideContactLink) {
      SIDEBAR.hideContactLink = settings.hideContactLink;
    }
  }
}

export function settings() {
  return SIDEBAR;
}
