import {
  TOGGLE_LOOP,
  TOGGLE_SHUFFLE,
  TOGGLE_SAVE,
  SET_PLAYLIST_ID,
  LOAD_PLAYLIST_STATE,
  PlaylistViewActionTypes,
} from '../types';
import { AppDispatch, RootState } from '../store';

// Action Creators
export const toggleLoop = (): PlaylistViewActionTypes => ({
  type: TOGGLE_LOOP,
});

export const toggleShuffle = (): PlaylistViewActionTypes => ({
  type: TOGGLE_SHUFFLE,
});

export const toggleSave = (): PlaylistViewActionTypes => ({
  type: TOGGLE_SAVE,
});

export const setPlaylistId = (playlistId: string | null): PlaylistViewActionTypes => ({
  type: SET_PLAYLIST_ID,
  payload: playlistId,
});

// Thunk: Load Playlist State from Persisted Store
export const loadPlaylistState = (playlistId: string) => {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const cachedLoop = state.playlistView.loop[playlistId] ?? true; // Default: true
    const cachedShuffle = state.playlistView.shuffle[playlistId] ?? false; // Default: false

    dispatch({
      type: LOAD_PLAYLIST_STATE,
      payload: { playlistId, loop: cachedLoop, shuffle: cachedShuffle },
    });
  };
};
