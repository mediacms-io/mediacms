export const REQUEST_PREDICTIONS = 'REQUEST_PREDICTIONS';
export const SET_PREDICTIONS = 'SET_PREDICTIONS';
export const SET_SEARCH_QUERY = 'SET_SEARCH_QUERY';
export const SET_RESULTS_COUNT = 'SET_RESULTS_COUNT';

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
