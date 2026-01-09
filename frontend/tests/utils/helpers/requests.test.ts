import axios from 'axios';
import { getRequest, postRequest, putRequest, deleteRequest } from '../../../src/static/js/utils/helpers/requests';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('js/utils/helpers', () => {
    describe('requests', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('getRequest', () => {
            const url = '/api/test';

            test('Calls axios.get with url and default config (async mode)', () => {
                mockedAxios.get.mockResolvedValueOnce({ data: 'ok' } as any);
                const cb = jest.fn();

                getRequest(url, false, cb, undefined);

                expect(mockedAxios.get).toHaveBeenCalledWith(url, {
                    timeout: null,
                    maxContentLength: null,
                });
            });

            test('Invokes callback when provided (async mode)', async () => {
                const response = { data: 'ok' } as any;
                mockedAxios.get.mockResolvedValueOnce(response);
                const cb = jest.fn();

                await getRequest(url, true, cb, undefined);

                expect(cb).toHaveBeenCalledWith(response);
            });

            // @todo: Revisit this behavior
            test('Does not throw when callback is not a function', async () => {
                mockedAxios.get.mockResolvedValueOnce({ data: 'ok' } as any);
                await expect(getRequest(url, true, undefined as any, undefined as any)).resolves.toBeUndefined();
            });

            test('Error handler wraps network errors with type network', async () => {
                const networkError = new Error('Network Error');
                mockedAxios.get.mockRejectedValueOnce(networkError);
                const errorCb = jest.fn();

                await getRequest(url, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledTimes(1);
                const arg = errorCb.mock.calls[0][0];
                expect(arg).toStrictEqual({ type: 'network', error: networkError });
            });

            test('Error handler maps status 401 to private error', async () => {
                const error = { response: { status: 401 } };
                mockedAxios.get.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await getRequest(url, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith({
                    type: 'private',
                    error,
                    message: 'Media is private',
                });
            });

            test('Error handler maps status 400 to unavailable error', async () => {
                const error = { response: { status: 400 } };
                mockedAxios.get.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await getRequest(url, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith({
                    type: 'unavailable',
                    error,
                    message: 'Media is unavailable',
                });
            });

            test('Passes through other errors with error.response defined but no status', async () => {
                const error = { response: {} } as any;
                mockedAxios.get.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await getRequest(url, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith(error);
            });

            // @todo: Revisit this behavior
            test('When no errorCallback provided, it should not crash on error (async)', async () => {
                mockedAxios.get.mockRejectedValueOnce(new Error('boom'));
                await expect(getRequest(url, true, undefined as any, undefined as any)).resolves.toBeUndefined();
            });
        });

        describe('postRequest', () => {
            const url = '/api/post';

            test('Calls axios.post with provided data and config (async mode)', () => {
                mockedAxios.post.mockResolvedValueOnce({ data: 'ok' } as any);
                const cb = jest.fn();

                postRequest(url, { a: 1 }, { headers: { h: 'v' } }, false, cb, undefined);

                expect(mockedAxios.post).toHaveBeenCalledWith(url, { a: 1 }, { headers: { h: 'v' } });
            });

            test('Defaults postData to {} when undefined', async () => {
                mockedAxios.post.mockResolvedValueOnce({ data: 'ok' } as any);
                const cb = jest.fn();

                await postRequest(url, undefined as any, undefined as any, true, cb, undefined);

                expect(mockedAxios.post).toHaveBeenCalledWith(url, {}, null);
                expect(cb).toHaveBeenCalled();
            });

            test('Invokes errorCallback on error as-is', async () => {
                const error = new Error('fail');
                mockedAxios.post.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await postRequest(url, {}, undefined, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith(error);
            });
        });

        describe('putRequest', () => {
            const url = '/api/put';

            test('Calls axios.put with provided data and config', async () => {
                mockedAxios.put.mockResolvedValueOnce({ data: 'ok' } as any);
                const cb = jest.fn();

                await putRequest(url, { a: 1 }, { headers: { h: 'v' } }, true, cb, undefined);

                expect(mockedAxios.put).toHaveBeenCalledWith(url, { a: 1 }, { headers: { h: 'v' } });
                expect(cb).toHaveBeenCalled();
            });

            test('Defaults putData to {} when undefined', async () => {
                mockedAxios.put.mockResolvedValueOnce({ data: 'ok' } as any);

                await putRequest(url, undefined as any, undefined as any, true, undefined, undefined);

                expect(mockedAxios.put).toHaveBeenCalledWith(url, {}, null);
            });

            test('Invokes errorCallback on error', async () => {
                const error = new Error('fail');
                mockedAxios.put.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await putRequest(url, {}, undefined, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith(error);
            });
        });

        describe('deleteRequest', () => {
            const url = '/api/delete';

            test('Calls axios.delete with provided config', async () => {
                mockedAxios.delete.mockResolvedValueOnce({ data: 'ok' } as any);
                const cb = jest.fn();

                await deleteRequest(url, { headers: { h: 'v' } }, true, cb, undefined);

                expect(mockedAxios.delete).toHaveBeenCalledWith(url, { headers: { h: 'v' } });
                expect(cb).toHaveBeenCalled();
            });

            test('Defaults configData to {} when undefined', async () => {
                mockedAxios.delete.mockResolvedValueOnce({ data: 'ok' } as any);

                await deleteRequest(url, undefined as any, true, undefined, undefined);

                expect(mockedAxios.delete).toHaveBeenCalledWith(url, {});
            });

            test('Invokes errorCallback on error', async () => {
                const error = new Error('fail');
                mockedAxios.delete.mockRejectedValueOnce(error);
                const errorCb = jest.fn();

                await deleteRequest(url, {}, true, undefined, errorCb);

                expect(errorCb).toHaveBeenCalledWith(error);
            });
        });

        describe('sync vs async behavior', () => {
            test('sync=true awaits the axios promise', async () => {
                const thenable = Promise.resolve({ data: 'ok' } as any);
                mockedAxios.post.mockReturnValueOnce(thenable as any);
                const cb = jest.fn();

                const p = postRequest('/api/p', {}, undefined, true, cb, undefined);
                // When awaited, callback should be called before next tick
                await p;
                expect(cb).toHaveBeenCalled();
            });

            test('sync=false does not need awaiting; call still issued', () => {
                mockedAxios.put.mockResolvedValueOnce({ data: 'ok' } as any);
                putRequest('/api/p', {}, undefined, false, undefined, undefined);
                expect(mockedAxios.put).toHaveBeenCalled();
            });
        });
    });
});
