const EventEmitter = require('events');

function createMockStore(initialValues = {}) {
    const store = new EventEmitter();
    let values = { ...initialValues };
    store.get = jest.fn((key) => values[key]);
    store.__set = (key, value) => {
        values[key] = value;
    };
    store.__reset = (next = {}) => {
        values = { ...next };
        store.removeAllListeners();
    };
    return store;
}

function mockStoresModule() {
    return {
        __esModule: true,
        MediaPageStore: createMockStore(),
        PageStore: createMockStore(),
        PlaylistPageStore: createMockStore(),
        PlaylistViewStore: createMockStore(),
        ProfilePageStore: createMockStore(),
        SearchFieldStore: createMockStore(),
        VideoViewerStore: createMockStore(),
    };
}

function mockActionsModule() {
    const actual = jest.requireActual('../../src/static/js/utils/actions/index.ts');
    const result = { __esModule: true };
    Object.keys(actual).forEach((ns) => {
        result[ns] = {};
        Object.keys(actual[ns]).forEach((fn) => {
            result[ns][fn] = jest.fn();
        });
    });
    return result;
}

module.exports = { createMockStore, mockStoresModule, mockActionsModule };
