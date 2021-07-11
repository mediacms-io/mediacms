let THEME = null;

export function init(theme, logo) {
  THEME = {
    mode: 'light', // Valid options: 'light', 'dark'.
    switch: {
      enabled: true,
      position: 'header', // Valid options: 'header', 'sidebar'.
    },
    logo: {
      lightMode: {
        img: '',
        svg: '',
      },
      darkMode: {
        img: '',
        svg: '',
      },
    },
  };

  if (void 0 !== theme) {
    if ('string' === typeof theme.mode) {
      THEME.mode = theme.mode.trim();
      THEME.mode = 'dark' === THEME.mode ? 'dark' : 'light';
    }

    if (void 0 !== theme.switch) {
      if (false === theme.switch.enabled) {
        THEME.switch.enabled = theme.switch.enabled;
      }

      if ('string' === typeof theme.switch.position) {
        THEME.switch.position = theme.switch.position.trim();
        THEME.switch.position = 'sidebar' === theme.switch.position ? 'sidebar' : 'header';
      }
    }
  }

  if (void 0 !== logo) {
    if (void 0 !== logo.lightMode) {
      if ('string' === typeof logo.lightMode.img) {
        THEME.logo.lightMode.img = logo.lightMode.img.trim();
      }

      if ('string' === typeof logo.lightMode.svg) {
        THEME.logo.lightMode.svg = logo.lightMode.svg.trim();
      }
    }

    if (void 0 !== logo.darkMode) {
      if ('string' === typeof logo.darkMode.img) {
        THEME.logo.darkMode.img = logo.darkMode.img.trim();
      }

      if ('string' === typeof logo.darkMode.svg) {
        THEME.logo.darkMode.svg = logo.darkMode.svg.trim();
      }
    }
  }
}

export function settings() {
  return THEME;
}
