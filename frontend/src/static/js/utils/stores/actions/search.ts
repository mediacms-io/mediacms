import { Dispatch } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { RootState } from '../store'; // Ensure correct path to store
import { REQUEST_PREDICTIONS, SET_PREDICTIONS, SET_RESULTS_COUNT, SET_SEARCH_QUERY, SearchActionTypes } from '../types';
import { config as mediacmsConfig } from '../../settings/config';
import { getRequest } from '../../helpers';

interface PredictionResponse {
  data: { title: string }[];
}

export const setPredictions = (predictions: string[]): SearchActionTypes => ({
  type: SET_PREDICTIONS,
  predictions,
});

export const setSearchQuery = (query: string, categories?: string, tags?: string): SearchActionTypes => ({
  type: SET_SEARCH_QUERY,
  payload: { query, categories, tags },
});

export const setResultsCount = (count: number | null): SearchActionTypes => ({
  type: SET_RESULTS_COUNT,
  payload: count,
});

export const requestPredictions =
  (query: string): ThunkAction<void, RootState, unknown, SearchActionTypes> =>
  async (dispatch: Dispatch<SearchActionTypes>, getState: () => RootState) => {
    const state = getState().search;
    const mediacms_config = mediacmsConfig(window.MediaCMS);
    const queryUrl = mediacms_config.api.search.titles + query;

    if (state.requestedQuery === query) {
      return;
    }

    dispatch({ type: REQUEST_PREDICTIONS, query });

    try {
      getRequest(
        queryUrl,
        false,
        (response: PredictionResponse) => {
          if (response && response.data) {
            const predictions = response.data.map((item) => item.title);
            dispatch(setPredictions(predictions));
          }
        },
        (error: any) => {
          console.error('Error fetching predictions:', error);
        }
      );
    } catch (error) {
      console.error('Request failed:', error);
    }
  };
