import '../../../../_support/setupMediaCMS';
import { getRequest } from '../../../../../src/static/js/utils/helpers/requests';
import { ItemsListHandler } from '../../../../../src/static/js/components/item-list/includes/itemLists/ItemsListHandler';

jest.mock('../../../../../src/static/js/utils/helpers/requests', () => ({
    ...jest.requireActual('../../../../../src/static/js/utils/helpers/requests'),
    getRequest: jest.fn(),
}));

const mockedGetRequest = getRequest as jest.Mock;

type Pending = { url: string; cb: (response: any) => void };

describe('components/item-list', () => {
    describe('ItemsListHandler', () => {
        let pending: Pending[];

        beforeEach(() => {
            pending = [];
            mockedGetRequest.mockReset();
            mockedGetRequest.mockImplementation((url: string, _sync: boolean, cb: (r: any) => void) => {
                pending.push({ url, cb });
            });
        });

        function respond(data: any) {
            const next = pending.shift() as Pending;
            next.cb(undefined === data ? data : { data });
            return next.url;
        }

        const page1 = { count: 5, next: 'https://example.com/api/v1/media?page=2', results: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] };
        const page2 = { count: 5, next: null, results: [{ url: 'd' }, { url: 'e' }] };

        test('Requests first page, counts and loads first items', () => {
            const onCount = jest.fn();
            const loaded: string[][] = [];
            const onData = jest.fn();
            const handler = ItemsListHandler(
                2,
                99,
                null,
                'https://example.com/api/v1/media',
                onCount,
                (items: any[]) => loaded.push(items.map((i) => i.url)),
                onData
            );
            expect(respond(page1)).toBe('https://example.com/api/v1/media');
            expect(onCount).toHaveBeenCalledWith(5);
            expect(onData).toHaveBeenCalledWith(page1);
            expect(loaded).toStrictEqual([['a', 'b']]);
            expect(handler.totalPages()).toBe(3);
            expect(handler.loadedAllItems()).toBe(false);
            expect(pending).toHaveLength(0);
        });

        test('Fetches the next page when buffered items are not enough', () => {
            const loaded: string[][] = [];
            const handler = ItemsListHandler(2, 99, undefined, 'https://example.com/api/v1/media', undefined, (items: any[]) =>
                loaded.push(items.map((i) => i.url))
            );
            respond(page1);

            handler.loadItems();
            expect(loaded[1]).toStrictEqual(['a', 'b', 'c']);
            expect(pending[0].url).toBe('https://example.com/api/v1/media?page=2');

            handler.loadItems();
            expect(loaded).toHaveLength(2);

            respond(page2);
            expect(loaded[2]).toStrictEqual(['a', 'b', 'c', 'd']);

            handler.loadItems();
            expect(loaded[3]).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
            expect(handler.loadedAllItems()).toBe(true);

            handler.loadItems();
            expect(loaded).toHaveLength(4);
            expect(pending).toHaveLength(0);
        });

        test('Supports category style responses without results wrapper or count', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            ItemsListHandler(10, 99, null, 'https://example.com/api/v1/categories', onCount, onLoad);
            respond([{ url: 'x' }, { url: 'y' }]);
            expect(onCount).toHaveBeenCalledWith(2);
            expect(onLoad.mock.calls[0][0].map((i: any) => i.url)).toStrictEqual(['x', 'y']);
        });

        test('Caps totals and buffered items at max items', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            const handler = ItemsListHandler(5, 2, null, 'https://example.com/api/v1/media', onCount, onLoad);
            respond(page1);
            expect(onCount).toHaveBeenCalledWith(2);
            expect(onLoad.mock.calls[0][0].map((i: any) => i.url)).toStrictEqual(['a', 'b']);
            expect(handler.loadedAllItems()).toBe(true);
            expect(pending).toHaveLength(0);
        });

        test('Loads first item from its own request and skips it in the listing', () => {
            const onLoad = jest.fn();
            ItemsListHandler(
                3,
                99,
                'https://example.com/api/v1/media/first',
                'https://example.com/api/v1/media',
                undefined,
                onLoad
            );
            expect(respond({ results: [{ url: 'b' }] })).toBe('https://example.com/api/v1/media/first');
            expect(respond(page1)).toBe('https://example.com/api/v1/media');
            expect(onLoad.mock.calls[0][0].map((i: any) => i.url)).toStrictEqual(['b', 'a', 'c']);
            expect(pending[0].url).toBe('https://example.com/api/v1/media?page=2');
        });

        test('Continues with listing when first item response is empty', () => {
            const onCount = jest.fn();
            ItemsListHandler(3, 99, 'https://example.com/first', 'https://example.com/api/v1/media', onCount);
            respond(undefined);
            expect(pending[0].url).toBe('https://example.com/api/v1/media');
            respond({ results: [] });
            expect(onCount).toHaveBeenCalledWith(0);
        });

        test('Ignores empty responses and stops callbacks after cancelAll', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            const handler = ItemsListHandler(2, 99, null, 'https://example.com/api/v1/media', onCount, onLoad);
            respond(undefined);
            expect(onCount).not.toHaveBeenCalled();

            const second = ItemsListHandler(2, 99, null, 'https://example.com/api/v1/media', onCount, onLoad);
            second.cancelAll();
            respond(page1);
            expect(onCount).not.toHaveBeenCalled();
            expect(onLoad).not.toHaveBeenCalled();
            expect(handler.totalPages()).toBe(0);
        });
    });
});
