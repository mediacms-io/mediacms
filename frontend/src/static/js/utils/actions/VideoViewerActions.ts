import { dispatcher } from '../dispatcher';

export function set_viewer_mode(inTheaterMode: boolean) {
    dispatcher.dispatch({ type: 'SET_VIEWER_MODE', inTheaterMode });
}

export function set_player_volume(playerVolume: number) {
    dispatcher.dispatch({ type: 'SET_PLAYER_VOLUME', playerVolume });
}

export function set_player_sound_muted(playerSoundMuted: boolean) {
    dispatcher.dispatch({ type: 'SET_PLAYER_SOUND_MUTED', playerSoundMuted });
}

export function set_video_quality(
    quality: 'auto' | number // @todo: Check this again
) {
    dispatcher.dispatch({ type: 'SET_VIDEO_QUALITY', quality });
}

export function set_video_playback_speed(playbackSpeed: number) {
    dispatcher.dispatch({ type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed });
}
