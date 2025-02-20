import {
  TOGGLE_LOOP,
  TOGGLE_SHUFFLE,
  TOGGLE_SAVE,
  SET_PLAYLIST_ID,
  LOAD_PLAYLIST_STATE,
  PlaylistViewActionTypes,
} from '../types';

interface PlaylistViewState {
  playlistId: string | null;
  loop: Record<string, boolean>;
  shuffle: Record<string, boolean>;
  savedPlaylist: boolean;
}

// Initial State
const initialState: PlaylistViewState = {
  playlistId: null,
  loop: {},
  shuffle: {},
  savedPlaylist: false,
};

// Reducer Function
const playlistViewReducer = (state = initialState, action: PlaylistViewActionTypes): PlaylistViewState => {
  switch (action.type) {
    case SET_PLAYLIST_ID:
      return {
        ...state,
        playlistId: action.payload,
      };

    case LOAD_PLAYLIST_STATE:
      return {
        ...state,
        playlistId: action.payload.playlistId,
        loop: { ...state.loop, [action.payload.playlistId]: action.payload.loop },
        shuffle: { ...state.shuffle, [action.payload.playlistId]: action.payload.shuffle },
      };

    case TOGGLE_LOOP:
      if (!state.playlistId) return state;
      return {
        ...state,
        loop: {
          ...state.loop,
          [state.playlistId]: !state.loop[state.playlistId],
        },
      };

    case TOGGLE_SHUFFLE:
      if (!state.playlistId) return state;
      return {
        ...state,
        shuffle: {
          ...state.shuffle,
          [state.playlistId]: !state.shuffle[state.playlistId],
        },
      };

    case TOGGLE_SAVE:
      return {
        ...state,
        savedPlaylist: !state.savedPlaylist,
      };

    default:
      return state;
  }
};

export default playlistViewReducer;
