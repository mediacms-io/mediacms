import { ItemsStaticListHandler } from '../../../../../src/static/js/components/item-list/includes/itemLists/ItemsStaticListHandler';

describe('components/item-list', () => {
    describe('ItemsStaticListHandler', () => {
        const items = [1, 2, 3, 4, 5];

        test('Counts items and loads the first page immediately', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            const handler = ItemsStaticListHandler(items, 2, 99, onCount, onLoad);
            expect(onCount).toHaveBeenCalledWith(5);
            expect(onLoad).toHaveBeenCalledTimes(1);
            expect(onLoad.mock.calls[0][0]).toStrictEqual([1, 2]);
            expect(handler.totalPages()).toBe(3);
            expect(handler.loadedAllItems()).toBe(false);
        });

        test('Loads next pages and custom lengths until all items are loaded', () => {
            const loaded: number[][] = [];
            const handler = ItemsStaticListHandler(items, 2, 99, undefined, (list: number[]) => loaded.push([...list]));
            handler.loadItems();
            handler.loadItems(10);
            handler.loadItems();
            expect(loaded).toStrictEqual([
                [1, 2],
                [1, 2, 3, 4],
                [1, 2, 3, 4, 5],
            ]);
            expect(handler.loadedAllItems()).toBe(true);
        });

        test('Respects max items and page size bounded by max items', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            const handler = ItemsStaticListHandler(items, 10, 3, onCount, onLoad);
            expect(onCount).toHaveBeenCalledWith(3);
            expect(onLoad.mock.calls[0][0]).toStrictEqual([1, 2, 3]);
            expect(handler.totalPages()).toBe(1);
            expect(handler.loadedAllItems()).toBe(true);
        });

        test('Defaults to one item per page without page size', () => {
            const onLoad = jest.fn();
            const handler = ItemsStaticListHandler(items, 0, 0, undefined, onLoad);
            expect(onLoad.mock.calls[0][0]).toStrictEqual([1]);
            expect(handler.totalPages()).toBe(5);
        });

        test('Handles empty item arrays', () => {
            const onCount = jest.fn();
            const onLoad = jest.fn();
            const handler = ItemsStaticListHandler([], 2, 99, onCount, onLoad);
            expect(onCount).toHaveBeenCalledWith(0);
            expect(onLoad).not.toHaveBeenCalled();
            expect(handler.totalPages()).toBe(0);
            expect(handler.loadedAllItems()).toBe(true);
        });

        test('Stops calling callbacks after cancelAll', () => {
            const onLoad = jest.fn();
            const handler = ItemsStaticListHandler(items, 2, 99, undefined, onLoad);
            handler.cancelAll();
            handler.loadItems();
            expect(onLoad).toHaveBeenCalledTimes(1);
        });
    });
});
