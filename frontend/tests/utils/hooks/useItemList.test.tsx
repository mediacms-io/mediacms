import React, { createRef } from 'react';
import { render } from '@testing-library/react';

// Stub style imports used by the hook so Jest doesn't try to parse SCSS
jest.mock('../../../src/static/js/components/item-list/ItemList.scss', () => ({}), { virtual: true });

jest.mock('../../../src/static/js/components/item-list/includes/itemLists/initItemsList', () => ({
    __esModule: true,
    default: jest.fn((_lists: any[]) => [{ appendItems: jest.fn() }]),
}));

import initItemsList from '../../../src/static/js/components/item-list/includes/itemLists/initItemsList';
import { useItemList } from '../../../src/static/js/utils/hooks/useItemList';

function HookConsumer(props: any) {
    const listRef = createRef<HTMLDivElement>();
    const [items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems] = useItemList(
        props,
        listRef
    ) as any[];

    return (
        <div>
            <div ref={listRef} data-testid="list" className="list">
                {(items as any[]).map((_, idx) => (
                    <div key={idx} className="item" data-testid={`itm-${idx}`} />
                ))}
            </div>
            <div data-testid="counted">{String(countedItems)}</div>
            <div data-testid="len">{items.length}</div>
            <button data-testid="load-call" onClick={() => onItemsLoad([1, 2])} />
            <button data-testid="count-call" onClick={() => onItemsCount(5)} />
            <button data-testid="add-call" onClick={() => addListItems()} />
            <button data-testid="set-handler" onClick={() => setListHandler({ foo: 'bar' })} />
            <div data-testid="has-handler">{listHandler ? 'yes' : 'no'}</div>
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useItemList', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('Initial state: empty items and not counted', () => {
            const { getByTestId } = render(<HookConsumer />);
            expect(getByTestId('counted').textContent).toBe('false');
            expect(getByTestId('len').textContent).toBe('0');
            expect(getByTestId('has-handler').textContent).toBe('no');
        });

        test('onItemsLoad updates items and renders item nodes', () => {
            const { getByTestId, getByTestId: $ } = render(<HookConsumer />);
            (getByTestId('load-call') as HTMLButtonElement).click();
            expect(getByTestId('len').textContent).toBe('2');
            expect($('itm-0')).toBeTruthy();
            expect($('itm-1')).toBeTruthy();
        });

        test('onItemsCount marks countedItems true and triggers callback if provided', () => {
            const cb = jest.fn();
            const { getByTestId } = render(<HookConsumer itemsCountCallback={cb} />);
            (getByTestId('count-call') as HTMLButtonElement).click();
            expect(getByTestId('counted').textContent).toBe('true');
            expect(cb).toHaveBeenCalledWith(5);
        });

        test('addListItems initializes itemsListInstance and appends only new items', () => {
            const mockInit = initItemsList as jest.Mock;

            const { getByTestId, rerender } = render(<HookConsumer />);

            const itemsLen = getByTestId('len') as HTMLDivElement;
            const addBtn = getByTestId('add-call') as HTMLButtonElement;
            const loadBtn = getByTestId('load-call') as HTMLButtonElement;

            expect(itemsLen.textContent).toBe('0');
            loadBtn.click();
            expect(itemsLen.textContent).toBe('2');

            expect(mockInit).toHaveBeenCalledTimes(0);
            addBtn.click();
            expect(mockInit).toHaveBeenCalledTimes(1);

            expect(mockInit.mock.results[0].value[0].appendItems).toHaveBeenCalledTimes(2);

            loadBtn.click();
            expect(itemsLen.textContent).toBe('2');

            addBtn.click();
            expect(mockInit).toHaveBeenCalledTimes(2);
            expect(mockInit.mock.results[1].value[0].appendItems).toHaveBeenCalledTimes(2);

            rerender(<HookConsumer />);

            addBtn.click();
            expect(mockInit).toHaveBeenCalledTimes(3);
            expect(mockInit.mock.results[2].value[0].appendItems).toHaveBeenCalledTimes(2);
        });

        test('addListItems does nothing when there are no .item elements in the ref', () => {
            // Render, do not call onItemsLoad, then call addListItems
            const mockInit = initItemsList as jest.Mock;
            const { getByTestId } = render(<HookConsumer />);
            (getByTestId('add-call') as HTMLButtonElement).click();
            expect(mockInit).not.toHaveBeenCalled();
        });

        test('itemsLoadCallback is invoked when items change', () => {
            const itemsLoadCallback = jest.fn();
            const { getByTestId } = render(<HookConsumer itemsLoadCallback={itemsLoadCallback} />);
            (getByTestId('load-call') as HTMLButtonElement).click();
            expect(itemsLoadCallback).toHaveBeenCalledTimes(1);
        });

        test('setListHandler updates listHandler', () => {
            const { getByTestId } = render(<HookConsumer />);
            expect(getByTestId('has-handler').textContent).toBe('no');
            (getByTestId('set-handler') as HTMLButtonElement).click();
            expect(getByTestId('has-handler').textContent).toBe('yes');
        });
    });
});
