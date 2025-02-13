import { REQUEST_PREDICTIONS, SET_PREDICTIONS, SET_RESULTS_COUNT, SET_SEARCH_QUERY, SearchActionTypes } from '../types';

interface SearchState {
  searchQuery: string;
  categoriesQuery?: string;
  tagsQuery?: string;
  predictions: string[];
  requestedQuery: string | null;
  resultsCount: number | null;
}

const initialState: SearchState = {
  searchQuery: '',
  categoriesQuery: '',
  tagsQuery: '',
  predictions: [],
  requestedQuery: null,
  resultsCount: null,
};

const searchReducer = (state = initialState, action: SearchActionTypes): SearchState => {
  switch (action.type) {
    case SET_SEARCH_QUERY:
      return {
        ...state,
        searchQuery: action.payload.query,
        categoriesQuery: action.payload.categories,
        tagsQuery: action.payload.tags,
      };

    case REQUEST_PREDICTIONS:
      return {
        ...state,
        requestedQuery: action.query,
      };

    case SET_PREDICTIONS:
      return {
        ...state,
        predictions: action.predictions,
        requestedQuery: null,
      };

    case SET_RESULTS_COUNT:
      return {
        ...state,
        resultsCount: action.payload,
      };

    default:
      return state;
  }
};

export default searchReducer;
