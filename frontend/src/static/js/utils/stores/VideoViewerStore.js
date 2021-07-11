import EventEmitter from 'events';
import { exportStore } from '../helpers/';
import { BrowserCache } from '../classes/';

import { config as mediacmsConfig } from '../settings/config.js';

let browserCache;

const _StoreData = {};

class VideoPlayerStore extends EventEmitter {
  constructor() {
    super();

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    browserCache = new BrowserCache(this.mediacms_config.site.id, 86400); // Keep cache data "fresh" for one day.

    _StoreData.inTheaterMode = browserCache.get('in-theater-mode');
    _StoreData.inTheaterMode = null !== _StoreData.inTheaterMode ? _StoreData.inTheaterMode : !1;

    _StoreData.playerVolume = browserCache.get('player-volume');
    _StoreData.playerVolume =
      null === _StoreData.playerVolume ? 1 : Math.max(Math.min(Number(_StoreData.playerVolume), 1), 0);

    _StoreData.playerSoundMuted = browserCache.get('player-sound-muted');
    _StoreData.playerSoundMuted = null !== _StoreData.playerSoundMuted ? _StoreData.playerSoundMuted : !1;

    _StoreData.videoQuality = browserCache.get('video-quality');
    _StoreData.videoQuality = null !== _StoreData.videoQuality ? _StoreData.videoQuality : 'Auto';

    _StoreData.videoPlaybackSpeed = browserCache.get('video-playback-speed');
    _StoreData.videoPlaybackSpeed = null !== _StoreData.videoPlaybackSpeed ? _StoreData.videoPlaybackSpeed : !1;
  }

  get(type) {
    let r = null;
    switch (type) {
      case 'player-volume':
        r = _StoreData.playerVolume;
        break;
      case 'player-sound-muted':
        r = _StoreData.playerSoundMuted;
        break;
      case 'in-theater-mode':
        r = _StoreData.inTheaterMode;
        break;
      case 'video-data':
        r = _StoreData.videoData;
        break;
      case 'video-quality':
        r = _StoreData.videoQuality;
        break;
      case 'video-playback-speed':
        r = _StoreData.videoPlaybackSpeed;
        break;
    }
    return r;
  }

  actions_handler(action) {
    switch (action.type) {
      case 'TOGGLE_VIEWER_MODE':
        _StoreData.inTheaterMode = !_StoreData.inTheaterMode;
        this.emit('changed_viewer_mode');
        break;
      case 'SET_VIEWER_MODE':
        _StoreData.inTheaterMode = action.inTheaterMode;
        browserCache.set('in-theater-mode', _StoreData.inTheaterMode);
        this.emit('changed_viewer_mode');
        break;
      case 'SET_PLAYER_VOLUME':
        _StoreData.playerVolume = action.playerVolume;
        browserCache.set('player-volume', action.playerVolume);
        this.emit('changed_player_volume');
        break;
      case 'SET_PLAYER_SOUND_MUTED':
        _StoreData.playerSoundMuted = action.playerSoundMuted;
        browserCache.set('player-sound-muted', action.playerSoundMuted);
        this.emit('changed_player_sound_muted');
        break;
      case 'SET_VIDEO_QUALITY':
        _StoreData.videoQuality = action.quality;
        browserCache.set('video-quality', action.quality);
        this.emit('changed_video_quality');
        break;
      case 'SET_VIDEO_PLAYBACK_SPEED':
        _StoreData.videoPlaybackSpeed = action.playbackSpeed;
        browserCache.set('video-playback-speed', action.playbackSpeed);
        this.emit('changed_video_playback_speed');
        break;
    }
  }
}

export default exportStore(new VideoPlayerStore(), 'actions_handler');
