import '../../_support/setupMediaCMS';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
    deleteRequest: jest.fn(),
}));

const titlesUrl = 'https://example.com/api/v1/search?show=titles&q=';

function loadStore(search = '') {
    window.history.replaceState(null, '', '/search' + search);
    let store: any;
    let actions: any;
    let requests: any;
    jest.isolateModules(() => {
        requests = require('../../../src/static/js/utils/helpers/requests');
        store = require('../../../src/static/js/utils/stores/SearchFieldStore').default;
        actions = require('../../../src/static/js/utils/actions/SearchFieldActions');
    });
    return { store, actions, getRequest: requests.getRequest as jest.Mock };
}

describe('utils/stores', () => {
    describe('SearchFieldStore', () => {
        afterAll(() => {
            window.history.replaceState(null, '', '/');
        });

        test('Reads decoded query, categories and tags from the URL', () => {
            const { store } = loadStore('?q=hello+big%20world&c=Music+Videos&t=fun');
            expect(store.get('search-query')).toBe('hello big world');
            expect(store.get('search-categories')).toBe('Music Videos');
            expect(store.get('search-tags')).toBe('fun');
            expect(store.get('unknown')).toBeNull();
        });

        test('Defaults to empty strings without URL params', () => {
            const { store } = loadStore();
            expect(store.get('search-query')).toBe('');
            expect(store.get('search-categories')).toBe('');
            expect(store.get('search-tags')).toBe('');
        });

        test('Requests predictions and emits titles for the requested query', () => {
            const { store, actions, getRequest } = loadStore();
            const listener = jest.fn();
            store.on('load_predictions', listener);

            actions.requestPredictions('cat');

            expect(getRequest).toHaveBeenCalledTimes(1);
            expect(getRequest).toHaveBeenCalledWith(titlesUrl + 'cat', false, expect.any(Function));

            getRequest.mock.calls[0][2]({ data: [{ title: 'Cats' }, { title: 'Catalog' }] });

            expect(listener).toHaveBeenCalledWith('cat', ['Cats', 'Catalog']);
        });

        test('Queues a new query while a request is in flight and sends it after the response', () => {
            const { store, actions, getRequest } = loadStore();
            const listener = jest.fn();
            store.on('load_predictions', listener);

            actions.requestPredictions('ca');
            actions.requestPredictions('cat');
            actions.requestPredictions('cats');

            expect(getRequest).toHaveBeenCalledTimes(1);

            getRequest.mock.calls[0][2]({ data: [{ title: 'Car' }] });

            expect(listener).toHaveBeenLastCalledWith('ca', ['Car']);
            expect(getRequest).toHaveBeenCalledTimes(2);
            expect(getRequest.mock.calls[1][0]).toBe(titlesUrl + 'cats');

            getRequest.mock.calls[1][2]({ data: [{ title: 'Cats' }] });
            expect(listener).toHaveBeenLastCalledWith('cats', ['Cats']);

            actions.requestPredictions('dog');
            expect(getRequest).toHaveBeenCalledTimes(3);
        });

        test('Ignores empty responses', () => {
            const { store, actions, getRequest } = loadStore();
            const listener = jest.fn();
            store.on('load_predictions', listener);

            actions.requestPredictions('x');
            getRequest.mock.calls[0][2](undefined);
            getRequest.mock.calls[0][2]({});

            expect(listener).not.toHaveBeenCalled();
        });
    });
});
