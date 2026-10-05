import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { useItemListLazyLoad } from '../../../src/static/js/utils/hooks/useItemListLazyLoad';
import initItemsList from '../../../src/static/js/components/item-list/includes/itemLists/initItemsList';

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/initItemsList', () => ({
    __esModule: true,
    default: jest.fn(),
}));

function handler(loadedAll: boolean) {
    return { loadItems: jest.fn(), loadedAllItems: jest.fn(() => loadedAll) };
}

function renderLazy(props: any = {}) {
    const ref: { current: any[] } = { current: [] };
    function Probe() {
        ref.current = useItemListLazyLoad(props);
        const [items, , , , classname, , , , , wrapperRef, listRef, renderBefore, renderAfter] = ref.current;
        return !items.length ? null : (
            <div className={classname.listOuter}>
                {renderBefore()}
                <div ref={wrapperRef}>
                    <div ref={listRef} className={classname.list}>
                        {items.map((item: any) => (
                            <div className="item" key={item.id} />
                        ))}
                    </div>
                </div>
                {renderAfter()}
            </div>
        );
    }
    const view = renderIntoContainer(<Probe />);
    return { ref, ...view };
}

describe('utils/hooks', () => {
    describe('useItemListLazyLoad', () => {
        beforeEach(() => {
            (initItemsList as unknown as jest.Mock).mockImplementation(() => [{ appendItems: jest.fn() }]);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('Builds class names and renders nothing around the list', () => {
            const { ref, container, unmount } = renderLazy({ className: ' grid ' });
            expect(ref.current[4]).toStrictEqual({ list: 'items-list', listOuter: 'items-list-outer grid' });
            expect(ref.current[11]()).toBeNull();
            expect(ref.current[12]()).toBeNull();
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Uses default outer class without a custom class', () => {
            const { ref, unmount } = renderLazy();
            expect(ref.current[4].listOuter).toBe('items-list-outer');
            unmount();
        });

        test('Loads more items when the list bottom is within the scroll window', () => {
            const { ref, unmount } = renderLazy();
            const h = handler(false);
            act(() => ref.current[3](h));
            act(() => ref.current[6]([{ id: 1 }]));
            expect(h.loadItems).toHaveBeenCalled();
            unmount();
        });

        test('Does not load items before a list handler exists', () => {
            const { ref, unmount } = renderLazy();
            expect(() => act(() => ref.current[7]())).not.toThrow();
            unmount();
        });

        test('onItemsCount marks items as counted', () => {
            const itemsCountCallback = jest.fn();
            const { ref, unmount } = renderLazy({ itemsCountCallback });
            act(() => ref.current[5](7));
            expect(ref.current[1]).toBe(true);
            expect(itemsCountCallback).toHaveBeenCalledWith(7);
            unmount();
        });

        test('Visibility change re-evaluates the scroll position after a short delay when visible', () => {
            jest.useFakeTimers();
            const { ref, unmount } = renderLazy();
            const h = handler(false);
            act(() => ref.current[3](h));
            act(() => ref.current[6]([{ id: 1 }]));
            h.loadItems.mockClear();

            Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
            act(() => ref.current[8]());
            expect(jest.getTimerCount()).toBe(1);
            act(() => {
                jest.advanceTimersByTime(10);
            });
            expect(h.loadItems).toHaveBeenCalledTimes(1);
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
            unmount();
        });

        test('Visibility change does nothing while the document is hidden', () => {
            jest.useFakeTimers();
            const { ref, unmount } = renderLazy();
            Object.defineProperty(document, 'hidden', { configurable: true, value: true });
            act(() => ref.current[8]());
            expect(jest.getTimerCount()).toBe(0);
            Object.defineProperty(document, 'hidden', { configurable: true, value: false });
            unmount();
        });
    });
});
