import axios from 'axios';
import {
    getRequest,
    postRequest,
    putRequest,
    deleteRequest,
} from '../../../../../src/static/js/utils/helpers/requests';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => Promise.resolve(undefined)),
        post: jest.fn(() => Promise.resolve(undefined)),
        put: jest.fn(() => Promise.resolve(undefined)),
        delete: jest.fn(() => Promise.resolve(undefined)),
    },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const flushMicrotasks = () => new Promise((r) => setImmediate(r));

describe('utils/helpers/requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get.mockReset();
        mockedAxios.post.mockReset();
        mockedAxios.put.mockReset();
        mockedAxios.delete.mockReset();
    });

    /*test('axios mock identity', () => {
        const required = jest.requireMock('axios');
        const effective = (required && (required as any).default) || required;
        expect(effective.get).toBe(mockedAxios.get);
    });*/

    describe('getRequest', () => {
        test('invokes callback with response on success (async fire-and-forget)', async () => {
            const resp = { data: { ok: true } } as any;

            mockedAxios.get.mockResolvedValueOnce(resp);

            const cb = jest.fn();
            await getRequest('/api/x', false, cb);

            // allow microtasks to flush
            await flushMicrotasks();

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/x', { timeout: undefined, maxContentLength: undefined });
            expect(cb).toHaveBeenCalledWith(resp);
        });

        test('invokes callback with response on success (sync awaited)', async () => {
            const resp = { data: { ok: true } } as any;
            mockedAxios.get.mockResolvedValueOnce(resp);
            const cb = jest.fn();
            await getRequest('/api/x', true, cb);
            await flushMicrotasks();
            expect(cb).toHaveBeenCalledWith(resp);
        });

        test('maps network error to type="network" shape and forwards to errorCallback', async () => {
            const networkErr = new Error('offline');
            mockedAxios.get.mockRejectedValueOnce(networkErr as any);
            const errCb = jest.fn();
            await getRequest('/api/x', true, undefined, errCb);
            await flushMicrotasks();
            expect(errCb).toHaveBeenCalledTimes(1);
            const arg = errCb.mock.calls[0][0];
            expect(arg).toMatchObject({ type: 'network', error: networkErr });
        });

        test('maps 401 to type="private" with message', async () => {
            const axiosErr = { response: { status: 401 } };
            mockedAxios.get.mockRejectedValueOnce(axiosErr as any);
            const errCb = jest.fn();
            await getRequest('/api/x', true, undefined, errCb);
            await flushMicrotasks();
            expect(errCb).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'private', message: 'Media is private' })
            );
        });

        test('maps 400 to type="unavailable" with message', async () => {
            const axiosErr = { response: { status: 400 } };
            mockedAxios.get.mockRejectedValueOnce(axiosErr as any);
            const errCb = jest.fn();
            await getRequest('/api/x', true, undefined, errCb);
            await flushMicrotasks();
            expect(errCb).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'unavailable', message: 'Media is unavailable' })
            );
        });

        test('passes through other axios errors unchanged', async () => {
            const axiosErr = { response: { status: 500 } };
            mockedAxios.get.mockRejectedValueOnce(axiosErr as any);
            const errCb = jest.fn();
            await getRequest('/api/x', true, undefined, errCb);
            await flushMicrotasks();
            expect(errCb).toHaveBeenCalledWith(axiosErr);
        });
    });

    describe('postRequest', () => {
        test('sends post with provided data and invokes callback (sync)', async () => {
            const resp = { status: 201 } as any;
            mockedAxios.post.mockResolvedValueOnce(resp);
            const cb = jest.fn();
            await postRequest('/api/p', { a: 1 }, { headers: { h: 'v' } }, true, cb);
            await flushMicrotasks();
            expect(mockedAxios.post).toHaveBeenCalledWith('/api/p', { a: 1 }, { headers: { h: 'v' } });
            expect(cb).toHaveBeenCalledWith(resp);
        });

        test('defaults postData to {} when falsy and calls errorCallback on failure', async () => {
            const err = new Error('bad');
            mockedAxios.post.mockRejectedValueOnce(err as any);
            const errCb = jest.fn();
            await postRequest('/api/p', undefined as any, undefined, true, undefined, errCb);
            await flushMicrotasks();
            expect(mockedAxios.post).toHaveBeenCalledWith('/api/p', {}, undefined);
            expect(errCb).toHaveBeenCalledWith(err);
        });
    });

    describe('putRequest', () => {
        test('sends put with provided data and invokes callback (sync)', async () => {
            const resp = { status: 200 } as any;
            mockedAxios.put.mockResolvedValueOnce(resp);
            const cb = jest.fn();
            await putRequest('/api/u', { a: 2 }, { headers: { x: 'y' } }, true, cb);
            await flushMicrotasks();
            expect(mockedAxios.put).toHaveBeenCalledWith('/api/u', { a: 2 }, { headers: { x: 'y' } });
            expect(cb).toHaveBeenCalledWith(resp);
        });

        test('defaults putData to {} when falsy and calls errorCallback on failure', async () => {
            const err = new Error('oops');
            mockedAxios.put.mockRejectedValueOnce(err as any);
            const errCb = jest.fn();
            await putRequest('/api/u', null as any, undefined, true, undefined, errCb);
            await flushMicrotasks();
            expect(mockedAxios.put).toHaveBeenCalledWith('/api/u', {}, undefined);
            expect(errCb).toHaveBeenCalledWith(err);
        });
    });

    describe('deleteRequest', () => {
        test('sends delete with provided config and invokes callback (sync)', async () => {
            const resp = { status: 204 } as any;
            mockedAxios.delete.mockResolvedValueOnce(resp);
            const cb = jest.fn();
            await deleteRequest('/api/d', { headers: { a: 'b' } }, true, cb);
            await flushMicrotasks();
            expect(mockedAxios.delete).toHaveBeenCalledWith('/api/d', { headers: { a: 'b' } });
            expect(cb).toHaveBeenCalledWith(resp);
        });

        test('defaults configData to {} when falsy (async fire-and-forget path) and calls errorCallback', async () => {
            const err = new Error('nope');
            mockedAxios.delete.mockRejectedValueOnce(err as any);
            const errCb = jest.fn();
            await deleteRequest('/api/d', undefined, false, undefined, errCb);
            // allow promise microtask
            await flushMicrotasks();
            expect(mockedAxios.delete).toHaveBeenCalledWith('/api/d', {});
            expect(errCb).toHaveBeenCalledWith(err);
        });
    });
});
