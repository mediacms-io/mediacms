let MEDIA = null;

export function init(item, shareOptions) {
  MEDIA = {
    item: {
      displayAuthor: true,
      displayViews: true,
      displayPublishDate: true,
    },
    share: {
      options: [],
    },
  };

  if (void 0 !== item) {

    if (true === item.hideAuthor) {
      MEDIA.item.displayAuthor = false;
    }

    if (true === item.hideViews) {
      MEDIA.item.displayViews = false;
    }

    if (true === item.hideDate) {
      MEDIA.item.displayPublishDate = false;
    }
  }

  if (void 0 !== shareOptions) {
    const validShareOptions = [
      'embed',
      'email',
    ];

    let i = 0;
    while (i < shareOptions.length) {
      if (-1 < validShareOptions.indexOf(shareOptions[i])) {
        MEDIA.share.options.push(shareOptions[i]);
      }

      i += 1;
    }
  }
}

export function settings() {
  return MEDIA;
}
