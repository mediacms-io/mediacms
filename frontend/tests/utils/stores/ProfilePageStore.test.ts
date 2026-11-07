import '../../_support/setupMediaCMS';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
    deleteRequest: jest.fn(),
}));

function loadStore(search = '') {
    window.history.replaceState(null, '', '/user/john' + search);
    let store: any;
    let actions: any;
    let requests: any;
    jest.isolateModules(() => {
        requests = require('../../../src/static/js/utils/helpers/requests');
        store = require('../../../src/static/js/utils/stores/ProfilePageStore').default;
        actions = require('../../../src/static/js/utils/actions/ProfilePageActions');
    });
    return { store, actions, requests };
}

describe('utils/stores', () => {
    describe('ProfilePageStore', () => {
        beforeAll(() => {
            document.cookie = 'csrftoken=csrf-1';
        });

        afterAll(() => {
            document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            window.history.replaceState(null, '', '/');
        });

        test('Has no author data before loading', () => {
            const { store } = loadStore();
            expect(store.get('author-data')).toBeNull();
            expect(store.get('unknown')).toBeUndefined();
        });

        test('Author query is read from aq URL param and memoized', () => {
            const { store } = loadStore('?aq=funny');
            expect(store.get('author-query')).toBe('funny');
            window.history.replaceState(null, '', '/user/john?aq=other');
            expect(store.get('author-query')).toBe('funny');
        });

        test('Author query is null without params', () => {
            const { store } = loadStore();
            expect(store.get('author-query')).toBeNull();
        });

        test('Author query is null when aq has no value', () => {
            const { store } = loadStore('?aq=');
            expect(store.get('author-query')).toBeNull();
        });

        test('LOAD_AUTHOR_DATA requests the profile and stores normalized data', () => {
            const { store, actions, requests } = loadStore();
            const listener = jest.fn();
            store.on('load-author-data', listener);

            actions.load_author_data();

            expect(requests.getRequest).toHaveBeenCalledWith(
                'https://example.com/api/v1/users/john',
                false,
                expect.any(Function),
                expect.any(Function)
            );

            requests.getRequest.mock.calls[0][2]({ data: { username: 'john', name: '' } });

            expect(store.get('author-data')).toStrictEqual({ username: 'john', name: 'john', id: 'john' });
            expect(listener).toHaveBeenCalledTimes(1);

            requests.getRequest.mock.calls[0][3]({ type: 'network' });
            requests.getRequest.mock.calls[0][2](undefined);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('Keeps a non-empty display name', () => {
            const { store, actions, requests } = loadStore();
            actions.load_author_data();
            requests.getRequest.mock.calls[0][2]({ data: { username: 'john', name: 'John Doe' } });
            expect(store.get('author-data').name).toBe('John Doe');
        });

        test('REMOVE_PROFILE sends a single delete request and emits profile_delete on 204', () => {
            const { store, actions, requests } = loadStore();
            actions.load_author_data();
            requests.getRequest.mock.calls[0][2]({ data: { username: 'john', name: 'John' } });

            const deleted = jest.fn();
            store.on('profile_delete', deleted);

            actions.remove_profile();
            actions.remove_profile();

            expect(requests.deleteRequest).toHaveBeenCalledTimes(1);
            expect(requests.deleteRequest).toHaveBeenCalledWith(
                'https://example.com/api/v1/users/john',
                { headers: { 'X-CSRFToken': 'csrf-1' } },
                false,
                expect.any(Function),
                expect.any(Function)
            );

            requests.deleteRequest.mock.calls[0][3]({ status: 200 });
            expect(deleted).not.toHaveBeenCalled();
            requests.deleteRequest.mock.calls[0][3]({ status: 204 });
            expect(deleted).toHaveBeenCalledWith('john');
        });

        test('Emits profile_delete_fail when the delete request fails', () => {
            jest.useFakeTimers();
            try {
                const { store, actions, requests } = loadStore();
                actions.load_author_data();
                requests.getRequest.mock.calls[0][2]({ data: { username: 'john', name: 'John' } });
                const failed = jest.fn();
                store.on('profile_delete_fail', failed);

                actions.remove_profile();
                requests.deleteRequest.mock.calls[0][4](new Error('boom'));

                expect(failed).toHaveBeenCalledWith('john');
            } finally {
                jest.clearAllTimers();
                jest.useRealTimers();
            }
        });
    });
});
