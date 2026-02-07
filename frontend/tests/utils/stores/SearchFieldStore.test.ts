const urlParams = { q: 'search_query', c: 'category_1', t: 'tag_1' };
window.history.pushState({}, '', `/?q=${urlParams.q}&c=${urlParams.c}&t=${urlParams.t}`);

import store from '../../../src/static/js/utils/stores/SearchFieldStore';
import { getRequest } from '../../../src/static/js/utils/helpers';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    exportStore: jest.fn((store) => store),
    getRequest: jest.fn(),
}));

describe('utils/store', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    describe('SearchFieldStore', () => {
        const handler = store.actions_handler.bind(store);

        const onLoadPredictions = jest.fn();

        store.on('load_predictions', onLoadPredictions);

        test('Validate initial values based on URL params', async () => {
            expect(store.get('INVALID_TYPE')).toBe(null);
            expect(store.get('search-query')).toBe(urlParams.q);
            expect(store.get('search-categories')).toBe(urlParams.c);
            expect(store.get('search-tags')).toBe(urlParams.t);
        });

        test('Action type: "Action type: "TOGGLE_VIEWER_MODE"', async () => {
            const predictionsQuery_1 = 'predictions_query_1';
            const predictionsQuery_2 = 'predictions_query_2';

            const response_1 = { data: [{ title: 'Prediction 1' }, { title: 'Prediction 2' }] };
            const response_2 = { data: [{ title: 'Prediction 3' }, { title: 'Prediction 4' }] };

            (getRequest as jest.Mock)
                .mockImplementationOnce((_url, _cache, successCallback, _failCallback) => successCallback(response_1))
                .mockImplementationOnce((_url, _cache, successCallback, _failCallback) => successCallback(response_2));

            handler({ type: 'REQUEST_PREDICTIONS', query: predictionsQuery_1 });
            handler({ type: 'REQUEST_PREDICTIONS', query: predictionsQuery_2 });

            expect(onLoadPredictions).toHaveBeenCalledTimes(2);

            expect(onLoadPredictions).toHaveBeenNthCalledWith(
                1,
                predictionsQuery_1,
                response_1.data.map(({ title }) => title)
            );

            expect(onLoadPredictions).toHaveBeenNthCalledWith(
                2,
                predictionsQuery_2,
                response_2.data.map(({ title }) => title)
            );
        });
    });
});
