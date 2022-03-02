import Dispatcher from '../dispatcher.js';

export function loadMediaData() {
  Dispatcher.dispatch({
    type: 'LOAD_MEDIA_DATA',
  });
}

export function likeMedia() {
  Dispatcher.dispatch({
    type: 'LIKE_MEDIA',
  });
}

export function dislikeMedia() {
  Dispatcher.dispatch({
    type: 'DISLIKE_MEDIA',
  });
}

export function reportMedia(reportDescription) {
  Dispatcher.dispatch({
    type: 'REPORT_MEDIA',
    reportDescription: !!reportDescription ? reportDescription.replace(/\s/g, '') : '',
  });
}

export function copyShareLink(inputElem) {
  Dispatcher.dispatch({
    type: 'COPY_SHARE_LINK',
    inputElement: inputElem,
  });
}

export function copyEmbedMediaCode(inputElem) {
  Dispatcher.dispatch({
    type: 'COPY_EMBED_MEDIA_CODE',
    inputElement: inputElem,
  });
}

export function removeMedia() {
  Dispatcher.dispatch({
    type: 'REMOVE_MEDIA',
  });
}

export function submitComment(commentText) {
  Dispatcher.dispatch({
    type: 'SUBMIT_COMMENT',
    commentText,
  });
}

export function deleteComment(commentId) {
  Dispatcher.dispatch({
    type: 'DELETE_COMMENT',
    commentId,
  });
}

export function createPlaylist(playlist_data) {
  Dispatcher.dispatch({
    type: 'CREATE_PLAYLIST',
    playlist_data,
  });
}

export function addMediaToPlaylist(playlist_id, media_id) {
  Dispatcher.dispatch({
    type: 'ADD_MEDIA_TO_PLAYLIST',
    playlist_id,
    media_id,
  });
}

export function removeMediaFromPlaylist(playlist_id, media_id) {
  Dispatcher.dispatch({
    type: 'REMOVE_MEDIA_FROM_PLAYLIST',
    playlist_id,
    media_id,
  });
}

export function addNewPlaylist(playlist_data) {
  Dispatcher.dispatch({
    type: 'APPEND_NEW_PLAYLIST',
    playlist_data,
  });
}
