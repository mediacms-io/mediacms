let PLAYLISTS = null;

export function init(plists) {
  PLAYLISTS = {
    mediaTypes: [],
  };

  if (void 0 !== plists) {
    if (void 0 !== plists.mediaTypes) {
      if (plists.mediaTypes.length) {
        PLAYLISTS.mediaTypes = [];

        let i = 0;
        while (i < plists.mediaTypes.length) {
          switch (plists.mediaTypes[i]) {
            case 'audio':
            case 'video':
              PLAYLISTS.mediaTypes.push(plists.mediaTypes[i]);
              break;
          }

          i += 1;
        }
      }
    }
  }

  if (!PLAYLISTS.mediaTypes.length) {
    PLAYLISTS.mediaTypes = ['audio', 'video'];
  }
}

export function settings() {
  return PLAYLISTS;
}
