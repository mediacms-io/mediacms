module.exports = {
  devEnv: 'true' === process.env.WEBPACK_DEV_SERVER,
  id: process.env.MEDIACMS_ID || 'mediacms-frontend',
  title: process.env.MEDIACMS_TITLE || 'MediaCMS Demo',
  url: process.env.MEDIACMS_URL || 'UNDEFINED_URL',
  api: process.env.MEDIACMS_API || 'UNDEFINED_API',
  useRoundedCorners: true,
  version: '1.0.0',
  theme: {
    mode: 'light', // Valid values: 'light', 'dark'.
    switch: {
      position: 'sidebar', // Valid values: 'header', 'sidebar'.
    },
  },
  logo: {
    lightMode: {
      svg: './static/images/logo_dark.svg',
      img: './static/images/logo_dark.png',
    },
    darkMode: {
      svg: './static/images/logo_light.svg',
      img: './static/images/logo_light.png',
    },
  },
  pages: {
    latest: {
      title: 'Recent uploads',
    },
    featured: {
      title: 'Featured',
    },
    recommended: {
      title: 'Recommended',
    },
    members: {
      title: 'Members',
    },
  },
  userPages: {
    liked: {
      title: 'Liked media',
    },
    history: {
      title: 'History',
    },
  },
  taxonomies: {
    tags: {
      title: 'Tags',
    },
    categories: {
      title: 'Categories',
    },
  },
};
