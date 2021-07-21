import Dispatcher from '../dispatcher.js';

export function set_viewer_mode(inTheaterMode) {
  Dispatcher.dispatch({
    type: 'SET_VIEWER_MODE',
    inTheaterMode,
  });
}

export function set_player_volume(playerVolume) {
  Dispatcher.dispatch({
    type: 'SET_PLAYER_VOLUME',
    playerVolume,
  });
}

export function set_player_sound_muted(playerSoundMuted) {
  Dispatcher.dispatch({
    type: 'SET_PLAYER_SOUND_MUTED',
    playerSoundMuted,
  });
}

export function set_video_quality(quality) {
  Dispatcher.dispatch({
    type: 'SET_VIDEO_QUALITY',
    quality,
  });
}

export function set_video_playback_speed(playbackSpeed) {
  Dispatcher.dispatch({
    type: 'SET_VIDEO_PLAYBACK_SPEED',
    playbackSpeed,
  });
}
