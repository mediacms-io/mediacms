import EventEmitter from 'events';
import { exportStore } from '../helpers';
import PageStore from './PageStore';
import MediaPageStore from './MediaPageStore';

class PlaylistViewStore extends EventEmitter {
  constructor() {
    super();

    this.data = {
      playlistId: null,
      enabledLoop: null,
      enabledShuffle: null,
      savedPlaylist: false,
      response: null,
    };

    this.browserCache = PageStore.get('browser-cache');
  }

  get(type) {
    switch (type) {
      case 'logged-in-user-playlist':
        // TODO: Continue here.
        return false;
      case 'enabled-loop':
        if (null === this.data.playlistId) {
          this.data.playlistId = MediaPageStore.get('playlist-id');
          this.data.enabledLoop = this.browserCache.get('loopPlaylist[' + this.data.playlistId + ']');
          this.data.enabledLoop = null === this.data.enabledLoop ? true : this.data.enabledLoop;
        }
        return this.data.enabledLoop;
      case 'enabled-shuffle':
        if (null === this.data.playlistId) {
          this.data.playlistId = MediaPageStore.get('playlist-id');
          this.data.enabledShuffle = this.browserCache.get('shufflePlaylist[' + this.data.playlistId + ']');
          this.data.enabledShuffle = null === this.data.enabledShuffle ? false : this.data.enabledShuffle;
        }
        return this.data.enabledShuffle;
      case 'saved-playlist':
        return this.data.savedPlaylist;
    }
    return null;
  }

  actions_handler(action) {
    switch (action.type) {
      case 'TOGGLE_LOOP':
        if (null === this.data.playlistId) {
          this.data.playlistId = MediaPageStore.get('playlist-id');
          this.data.enabledLoop = this.browserCache.get('loopPlaylist[' + this.data.playlistId + ']');
          this.data.enabledLoop = null === this.data.enabledLoop ? true : this.data.enabledLoop;
        }
        this.data.enabledLoop = !this.data.enabledLoop;
        this.browserCache.set('loopPlaylist[' + this.data.playlistId + ']', this.data.enabledLoop);
        this.emit('loop-repeat-updated');
        break;
      case 'TOGGLE_SHUFFLE':
        if (null === this.data.playlistId) {
          this.data.playlistId = MediaPageStore.get('playlist-id');
          this.data.enabledShuffle = this.browserCache.get('shufflePlaylist[' + this.data.playlistId + ']');
          this.data.enabledShuffle = null === this.data.enabledShuffle ? false : this.data.enabledShuffle;
        }
        this.data.enabledShuffle = !this.data.enabledShuffle;
        this.browserCache.set('shufflePlaylist[' + this.data.playlistId + ']', this.data.enabledShuffle);
        this.emit('shuffle-updated');
        break;
      case 'TOGGLE_SAVE':
        this.data.savedPlaylist = !this.data.savedPlaylist;
        this.emit('saved-updated');
        break;
    }
  }
}

export default exportStore(new PlaylistViewStore(), 'actions_handler');
