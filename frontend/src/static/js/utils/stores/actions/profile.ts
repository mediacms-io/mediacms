import { Dispatch } from 'redux';
import { config as mediacmsConfig } from '../../settings/config';
import {
  LOAD_AUTHOR_DATA_REQUEST,
  LOAD_AUTHOR_DATA_SUCCESS,
  LOAD_AUTHOR_DATA_FAILURE,
  REMOVE_PROFILE_REQUEST,
  REMOVE_PROFILE_SUCCESS,
  REMOVE_PROFILE_FAILURE,
  UPDATE_SEARCH_QUERY,
  ProfileActionTypes,
  AuthorData,
} from '../types';
import { csrfToken, deleteRequest, getRequest } from '../../helpers';

const mediacmsConfigInstance = mediacmsConfig(window.MediaCMS);

export const loadAuthorData = () => (dispatch: Dispatch<ProfileActionTypes>) => {
  dispatch({ type: LOAD_AUTHOR_DATA_REQUEST });

  getRequest(
    `${mediacmsConfigInstance.api.users}/${window.MediaCMS.profileId}`,
    false,
    (response) => {
      if (response && response.data) {
        const authorData: AuthorData = {
          description: response.data.description || '',
          date_added: response.data.date_added || '',
          name: response.data.name || response.data.username || '',
          is_featured: response.data.is_featured || false,
          thumbnail_url: response.data.thumbnail_url || '',
          banner_thumbnail_url: response.data.banner_thumbnail_url || '',
          url: response.data.url || '',
          username: response.data.username || '',
          media_info: response.data.media_info || { results: [], user_media: '' },
          api_url: response.data.api_url || '',
          edit_url: response.data.edit_url || '',
          default_channel_edit_url: response.data.default_channel_edit_url || '',
        };
        dispatch({ type: LOAD_AUTHOR_DATA_SUCCESS, payload: authorData });
      }
    },
    (error) => {
      dispatch({ type: LOAD_AUTHOR_DATA_FAILURE, error: error.message });
    }
  );
};

export const removeProfile = (username: string) => (dispatch: Dispatch<ProfileActionTypes>) => {
  dispatch({ type: REMOVE_PROFILE_REQUEST });

  const deleteAPIurl = `${mediacmsConfigInstance.api.users}/${username}`;

  deleteRequest(
    deleteAPIurl,
    { headers: { 'X-CSRFToken': csrfToken() } },
    false,
    (response) => {
      if (response && response.status === 204) {
        dispatch({ type: REMOVE_PROFILE_SUCCESS, payload: username });
      }
    },
    (error) => {
      dispatch({ type: REMOVE_PROFILE_FAILURE, error: error.message });
    }
  );
};

export const updateSearchQuery = (query: string) => (dispatch: Dispatch<ProfileActionTypes>) => {
  dispatch({
    type: UPDATE_SEARCH_QUERY,
    payload: query,
  });
};
