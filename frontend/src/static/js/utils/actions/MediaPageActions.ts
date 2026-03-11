import { dispatcher } from '../dispatcher';

export function loadMediaData() {
    dispatcher.dispatch({ type: 'LOAD_MEDIA_DATA' });
}

export function likeMedia() {
    dispatcher.dispatch({ type: 'LIKE_MEDIA' });
}

export function dislikeMedia() {
    dispatcher.dispatch({ type: 'DISLIKE_MEDIA' });
}

// @todo: Revisit this
export function reportMedia(reportDescription?: string | null) {
    dispatcher.dispatch({
        type: 'REPORT_MEDIA',
        reportDescription: typeof reportDescription === 'string' ? reportDescription.replace(/\s/g, '') : '',
    });
}

export function copyShareLink(inputElem: HTMLInputElement) {
    dispatcher.dispatch({ type: 'COPY_SHARE_LINK', inputElement: inputElem });
}

export function copyEmbedMediaCode(inputElem: HTMLTextAreaElement) {
    dispatcher.dispatch({ type: 'COPY_EMBED_MEDIA_CODE', inputElement: inputElem });
}

export function removeMedia() {
    dispatcher.dispatch({ type: 'REMOVE_MEDIA' });
}

export function submitComment(commentText: string) {
    dispatcher.dispatch({ type: 'SUBMIT_COMMENT', commentText });
}

export function deleteComment(commentId: string | number) {
    dispatcher.dispatch({ type: 'DELETE_COMMENT', commentId });
}

export function createPlaylist(playlist_data: { title: string; description: string }) {
    dispatcher.dispatch({ type: 'CREATE_PLAYLIST', playlist_data });
}

export function addMediaToPlaylist(playlist_id: string, media_id: string) {
    dispatcher.dispatch({ type: 'ADD_MEDIA_TO_PLAYLIST', playlist_id, media_id });
}

export function removeMediaFromPlaylist(playlist_id: string, media_id: string) {
    dispatcher.dispatch({ type: 'REMOVE_MEDIA_FROM_PLAYLIST', playlist_id, media_id });
}

export function addNewPlaylist(playlist_data: {
    playlist_id: string;
    add_date: Date; // @todo: Revisit this
    description: string;
    title: string;
    media_list: string[]; // @todo: Revisit this
}) {
    dispatcher.dispatch({ type: 'APPEND_NEW_PLAYLIST', playlist_data });
}
