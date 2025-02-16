export const REQUEST_PREDICTIONS = 'REQUEST_PREDICTIONS';
export const SET_PREDICTIONS = 'SET_PREDICTIONS';
export const SET_SEARCH_QUERY = 'SET_SEARCH_QUERY';
export const SET_RESULTS_COUNT = 'SET_RESULTS_COUNT';

// Profile Types
export const LOAD_AUTHOR_DATA_REQUEST = 'LOAD_AUTHOR_DATA_REQUEST';
export const LOAD_AUTHOR_DATA_SUCCESS = 'LOAD_AUTHOR_DATA_SUCCESS';
export const LOAD_AUTHOR_DATA_FAILURE = 'LOAD_AUTHOR_DATA_FAILURE';

export const REMOVE_PROFILE_REQUEST = 'REMOVE_PROFILE_REQUEST';
export const REMOVE_PROFILE_SUCCESS = 'REMOVE_PROFILE_SUCCESS';
export const REMOVE_PROFILE_FAILURE = 'REMOVE_PROFILE_FAILURE';

export const UPDATE_SEARCH_QUERY = 'UPDATE_SEARCH_QUERY';

export interface UpdateSearchQueryAction {
  type: typeof UPDATE_SEARCH_QUERY;
  payload: string;
}

export interface AuthorData {
  description: string;
  date_added: string;
  name: string;
  is_featured: boolean;
  thumbnail_url: string;
  banner_thumbnail_url: string;
  url: string;
  username: string;
  media_info: {
    results: any[];
    user_media: string;
  };
  api_url: string;
  edit_url: string;
  default_channel_edit_url: string;
}

export interface ProfileState {
  authorData: AuthorData | null;
  authorQuery: string | null;
  loading: boolean;
  removingProfile: boolean;
  error: string | null;
}

interface LoadAuthorDataRequest {
  type: typeof LOAD_AUTHOR_DATA_REQUEST;
}

interface LoadAuthorDataSuccess {
  type: typeof LOAD_AUTHOR_DATA_SUCCESS;
  payload: AuthorData;
}

interface LoadAuthorDataFailure {
  type: typeof LOAD_AUTHOR_DATA_FAILURE;
  error: string;
}

interface RemoveProfileRequest {
  type: typeof REMOVE_PROFILE_REQUEST;
}

interface RemoveProfileSuccess {
  type: typeof REMOVE_PROFILE_SUCCESS;
  payload: string; // Username of the deleted profile
}

interface RemoveProfileFailure {
  type: typeof REMOVE_PROFILE_FAILURE;
  error: string;
}

export interface RequestPredictionsAction {
  type: typeof REQUEST_PREDICTIONS;
  query: string;
}

export interface SetPredictionsAction {
  type: typeof SET_PREDICTIONS;
  predictions: string[];
}

export interface SetSearchQueryAction {
  type: typeof SET_SEARCH_QUERY;
  payload: {
    query: string;
    categories?: string;
    tags?: string;
  };
}

interface SetResultsCountAction {
  type: typeof SET_RESULTS_COUNT;
  payload: number | null;
}
export type SearchActionTypes =
  | SetResultsCountAction
  | RequestPredictionsAction
  | SetPredictionsAction
  | SetSearchQueryAction;

export type ProfileActionTypes =
  | LoadAuthorDataRequest
  | LoadAuthorDataSuccess
  | LoadAuthorDataFailure
  | RemoveProfileRequest
  | RemoveProfileSuccess
  | RemoveProfileFailure
  | UpdateSearchQueryAction;
