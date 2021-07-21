import Dispatcher from '../dispatcher.js';

export function requestPredictions(query) {
  Dispatcher.dispatch({
    type: 'REQUEST_PREDICTIONS',
    query,
  });
}
