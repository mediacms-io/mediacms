import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/helpers/', () => ({
    addClassname: jest.fn(),
    removeClassname: jest.fn(),
}));

let mockListHandler: any;
let mockInlineSliderInstance: any;
let addListItemsSpy = jest.fn();

jest.mock('../../../src/static/js/utils/hooks/useItemList', () => ({
    useItemList: (props: any, _ref: any) => {
        mockListHandler = {
            loadItems: jest.fn(),
            totalPages: jest.fn().mockReturnValue(props.__totalPages ?? 1),
            loadedAllItems: jest.fn().mockReturnValue(Boolean(props.__loadedAll ?? true)),
        };
        return [
            props.__items ?? [], // items
            props.__countedItems ?? 0, // countedItems
            mockListHandler, // listHandler
            jest.fn(), // setListHandler
            jest.fn(), // onItemsLoad
            jest.fn(), // onItemsCount
            addListItemsSpy, // addListItems
        ];
    },
}));

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/ItemsInlineSlider', () =>
    jest.fn().mockImplementation(() => {
        mockInlineSliderInstance = {
            updateDataStateOnResize: jest.fn(),
            updateDataState: jest.fn(),
            scrollToCurrentSlide: jest.fn(),
            nextSlide: jest.fn(),
            previousSlide: jest.fn(),
            hasNextSlide: jest.fn().mockReturnValue(true),
            hasPreviousSlide: jest.fn().mockReturnValue(true),
            loadItemsToFit: jest.fn().mockReturnValue(false),
            loadMoreItems: jest.fn().mockReturnValue(false),
            itemsFit: jest.fn().mockReturnValue(3),
        };
        return mockInlineSliderInstance;
    })
);

jest.mock('../../../src/static/js/components/_shared', () => ({
    CircleIconButton: ({ children, onClick }: any) => (
        <button data-testid="circle-icon-button" onClick={onClick}>
            {children}
        </button>
    ),
}));

import { useItemListInlineSlider } from '../../../src/static/js/utils/hooks/useItemListInlineSlider';

function HookConsumer(props: any) {
    const tuple = useItemListInlineSlider(props);
    const [
        _items,
        _countedItems,
        _listHandler,
        classname,
        _setListHandler,
        _onItemsCount,
        _onItemsLoad,
        _winResizeListener,
        _sidebarVisibilityChangeListener,
        itemsListWrapperRef,
        _itemsListRef,
        renderBeforeListWrap,
        renderAfterListWrap,
    ] = tuple as any;

    return (
        <div ref={itemsListWrapperRef}>
            <div data-testid="class-list">{classname.list}</div>
            <div data-testid="class-outer">{classname.listOuter}</div>
            <div data-testid="render-before">{renderBeforeListWrap()}</div>
            <div data-testid="render-after">{renderAfterListWrap()}</div>
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useItemListInlineSlider', () => {
        beforeEach(() => {
            addListItemsSpy = jest.fn();
            mockInlineSliderInstance = null;
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        test('Returns correct tuple of values from hook', () => {
            const TestComponent = (props: any) => {
                const tuple = useItemListInlineSlider(props);
                return (
                    <div>
                        <div data-testid="tuple-length">{tuple.length}</div>
                        <div data-testid="has-items">{tuple[0] ? 'yes' : 'no'}</div>
                        <div data-testid="has-classname">{tuple[3] ? 'yes' : 'no'}</div>
                        <div data-testid="has-listeners">{typeof tuple[7] === 'function' ? 'yes' : 'no'}</div>
                    </div>
                );
            };

            const { getByTestId } = render(<TestComponent __items={[1, 2, 3]} />);

            expect(getByTestId('tuple-length').textContent).toBe('13');
            expect(getByTestId('has-classname').textContent).toBe('yes');
            expect(getByTestId('has-listeners').textContent).toBe('yes');
        });

        test('Computes classname.list and classname.listOuter with optional className prop', () => {
            const { getByTestId, rerender } = render(<HookConsumer className=" extra " />);

            expect(getByTestId('class-outer').textContent).toBe('items-list-outer list-inline list-slider  extra ');
            expect(getByTestId('class-list').textContent).toBe('items-list');

            rerender(<HookConsumer />);

            expect(getByTestId('class-outer').textContent).toBe('items-list-outer list-inline list-slider');
            expect(getByTestId('class-list').textContent).toBe('items-list');
        });

        test('Invokes addListItems when items change', () => {
            const { rerender } = render(<HookConsumer __items={[]} />);
            expect(addListItemsSpy).toHaveBeenCalledTimes(1);
            rerender(<HookConsumer __items={[1]} />);
            expect(addListItemsSpy).toHaveBeenCalledTimes(2);
        });

        test('nextSlide loads more items when loadMoreItems returns true and not all items loaded', () => {
            const { getByTestId } = render(<HookConsumer __items={[1, 2, 3]} __loadedAll={false} />);

            mockInlineSliderInstance.loadMoreItems.mockReturnValue(true);

            const renderAfter = getByTestId('render-after');
            const nextButton = renderAfter.querySelector('button[data-testid="circle-icon-button"]');

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);

            fireEvent.click(nextButton!);

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);
        });

        test('nextSlide does not load items when all items already loaded', () => {
            const { getByTestId } = render(<HookConsumer __items={[1, 2, 3]} __loadedAll={true} />);

            mockInlineSliderInstance.loadMoreItems.mockReturnValue(false);

            const renderAfter = getByTestId('render-after');
            const nextButton = renderAfter.querySelector('button[data-testid="circle-icon-button"]');

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);

            fireEvent.click(nextButton!);

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(2);
        });

        test('prevSlide calls inlineSlider.previousSlide and updates button view', () => {
            const { getByTestId } = render(<HookConsumer __items={[1, 2, 3]} __loadedAll={false} />);

            mockInlineSliderInstance.loadMoreItems.mockReturnValue(true);

            const renderBefore = getByTestId('render-before');
            const prevButton = renderBefore.querySelector('button[data-testid="circle-icon-button"]');

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);

            fireEvent.click(prevButton!);

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(2);
        });

        test('prevSlide always scrolls to current slide regardless of item load state', () => {
            const { getByTestId } = render(<HookConsumer __items={[1, 2, 3]} __loadedAll={true} />);

            mockInlineSliderInstance.loadMoreItems.mockReturnValue(false);

            const renderBefore = getByTestId('render-before');
            const prevButton = renderBefore.querySelector('button[data-testid="circle-icon-button"]');

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);

            fireEvent.click(prevButton!);

            expect(mockListHandler.loadItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.loadMoreItems).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.nextSlide).toHaveBeenCalledTimes(0);
            expect(mockInlineSliderInstance.previousSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.hasNextSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.hasPreviousSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(2);
        });

        test('Button state updates based on hasNextSlide and hasPreviousSlide', () => {
            const { getByTestId, rerender } = render(<HookConsumer __items={[1, 2, 3]} />);

            const renderBefore = getByTestId('render-before');
            const renderAfter = getByTestId('render-after');

            // Initially should show buttons (default mock returns true)
            expect(renderBefore.querySelector('button')).toBeTruthy();
            expect(renderAfter.querySelector('button')).toBeTruthy();

            // Now set hasNextSlide and hasPreviousSlide to false
            mockInlineSliderInstance.hasNextSlide.mockReturnValue(false);
            mockInlineSliderInstance.hasPreviousSlide.mockReturnValue(false);

            // Trigger re-render by changing items
            rerender(<HookConsumer __items={[1, 2, 3, 4]} />);

            // The next and previous buttons should not be rendered now
            const newRenderAfter = getByTestId('render-after');
            const newRenderBefore = getByTestId('render-before');
            expect(newRenderAfter.querySelector('button')).toBeNull();
            expect(newRenderBefore.querySelector('button')).toBeNull();
        });

        test('winResizeListener and sidebarVisibilityChangeListener are returned as callable functions', () => {
            const TestComponentWithListeners = (props: any) => {
                const tuple = useItemListInlineSlider(props);

                const winResizeListener = tuple[7]; // winResizeListener
                const sidebarListener = tuple[8]; // sidebarVisibilityChangeListener
                const wrapperRef = tuple[9]; // itemsListWrapperRef

                return (
                    <div ref={wrapperRef as any} data-testid="wrapper">
                        <button data-testid="trigger-resize" onClick={winResizeListener as any}>
                            Trigger Resize
                        </button>
                        <button data-testid="trigger-sidebar" onClick={sidebarListener as any}>
                            Trigger Sidebars
                        </button>
                    </div>
                );
            };

            const { getByTestId } = render(<TestComponentWithListeners __items={[1, 2, 3]} />);

            // Should not throw when called
            const resizeButton = getByTestId('trigger-resize');
            const sidebarButton = getByTestId('trigger-sidebar');

            expect(() => fireEvent.click(resizeButton)).not.toThrow();
            expect(() => fireEvent.click(sidebarButton)).not.toThrow();
        });

        test('winResizeListener updates resizeDate state triggering resize effect', () => {
            const TestComponent = (props: any) => {
                const tuple = useItemListInlineSlider(props) as any;
                const winResizeListener = tuple[7];
                const wrapperRef = tuple[9];

                return (
                    <div ref={wrapperRef} data-testid="wrapper">
                        <button data-testid="trigger-resize" onClick={winResizeListener}>
                            Trigger Resize
                        </button>
                    </div>
                );
            };

            const { getByTestId } = render(<TestComponent __items={[1, 2, 3]} />);

            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(1);
            expect(mockInlineSliderInstance.updateDataStateOnResize).toHaveBeenCalledTimes(0);

            jest.useFakeTimers();

            fireEvent.click(getByTestId('trigger-resize'));

            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(2);
            expect(mockInlineSliderInstance.updateDataStateOnResize).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(200);

            expect(mockInlineSliderInstance.scrollToCurrentSlide).toHaveBeenCalledTimes(3);
            expect(mockInlineSliderInstance.updateDataStateOnResize).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });
    });
});
