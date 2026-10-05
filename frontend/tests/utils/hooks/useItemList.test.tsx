import React, { useEffect, useRef } from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { useItemList } from '../../../src/static/js/utils/hooks/useItemList';
import { useItemListSync } from '../../../src/static/js/utils/hooks/useItemListSync';
import initItemsList from '../../../src/static/js/components/item-list/includes/itemLists/initItemsList';

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/initItemsList', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const initItemsListMock = initItemsList as unknown as jest.Mock;

describe('utils/hooks', () => {
    let appendItems: jest.Mock;

    beforeEach(() => {
        appendItems = jest.fn();
        initItemsListMock.mockReset();
        initItemsListMock.mockImplementation(() => [{ appendItems }]);
    });

    describe('useItemList', () => {
        function renderList(props: any) {
            const ref: { current: any[] } = { current: [] };
            function Probe() {
                const listRef = useRef<HTMLDivElement>(null);
                ref.current = useItemList(props, listRef);
                const [items, , , , , , addListItems] = ref.current;
                useEffect(() => {
                    addListItems();
                }, [items]);
                return (
                    <div ref={listRef}>
                        {items.map((item: any) => (
                            <div className="item" key={item.id} />
                        ))}
                    </div>
                );
            }
            const view = renderIntoContainer(<Probe />);
            return { ref, ...view };
        }

        test('Starts empty and calls itemsLoadCallback on mount', () => {
            const itemsLoadCallback = jest.fn();
            const { ref, unmount } = renderList({ itemsLoadCallback });
            const [items, countedItems, listHandler] = ref.current;
            expect(items).toStrictEqual([]);
            expect(countedItems).toBe(false);
            expect(listHandler).toBeNull();
            expect(itemsLoadCallback).toHaveBeenCalledTimes(1);
            expect(initItemsListMock).not.toHaveBeenCalled();
            unmount();
        });

        test('onItemsLoad stores a copy of the items and appends the rendered elements', () => {
            const itemsLoadCallback = jest.fn();
            const { ref, container, unmount } = renderList({ itemsLoadCallback });
            const loaded = [{ id: 1 }, { id: 2 }];

            act(() => ref.current[4](loaded));

            expect(ref.current[0]).toStrictEqual(loaded);
            expect(ref.current[0]).not.toBe(loaded);
            expect(itemsLoadCallback).toHaveBeenCalledTimes(2);
            expect(initItemsListMock).toHaveBeenCalledWith([container.firstElementChild]);
            const elements = container.querySelectorAll('.item');
            expect(appendItems.mock.calls).toStrictEqual([[elements[0]], [elements[1]]]);
            unmount();
        });

        test('onItemsCount marks items as counted and forwards the total', () => {
            const itemsCountCallback = jest.fn();
            const { ref, unmount } = renderList({ itemsCountCallback });
            act(() => ref.current[5](42));
            expect(ref.current[1]).toBe(true);
            expect(itemsCountCallback).toHaveBeenCalledWith(42);
            unmount();
        });

        test('onItemsCount works without a callback', () => {
            const { ref, unmount } = renderList({});
            act(() => ref.current[5](3));
            expect(ref.current[1]).toBe(true);
            unmount();
        });

        test('setListHandler stores the handler', () => {
            const { ref, unmount } = renderList({});
            const handler = { loadItems: jest.fn() };
            act(() => ref.current[3](handler));
            expect(ref.current[2]).toBe(handler);
            unmount();
        });

        test('Nothing is appended when items have no rendered elements', () => {
            const ref: { current: any[] } = { current: [] };
            function Probe() {
                const listRef = useRef<HTMLDivElement>(null);
                ref.current = useItemList({}, listRef);
                const [items, , , , , , addListItems] = ref.current;
                useEffect(() => {
                    addListItems();
                }, [items]);
                return <div ref={listRef} />;
            }
            const { unmount } = renderIntoContainer(<Probe />);
            act(() => ref.current[4]([{ id: 1 }]));
            expect(initItemsListMock).toHaveBeenCalledTimes(1);
            expect(appendItems).not.toHaveBeenCalled();
            unmount();
        });
    });

    describe('useItemListSync', () => {
        function renderSync(props: any) {
            const ref: { current: any[] } = { current: [] };
            function Probe() {
                ref.current = useItemListSync(props);
                const [, items, , , classname, wrapperRef, listRef, , , renderBefore, renderAfter] = ref.current;
                return (
                    <div className={classname.listOuter} ref={wrapperRef}>
                        {renderBefore()}
                        <div className={classname.list} ref={listRef}>
                            {items.map((item: any) => (
                                <div className="item" key={item.id} />
                            ))}
                        </div>
                        {renderAfter()}
                    </div>
                );
            }
            const view = renderIntoContainer(<Probe />);
            return { ref, ...view };
        }

        function handler(totalPages: number, loadedAll: boolean) {
            return { totalPages: () => totalPages, loadedAllItems: () => loadedAll, loadItems: jest.fn() };
        }

        test('Builds class names including a trimmed custom class', () => {
            const { ref, container, unmount } = renderSync({ className: ' extra ' });
            expect(ref.current[4]).toStrictEqual({ list: 'items-list', listOuter: 'items-list-outer extra' });
            expect(container.querySelector('.items-list-outer.extra > .items-list')).not.toBeNull();
            unmount();
        });

        test('Uses default outer class when no custom class is given', () => {
            const { ref, unmount } = renderSync({});
            expect(ref.current[4].listOuter).toBe('items-list-outer');
            unmount();
        });

        test('Renders no load more button without a list handler', () => {
            const { container, unmount } = renderSync({});
            expect(container.querySelector('.load-more')).toBeNull();
            unmount();
        });

        test('Renders load more while pages remain and loads items on click', () => {
            const { ref, container, unmount } = renderSync({});
            const h = handler(3, false);
            act(() => ref.current[3](h));
            const button = container.querySelector('button.load-more') as HTMLButtonElement;
            expect(button.textContent).toBe('SHOW MORE');
            act(() => {
                button.click();
            });
            expect(h.loadItems).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Hides load more when all items are loaded or there are no pages', () => {
            const loaded = renderSync({});
            act(() => loaded.ref.current[3](handler(3, true)));
            expect(loaded.container.querySelector('.load-more')).toBeNull();
            loaded.unmount();

            const empty = renderSync({});
            act(() => empty.ref.current[3](handler(0, false)));
            expect(empty.container.querySelector('.load-more')).toBeNull();
            empty.unmount();
        });

        test('Appends loaded items into the list instance', () => {
            const { ref, container, unmount } = renderSync({});
            act(() => ref.current[8]([{ id: 'a' }]));
            expect(ref.current[1]).toStrictEqual([{ id: 'a' }]);
            expect(appendItems).toHaveBeenCalledWith(container.querySelector('.item'));
            act(() => ref.current[7](1));
            expect(ref.current[0]).toBe(true);
            unmount();
        });
    });
});
