import React from 'react';
import { render, fireEvent } from '@testing-library/react';

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
    translateString: (s: string) => s,
}));

let mockListHandler: any;
let mockOnItemsLoad = jest.fn();
let mockOnItemsCount = jest.fn();
let addListItemsSpy = jest.fn();

// Mock useItemList to control items, counts, and listHandler
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
            mockOnItemsLoad, // onItemsLoad
            mockOnItemsCount, // onItemsCount
            addListItemsSpy, // addListItems
        ];
    },
}));

import { useItemListSync } from '../../../src/static/js/utils/hooks/useItemListSync';

function HookConsumer(props: any) {
    const tuple = useItemListSync(props);

    const [
        _countedItems,
        _items,
        _listHandler,
        _setListHandler,
        classname,
        _itemsListWrapperRef,
        _itemsListRef,
        _onItemsCount,
        _onItemsLoad,
        renderBeforeListWrap,
        renderAfterListWrap,
    ] = tuple as any;

    return (
        <div>
            {/* <div data-testid="counted">{String(countedItems)}</div> */}
            {/* <div data-testid="items">{Array.isArray(items) ? items.length : 0}</div> */}
            <div data-testid="class-list">{classname.list}</div>
            <div data-testid="class-outer">{classname.listOuter}</div>
            {/* <div data-testid="has-handler">{listHandler ? 'yes' : 'no'}</div> */}
            {/* <div data-testid="wrapper-ref">{itemsListWrapperRef.current ? 'set' : 'unset'}</div> */}
            {/* <div data-testid="list-ref">{itemsListRef.current ? 'set' : 'unset'}</div> */}
            <div data-testid="render-before">{renderBeforeListWrap()}</div>
            <div data-testid="render-after">{renderAfterListWrap()}</div>
            {/* <button data-testid="call-on-load" onClick={() => onItemsLoad([])} /> */}
            {/* <button data-testid="call-on-count" onClick={() => onItemsCount(0)} /> */}
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useItemListSync', () => {
        beforeEach(() => {
            mockOnItemsLoad = jest.fn();
            mockOnItemsCount = jest.fn();
            addListItemsSpy = jest.fn();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        describe('Classname Management', () => {
            test('Computes classname.listOuter with optional className prop', () => {
                const { getByTestId, rerender } = render(<HookConsumer className=" extra  " />);
                expect(getByTestId('class-outer').textContent).toBe('items-list-outer extra');
                expect(getByTestId('class-list').textContent).toBe('items-list');
                rerender(<HookConsumer />);
                expect(getByTestId('class-outer').textContent).toBe('items-list-outer');
                expect(getByTestId('class-list').textContent).toBe('items-list');
            });
        });

        describe('Items Management', () => {
            test('Invokes addListItems and afterItemsLoad when items change', () => {
                const { rerender } = render(<HookConsumer __items={[]} />);
                expect(addListItemsSpy).toHaveBeenCalledTimes(1);
                rerender(<HookConsumer __items={[1]} />);
                // useEffect runs again due to items change
                expect(addListItemsSpy).toHaveBeenCalledTimes(2);
            });
        });

        describe('Load More Button Rendering', () => {
            test('Renders SHOW MORE button when more pages exist and not loaded all', () => {
                const { getByTestId } = render(
                    <HookConsumer __items={[1]} __countedItems={1} __totalPages={3} __loadedAll={false} />
                );
                const btn = getByTestId('render-after').querySelector('button.load-more') as HTMLButtonElement;
                expect(btn).toBeTruthy();
                expect(btn.textContent).toBe('SHOW MORE');
                fireEvent.click(btn);
                expect(mockListHandler.loadItems).toHaveBeenCalledTimes(1);
            });

            test('Hides SHOW MORE when totalPages <= 1', () => {
                const { getByTestId } = render(
                    // With totalPages=1 the hook should not render the button regardless of loadedAll
                    <HookConsumer __items={[1, 2]} __countedItems={2} __totalPages={1} __loadedAll={true} />
                );
                expect(getByTestId('render-after').textContent).toBe('');
            });

            test('Hides SHOW MORE when loadedAllItems is true', () => {
                const { getByTestId } = render(
                    <HookConsumer __items={[1, 2, 3]} __countedItems={3} __totalPages={5} __loadedAll={true} />
                );
                expect(getByTestId('render-after').textContent).toBe('');
            });

            test('Shows SHOW MORE when loadedAllItems is false even with totalPages > 1', () => {
                const { getByTestId } = render(
                    <HookConsumer __items={[1, 2]} __countedItems={2} __totalPages={2} __loadedAll={false} />
                );
                const btn = getByTestId('render-after').querySelector('button.load-more');
                expect(btn).toBeTruthy();
            });

            test('Returns null from renderBeforeListWrap', () => {
                const { getByTestId } = render(
                    <HookConsumer __items={[1]} __countedItems={1} __totalPages={3} __loadedAll={false} />
                );
                expect(getByTestId('render-before').textContent).toBe('');
            });
        });
    });
});
