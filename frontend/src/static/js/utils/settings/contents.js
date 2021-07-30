let CONTENTS = null;

function headerContents(contents) {
  const ret = {
    right: '',
    onLogoRight: '',
  };

  if (void 0 !== contents) {
    if ('string' === typeof contents.right) {
      ret.right = contents.right.trim();
    }

    if ('string' === typeof contents.onLogoRight) {
      ret.onLogoRight = contents.onLogoRight.trim();
    }
  }

  return ret;
}

function sidebarContents(contents) {
  const ret = {
    navMenu: {
      items: [],
    },
    mainMenuExtra: {
      items: [],
    },
    belowNavMenu: '',
    belowThemeSwitcher: '',
    footer: '',
  };

  if (undefined !== contents) {
    if (undefined !== contents.mainMenuExtraItems) {
      let i = 0;
      while (i < contents.mainMenuExtraItems.length) {
        if (
          'string' === typeof contents.mainMenuExtraItems[i].text &&
          'string' === typeof contents.mainMenuExtraItems[i].link &&
          'string' === typeof contents.mainMenuExtraItems[i].icon
        ) {
          ret.mainMenuExtra.items.push({
            text: contents.mainMenuExtraItems[i].text,
            link: contents.mainMenuExtraItems[i].link,
            icon: contents.mainMenuExtraItems[i].icon,
            className: contents.mainMenuExtraItems[i].className,
          });
        }

        i += 1;
      }
    }

    if (undefined !== contents.navMenuItems) {
      let i = 0;
      while (i < contents.navMenuItems.length) {
        if (
          'string' === typeof contents.navMenuItems[i].text &&
          'string' === typeof contents.navMenuItems[i].link &&
          'string' === typeof contents.navMenuItems[i].icon
        ) {
          ret.navMenu.items.push({
            text: contents.navMenuItems[i].text,
            link: contents.navMenuItems[i].link,
            icon: contents.navMenuItems[i].icon,
            className: contents.navMenuItems[i].className,
          });
        }

        i += 1;
      }
    }

    if ('string' === typeof contents.belowNavMenu) {
      ret.belowNavMenu = contents.belowNavMenu.trim();
    }

    if ('string' === typeof contents.belowThemeSwitcher) {
      ret.belowThemeSwitcher = contents.belowThemeSwitcher.trim();
    }

    if ('string' === typeof contents.footer) {
      ret.footer = contents.footer.trim();
    }
  }

  return ret;
}

function uploaderContents(contents) {
  const ret = {
    belowUploadArea: '',
    postUploadMessage: '',
  };

  if (void 0 !== contents) {
    if ('string' === typeof contents.belowUploadArea) {
      ret.belowUploadArea = contents.belowUploadArea.trim();
    }

    if ('string' === typeof contents.postUploadMessage) {
      ret.postUploadMessage = contents.postUploadMessage.trim();
    }
  }

  return ret;
}

export function init(contents) {
  CONTENTS = {
    header: headerContents(contents.header),
    sidebar: sidebarContents(contents.sidebar),
    uploader: uploaderContents(contents.uploader),
  };
}

export function settings() {
  return CONTENTS;
}
