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
} from '../types';

interface PlaylistPageState {
  playlistId: string | null;
  data: PlaylistData | null;
  savedPlaylist: boolean;
  loading: boolean;
  error: boolean;
}

const initialState: PlaylistPageState = {
  playlistId: null,
  data: null,
  savedPlaylist: false,
  loading: false,
  error: false,
};

const playlistPageReducer = (state = initialState, action: PlaylistPageActionTypes): PlaylistPageState => {
  switch (action.type) {
    case LOAD_PLAYLIST_DATA:
      return { ...state, playlistId: action.payload, loading: true };

    case LOAD_PLAYLIST_SUCCESS:
      return { ...state, data: action.payload, loading: false, error: false };

    case LOAD_PLAYLIST_ERROR:
      return { ...state, loading: false, error: true };

    case TOGGLE_SAVE:
      return { ...state, savedPlaylist: !state.savedPlaylist };

    case UPDATE_PLAYLIST:
      return state.data
        ? { ...state, data: { ...state.data, title: action.payload.title, description: action.payload.description } }
        : state;

    case REMOVE_PLAYLIST:
      return initialState;

    case PLAYLIST_MEDIA_REORDERED:
      return state.data
        ? {
            ...state,
            data: {
              ...state.data,
              playlist_media: action.payload,
            },
          }
        : state;

    // Handle media removal from playlist
    case MEDIA_REMOVED_FROM_PLAYLIST:
      if (state.data) {
        const new_playlist_media = state.data.playlist_media.filter(
          (media) => media.url.split('=')[1] !== action.media_id
        );
        return {
          ...state,
          data: {
            ...state.data,
            playlist_media: new_playlist_media,
          },
        };
      }
      return state;

    default:
      return state;
  }
};

export default playlistPageReducer;
