import { dispatcher } from '../dispatcher';

export function requestPredictions(query: string) {
    dispatcher.dispatch({ type: 'REQUEST_PREDICTIONS', query });
}
