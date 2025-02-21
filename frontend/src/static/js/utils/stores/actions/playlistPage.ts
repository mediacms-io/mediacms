import {
  LOAD_PLAYLIST_DATA,
  LOAD_PLAYLIST_SUCCESS,
  LOAD_PLAYLIST_ERROR,
  TOGGLE_SAVE,
  UPDATE_PLAYLIST,
  REMOVE_PLAYLIST,
  PLAYLIST_MEDIA_REORDERED,
  MEDIA_REMOVED_FROM_PLAYLIST,
  PlaylistPageActionTypes,
  PlaylistData,
  PlaylistMedia,
} from '../types';

import { AppDispatch } from '../store';
import { getRequest, postRequest, putRequest, deleteRequest, csrfToken } from '../../helpers';
import { config as mediacmsConfig } from '../../settings/config';

const mediacms_api = mediacmsConfig(window.MediaCMS).api;

export const loadPlaylistData = (playlistId: string) => (dispatch: AppDispatch) => {
  dispatch({ type: LOAD_PLAYLIST_DATA, payload: playlistId });

  getRequest(
    `${mediacms_api.playlists}/${playlistId}`,
    false,
    (response) => {
      if (response?.data) {
        console.log(response);
        dispatch({
          type: LOAD_PLAYLIST_SUCCESS,
          payload: response.data as PlaylistData,
        });
      }
    },
    () => {
      dispatch({ type: LOAD_PLAYLIST_ERROR });
    }
  );
};

export const toggleSave = (): PlaylistPageActionTypes => ({
  type: TOGGLE_SAVE,
});

export const updatePlaylist = (playlistId: string, title: string, description: string) => (dispatch: AppDispatch) => {
  postRequest(
    `${mediacms_api.playlists}/${playlistId}`,
    { title, description },
    { headers: { 'X-CSRFToken': csrfToken() } },
    false,
    () => {
      dispatch({
        type: UPDATE_PLAYLIST,
        payload: { title, description },
      });
    },
    (error) => {
      console.error('Failed to update playlist:', error);
    }
  );
};

export const removePlaylist = (playlistId: string) => (dispatch: AppDispatch) => {
  deleteRequest(
    `${mediacms_api.playlists}/${playlistId}`,
    { headers: { 'X-CSRFToken': csrfToken() } },
    false,
    () => {
      dispatch({ type: REMOVE_PLAYLIST });
    },
    (error) => {
      console.error('Failed to remove playlist:', error);
    }
  );
};

export const reorderPlaylistMedia = (playlistMedia: []) => (dispatch: AppDispatch) => {
  dispatch({
    type: PLAYLIST_MEDIA_REORDERED,
    payload: playlistMedia,
  });
};

export const removedMediaFromPlaylist = (media_id: string, playlist_id: string) => ({
  type: MEDIA_REMOVED_FROM_PLAYLIST,
  media_id,
  playlist_id,
});
