module.exports = {
  embeddedVideo: {
    initialDimensions: {
      width: 560, // In pixels.
      height: 315, // In pixels.
    },
  },
  headerBar: {
    hideLogin: false,
    hideRegister: false,
  },
  sideBar: {
    hideHomeLink: false,
    hideTagsLink: false,
    hideCategoriesLink: false,
  },
  media: {
    actions: {
      share: true,
      report: true,
      like: true,
      dislike: true,
      download: true,
      comment: true,
      save: true,
    },
    shareOptions: [
      'embed',
      'email',
    ],
  },
  mediaItem: {
    hideDate: false,
    hideViews: false,
    hideAuthor: false,
  },
  playlists: {
    mediaTypes: ['audio', 'video'],
  },
};
