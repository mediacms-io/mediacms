import { getRequest, deleteRequest, csrfToken } from '../../../src/static/js/utils/helpers';
import store from '../../../src/static/js/utils/stores/ProfilePageStore';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => ({
        ...jest.requireActual('../../tests-constants').sampleMediaCMSConfig,
        api: { ...jest.requireActual('../../tests-constants').sampleMediaCMSConfig.api, users: '' },
    })),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    getRequest: jest.fn(),
    deleteRequest: jest.fn(),
    csrfToken: jest.fn(),
    exportStore: jest.fn((store) => store),
}));

describe('utils/store', () => {
    const mockAuthorData = { username: 'testuser', name: 'Test User' };

    beforeAll(() => {
        (globalThis as any).window.MediaCMS = { profileId: mockAuthorData.username };
    });

    afterAll(() => {
        delete (globalThis as any).window.MediaCMS;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('ProfilePageStore', () => {
        const handler = store.actions_handler.bind(store);

        const onProfileDelete = jest.fn();
        const onProfileDeleteFail = jest.fn();
        const onLoadAuthorData = jest.fn();

        beforeAll(() => {
            store.on('profile_delete', onProfileDelete);
            store.on('profile_delete_fail', onProfileDeleteFail);
            store.on('load-author-data', onLoadAuthorData);
        });

        beforeEach(() => {
            // Reset store state
            store.authorData = null;
            store.removingProfile = false;
            store.authorQuery = undefined;
        });

        describe('Trigger and validate actions behavior', () => {
            test('Action type: "REMOVE_PROFILE" - successful deletion', async () => {
                // Set up author data
                store.authorData = mockAuthorData;

                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock delete request
                (deleteRequest as jest.Mock).mockImplementation(
                    (_url, _config, _sync, successCallback, _failCallback) => successCallback({ status: 204 })
                );

                handler({ type: 'REMOVE_PROFILE' });

                // Verify deleteRequest was called with correct parameters
                expect(deleteRequest).toHaveBeenCalledWith(
                    '/testuser', // API URL constructed from config + username
                    { headers: { 'X-CSRFToken': mockCSRFtoken } },
                    false,
                    store.removeProfileResponse,
                    store.removeProfileFail
                );

                // Verify event was emitted
                expect(onProfileDelete).toHaveBeenCalledWith(mockAuthorData.username);
                expect(onProfileDelete).toHaveBeenCalledTimes(1);
            });

            test('Action type: "REMOVE_PROFILE" - deletion failure', async () => {
                // Set up author data
                store.authorData = mockAuthorData;

                // Mock the CSRF token
                const mockCSRFtoken = 'test-csrf-token';
                (csrfToken as jest.Mock).mockReturnValue(mockCSRFtoken);

                // Mock delete request
                (deleteRequest as jest.Mock).mockImplementation(
                    (_url, _config, _sync, _successCallback, failCallback) => failCallback.call(store)
                );

                handler({ type: 'REMOVE_PROFILE' });

                // Wait for the setTimeout in removeProfileFail
                await new Promise((resolve) => setTimeout(resolve, 150));

                // Verify event was emitted
                expect(onProfileDeleteFail).toHaveBeenCalledWith(mockAuthorData.username);
                expect(onProfileDeleteFail).toHaveBeenCalledTimes(1);
            });

            test('Action type: "REMOVE_PROFILE" - prevents duplicate calls while removing', () => {
                // Set up author data
                store.authorData = mockAuthorData;

                handler({ type: 'REMOVE_PROFILE' });
                expect(deleteRequest).toHaveBeenCalledTimes(1);

                store.removingProfile = true;
                handler({ type: 'REMOVE_PROFILE' });
                expect(deleteRequest).toHaveBeenCalledTimes(1);

                store.removingProfile = false;
                handler({ type: 'REMOVE_PROFILE' });
                expect(deleteRequest).toHaveBeenCalledTimes(2);
            });

            test('Action type: "LOAD_AUTHOR_DATA"', async () => {
                (getRequest as jest.Mock).mockImplementation((_url, _cache, successCallback, _failCallback) =>
                    successCallback({ data: mockAuthorData })
                );

                handler({ type: 'LOAD_AUTHOR_DATA' });

                // Verify getRequest was called with correct parameters
                expect(getRequest).toHaveBeenCalledWith('/testuser', false, store.onDataLoad, store.onDataLoadFail);

                // Verify event was emitted
                expect(onLoadAuthorData).toHaveBeenCalledTimes(1);

                // Verify author data was processed correctly
                expect(store.get('author-data')).toStrictEqual(mockAuthorData);
            });
        });

        describe('Getter methods', () => {
            test('Validate initial values', () => {
                expect(store.get('INVALID_TYPE')).toBe(undefined);
                expect(store.get('author-data')).toBe(null);
                expect(store.get('author-query')).toBe(null);
            });

            test('get("author-data") returns authorData', () => {
                store.authorData = mockAuthorData;
                expect(store.get('author-data')).toBe(mockAuthorData);
            });

            test('get("author-query") - without "aq" parameter in URL', () => {
                window.history.pushState({}, '', '/path');
                expect(store.get('author-query')).toBe(null);
            });

            test('get("author-query") - with "aq" parameter in URL', () => {
                window.history.pushState({}, '', '/path?aq=AUTHOR_QUERY');
                expect(store.get('author-query')).toBe('AUTHOR_QUERY');
            });

            test('get("author-query") - empty search string', () => {
                window.history.pushState({}, '', '/path?aq');
                expect(store.get('author-query')).toBe(null);
            });
        });
    });
});
