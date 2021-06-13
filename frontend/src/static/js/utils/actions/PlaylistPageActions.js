import Dispatcher from '../dispatcher.js';

export function loadPlaylistData() {
  Dispatcher.dispatch({
    type: 'LOAD_PLAYLIST_DATA',
  });
}

export function toggleSave() {
  Dispatcher.dispatch({
    type: 'TOGGLE_SAVE',
  });
}

export function updatePlaylist(playlist_data) {
  Dispatcher.dispatch({
    type: 'UPDATE_PLAYLIST',
    playlist_data,
  });
}

export function removePlaylist() {
  Dispatcher.dispatch({
    type: 'REMOVE_PLAYLIST',
  });
}

export function removedMediaFromPlaylist(media_id, playlist_id) {
  Dispatcher.dispatch({
    type: 'MEDIA_REMOVED_FROM_PLAYLIST',
    media_id,
    playlist_id,
  });
}

export function reorderedMediaInPlaylist(newMediaData) {
  Dispatcher.dispatch({
    type: 'PLAYLIST_MEDIA_REORDERED',
    playlist_media: newMediaData,
  });
}
