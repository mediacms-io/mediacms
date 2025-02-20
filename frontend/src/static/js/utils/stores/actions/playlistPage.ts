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
      console.log('aaaaaaaaaa', csrfToken());
      console.error('Failed to update playlist:', error);
    }
  );
};

export const removePlaylist = (playlistId: string) => (dispatch: AppDispatch) => {
  deleteRequest(
    `${mediacms_api.playlists}/${playlistId}/delete`,
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

export const reorderPlaylistMedia = (playlistId: string, playlistMedia: PlaylistMedia[]) => (dispatch: AppDispatch) => {
  putRequest(
    `${mediacms_api.playlists}/${playlistId}/reorder`,
    { playlistMedia },
    { headers: { 'X-CSRFToken': csrfToken() } },
    false,
    () => {
      dispatch({
        type: PLAYLIST_MEDIA_REORDERED,
        payload: playlistMedia,
      });
    },
    (error) => {
      console.error('Failed to reorder playlist media:', error);
    }
  );
};

export const removeMediaFromPlaylist = (playlistId: string, mediaId: string) => (dispatch: AppDispatch) => {
  putRequest(
    `${mediacms_api.playlists}/${playlistId}/remove-media`,
    { mediaId },
    { headers: { 'X-CSRFToken': csrfToken() } },
    false,
    () => {
      dispatch({
        type: MEDIA_REMOVED_FROM_PLAYLIST,
        payload: mediaId,
      });
    },
    (error) => {
      console.error('Failed to remove media from playlist:', error);
    }
  );
};
