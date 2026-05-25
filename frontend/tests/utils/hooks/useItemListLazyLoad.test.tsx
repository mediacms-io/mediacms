import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
    })),
}));

let mockListHandler: any;
let addListItemsSpy = jest.fn();
const mockRemoveListener = jest.fn();

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

jest.mock('../../../src/static/js/utils/stores/', () => ({
    PageStore: {
        removeListener: mockRemoveListener,
    },
}));

import { useItemListLazyLoad } from '../../../src/static/js/utils/hooks/useItemListLazyLoad';

function HookConsumer(props: any) {
    const tuple = useItemListLazyLoad(props);

    const [
        _items,
        _countedItems,
        _listHandler,
        _setListHandler,
        classname,
        _onItemsCount,
        _onItemsLoad,
        _onWindowScroll,
        _onDocumentVisibilityChange,
        _itemsListWrapperRef,
        _itemsListRef,
        renderBeforeListWrap,
        renderAfterListWrap,
    ] = tuple as any;

    return (
        <div>
            <div data-testid="class-list">{classname.list}</div>
            <div data-testid="class-outer">{classname.listOuter}</div>
            <div data-testid="render-before">{renderBeforeListWrap()}</div>
            <div data-testid="render-after">{renderAfterListWrap()}</div>
        </div>
    );
}

function HookConsumerWithRefs(props: any) {
    const tuple = useItemListLazyLoad(props);
    const [
        _items,
        _countedItems,
        _listHandler,
        _setListHandler,
        classname,
        _onItemsCount,
        _onItemsLoad,
        onWindowScroll,
        onDocumentVisibilityChange,
        itemsListWrapperRef,
        itemsListRef,
        renderBeforeListWrap,
        renderAfterListWrap,
    ] = tuple as any;

    return (
        <div ref={itemsListWrapperRef}>
            <div data-testid="class-list">{classname.list}</div>
            <div data-testid="class-outer">{classname.listOuter}</div>
            <div ref={itemsListRef} data-testid="list-ref-node" />
            <div data-testid="render-before">{renderBeforeListWrap()}</div>
            <div data-testid="render-after">{renderAfterListWrap()}</div>
            <button data-testid="trigger-visibility" onClick={onDocumentVisibilityChange} type="button">
                visibility
            </button>
            <button data-testid="trigger-scroll" onClick={onWindowScroll} type="button">
                scroll
            </button>
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useItemListLazyLoad', () => {
        beforeEach(() => {
            addListItemsSpy = jest.fn();
            mockRemoveListener.mockClear();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        test('Computes classname.list and classname.listOuter with optional className prop', () => {
            const { getByTestId, rerender } = render(<HookConsumer className=" extra  " />);
            expect(getByTestId('class-outer').textContent).toBe('items-list-outer extra');
            expect(getByTestId('class-list').textContent).toBe('items-list');
            rerender(<HookConsumer />);
            expect(getByTestId('class-outer').textContent).toBe('items-list-outer');
            expect(getByTestId('class-list').textContent).toBe('items-list');
        });

        test('Invokes addListItems when items change', () => {
            const { rerender } = render(<HookConsumer __items={[]} />);
            expect(addListItemsSpy).toHaveBeenCalledTimes(1);
            rerender(<HookConsumer __items={[1]} />);
            expect(addListItemsSpy).toHaveBeenCalledTimes(2);
        });

        test('Renders nothing in renderBeforeListWrap and renderAfterListWrap', () => {
            const { getByTestId } = render(
                <HookConsumer __items={[1]} __countedItems={1} __totalPages={3} __loadedAll={false} />
            );
            expect(getByTestId('render-before').textContent).toBe('');
            expect(getByTestId('render-after').textContent).toBe('');
        });

        test('Does not call listHandler.loadItems when refs are not attached', () => {
            render(<HookConsumer __items={[1]} />);
            expect(mockListHandler.loadItems).not.toHaveBeenCalled();
        });

        test('Calls listHandler.loadItems when refs are set and scroll threshold is reached', async () => {
            render(<HookConsumerWithRefs __items={[1]} __loadedAll={false} />);
            await waitFor(() => {
                expect(mockListHandler.loadItems).toHaveBeenCalled();
            });
        });

        test('Calls PageStore.removeListener when refs are set and loadedAllItems is true', () => {
            render(<HookConsumerWithRefs __items={[1]} __loadedAll={true} />);
            expect(mockRemoveListener).toHaveBeenCalledWith('window_scroll', expect.any(Function));
        });

        test('onDocumentVisibilityChange schedules onWindowScroll when document is visible', () => {
            jest.useFakeTimers();
            const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });

            const { getByTestId } = render(<HookConsumerWithRefs __items={[1]} />);
            fireEvent.click(getByTestId('trigger-visibility'));

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);

            setTimeoutSpy.mockRestore();
            jest.useRealTimers();
        });

        test('onDocumentVisibilityChange does nothing when document is hidden', () => {
            jest.useFakeTimers();
            const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });

            const { getByTestId } = render(<HookConsumerWithRefs __items={[1]} />);
            fireEvent.click(getByTestId('trigger-visibility'));

            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);

            setTimeoutSpy.mockRestore();
            jest.useRealTimers();
        });
    });
});
