import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { useItemListInlineSlider } from '../../../src/static/js/utils/hooks/useItemListInlineSlider';
import ItemsInlineSlider from '../../../src/static/js/components/item-list/includes/itemLists/ItemsInlineSlider';
import initItemsList from '../../../src/static/js/components/item-list/includes/itemLists/initItemsList';

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/initItemsList', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/ItemsInlineSlider', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const SliderMock = ItemsInlineSlider as unknown as jest.Mock;

function createSlider(overrides: Record<string, any> = {}) {
    return {
        updateDataState: jest.fn(),
        updateDataStateOnResize: jest.fn(),
        scrollToCurrentSlide: jest.fn(),
        loadItemsToFit: jest.fn(() => false),
        loadMoreItems: jest.fn(() => false),
        itemsFit: jest.fn(() => 4),
        nextSlide: jest.fn(),
        previousSlide: jest.fn(),
        hasNextSlide: jest.fn(() => true),
        hasPreviousSlide: jest.fn(() => true),
        ...overrides,
    };
}

function createHandler(loadedAll = false) {
    return { loadItems: jest.fn(), loadedAllItems: jest.fn(() => loadedAll) };
}

function renderSlider(props: any = {}) {
    const ref: { current: any[] } = { current: [] };
    function Probe() {
        ref.current = useItemListInlineSlider(props);
        const [items, , , classname, , , , , , wrapperRef, listRef, renderBefore, renderAfter] = ref.current;
        return !items.length ? null : (
            <div className={classname.listOuter}>
                {renderBefore()}
                <div ref={wrapperRef} className="items-list-wrap">
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

function loadWith(ref: { current: any[] }, handler: any, items: any[]) {
    act(() => ref.current[4](handler));
    act(() => ref.current[6](items));
}

describe('utils/hooks', () => {
    describe('useItemListInlineSlider', () => {
        let slider: ReturnType<typeof createSlider>;

        beforeEach(() => {
            jest.useFakeTimers();
            slider = createSlider();
            SliderMock.mockReset();
            SliderMock.mockImplementation(() => slider);
            (initItemsList as unknown as jest.Mock).mockImplementation(() => [{ appendItems: jest.fn() }]);
        });

        afterEach(() => {
            act(() => {
                jest.runOnlyPendingTimers();
            });
            jest.useRealTimers();
        });

        test('Builds slider class names', () => {
            const plain = renderSlider();
            expect(plain.ref.current[3]).toStrictEqual({
                list: 'items-list',
                listOuter: 'items-list-outer list-inline list-slider',
            });
            plain.unmount();

            const custom = renderSlider({ className: 'featured' });
            expect(custom.ref.current[3].listOuter).toBe('items-list-outer list-inline list-slider featured');
            custom.unmount();
        });

        test('Does not create a slider before items are rendered', () => {
            const { unmount } = renderSlider();
            act(() => {
                jest.runAllTimers();
            });
            expect(SliderMock).not.toHaveBeenCalled();
            unmount();
        });

        test('Creates the slider on the wrapper once items load and shows navigation', () => {
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }, { id: 2 }]);

            const wrapper = container.querySelector('.items-list-wrap');
            expect(SliderMock).toHaveBeenCalledWith(wrapper, '.item');
            expect(slider.updateDataState).toHaveBeenCalledWith(2, true, false);
            expect(slider.scrollToCurrentSlide).toHaveBeenCalled();
            expect(container.querySelector('.previous-slide button.circle-icon-button.button-shadow')).not.toBeNull();
            expect(container.querySelector('.next-slide button')).not.toBeNull();
            unmount();
        });

        test('Hides navigation buttons when there are no other slides', () => {
            slider.hasNextSlide.mockReturnValue(false);
            slider.hasPreviousSlide.mockReturnValue(false);
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }]);
            expect(container.querySelector('.previous-slide')).toBeNull();
            expect(container.querySelector('.next-slide')).toBeNull();
            unmount();
        });

        test('Requests more items to fill the slider when it is not full', () => {
            slider.loadItemsToFit.mockReturnValue(true);
            const handler = createHandler(false);
            const { ref, unmount } = renderSlider();
            loadWith(ref, handler, [{ id: 1 }]);
            expect(handler.loadItems).toHaveBeenCalledWith(4);
            unmount();
        });

        test('Next slide scrolls when no more items are needed', () => {
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }, { id: 2 }]);
            slider.scrollToCurrentSlide.mockClear();

            act(() => {
                (container.querySelector('.next-slide button') as HTMLButtonElement).click();
            });
            expect(slider.nextSlide).toHaveBeenCalledTimes(1);
            expect(slider.scrollToCurrentSlide).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Next slide loads more items when the slider needs them', () => {
            slider.loadMoreItems.mockReturnValue(true);
            const handler = createHandler(false);
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, handler, [{ id: 1 }, { id: 2 }]);
            handler.loadItems.mockClear();

            act(() => {
                (container.querySelector('.next-slide button') as HTMLButtonElement).click();
            });
            expect(handler.loadItems).toHaveBeenCalledWith(4);
            unmount();
        });

        test('Previous slide moves back and scrolls', () => {
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }, { id: 2 }]);
            slider.scrollToCurrentSlide.mockClear();

            act(() => {
                (container.querySelector('.previous-slide button') as HTMLButtonElement).click();
            });
            expect(slider.previousSlide).toHaveBeenCalledTimes(1);
            expect(slider.scrollToCurrentSlide).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Window resize marks the wrapper as resizing until the update runs', () => {
            const { ref, container, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }, { id: 2 }]);
            const wrapper = container.querySelector('.items-list-wrap') as HTMLElement;

            act(() => ref.current[7]());
            expect(wrapper.classList.contains('resizing')).toBe(true);
            expect(slider.updateDataStateOnResize).toHaveBeenCalledWith(2, true);

            act(() => {
                jest.advanceTimersByTime(200);
            });
            expect(wrapper.classList.contains('resizing')).toBe(false);
            expect(slider.updateDataStateOnResize).toHaveBeenCalledTimes(2);
            unmount();
        });

        test('Sidebar visibility change refreshes buttons then the slider', () => {
            const { ref, unmount } = renderSlider();
            loadWith(ref, createHandler(true), [{ id: 1 }, { id: 2 }]);
            act(() => {
                jest.runAllTimers();
            });
            slider.hasNextSlide.mockClear();
            slider.updateDataState.mockClear();

            act(() => ref.current[8]());
            act(() => {
                jest.advanceTimersByTime(150);
            });
            expect(slider.hasNextSlide).toHaveBeenCalled();
            expect(slider.updateDataState).not.toHaveBeenCalled();

            act(() => {
                jest.advanceTimersByTime(50);
            });
            expect(slider.updateDataState).toHaveBeenCalledWith(2, true, true);
            unmount();
        });

        test('onItemsCount marks items as counted', () => {
            const { ref, unmount } = renderSlider();
            act(() => ref.current[5](9));
            expect(ref.current[1]).toBe(true);
            unmount();
        });
    });
});
