import { dispatcher } from '../dispatcher';

export function loadPlaylistData() {
    dispatcher.dispatch({ type: 'LOAD_PLAYLIST_DATA' });
}

export function toggleSave() {
    dispatcher.dispatch({ type: 'TOGGLE_SAVE' });
}

export function updatePlaylist(playlist_data: { title: string; description: string }) {
    dispatcher.dispatch({ type: 'UPDATE_PLAYLIST', playlist_data });
}

export function removePlaylist() {
    dispatcher.dispatch({ type: 'REMOVE_PLAYLIST' });
}

export function removedMediaFromPlaylist(media_id: string, playlist_id: string) {
    dispatcher.dispatch({ type: 'MEDIA_REMOVED_FROM_PLAYLIST', media_id, playlist_id });
}

// @todo: Revisit this
export function reorderedMediaInPlaylist(newMediaData: { [k: string]: any; thumbnail_url: string; url: string }[]) {
    dispatcher.dispatch({ type: 'PLAYLIST_MEDIA_REORDERED', playlist_media: newMediaData });
}
