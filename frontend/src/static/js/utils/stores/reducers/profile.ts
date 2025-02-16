import {
  LOAD_AUTHOR_DATA_REQUEST,
  LOAD_AUTHOR_DATA_SUCCESS,
  LOAD_AUTHOR_DATA_FAILURE,
  REMOVE_PROFILE_REQUEST,
  REMOVE_PROFILE_SUCCESS,
  REMOVE_PROFILE_FAILURE,
  UPDATE_SEARCH_QUERY,
  ProfileActionTypes,
  ProfileState,
} from '../types';

const initialState: ProfileState = {
  authorData: null,
  authorQuery: '',
  loading: false,
  removingProfile: false,
  error: null,
};

const profileReducer = (state = initialState, action: ProfileActionTypes): ProfileState => {
  switch (action.type) {
    case LOAD_AUTHOR_DATA_REQUEST:
      return { ...state, loading: true, error: null };

    case LOAD_AUTHOR_DATA_SUCCESS:
      return {
        ...state,
        loading: false,
        authorData: action.payload,
      };

    case LOAD_AUTHOR_DATA_FAILURE:
      return { ...state, loading: false, error: action.error };

    case REMOVE_PROFILE_REQUEST:
      return { ...state, removingProfile: true };

    case REMOVE_PROFILE_SUCCESS:
      return { ...state, removingProfile: false, authorData: null };

    case REMOVE_PROFILE_FAILURE:
      return { ...state, removingProfile: false, error: action.error };

    case UPDATE_SEARCH_QUERY:
      return {
        ...state,
        authorQuery: action.payload,
      };

    default:
      return state;
  }
};

export default profileReducer;
