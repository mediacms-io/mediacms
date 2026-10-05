import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { ItemList } from '../../../src/static/js/components/item-list/ItemList';
import { PendingItemsList } from '../../../src/static/js/components/item-list/PendingItemsList';
import { buildMediaItems } from '../../_support/compC_mediaItems';

const List = ItemList as any;

describe('components/item-list', () => {
    describe('PendingItemsList', () => {
        test('Renders a waiting wrapper with spinner', () => {
            const { container, unmount } = renderIntoContainer(<PendingItemsList className="outer" />);
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('outer');
            expect(root.querySelector('.items-list-wrap.items-list-wrap-waiting .spinner-loader')).not.toBeNull();
            unmount();
        });
    });

    describe('ItemList', () => {
        test('Renders first page of items with outer class and count callbacks', () => {
            const itemsCountCallback = jest.fn();
            const itemsLoadCallback = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <List
                    items={buildMediaItems(5)}
                    pageItems={2}
                    className=" extra "
                    itemsCountCallback={itemsCountCallback}
                    itemsLoadCallback={itemsLoadCallback}
                />
            );
            const outer = container.firstElementChild as HTMLElement;
            expect(outer.className).toBe('items-list-outer extra');
            const titles = Array.from(outer.querySelectorAll('.items-list-wrap .items-list .item h3')).map((h) => h.textContent);
            expect(titles).toStrictEqual(['Media 0', 'Media 1']);
            expect(itemsCountCallback).toHaveBeenCalledWith(5);
            expect(itemsLoadCallback).toHaveBeenCalled();
            expect(outer.querySelector('button.load-more')?.textContent).toBe('SHOW MORE');
            unmount();
        });

        test('Loads more items on SHOW MORE until everything is loaded', () => {
            const { container, unmount } = renderIntoContainer(<List items={buildMediaItems(5)} pageItems={2} />);
            const loadMore = () =>
                act(() => {
                    (container.querySelector('button.load-more') as HTMLButtonElement).click();
                });
            loadMore();
            expect(container.querySelectorAll('.item')).toHaveLength(4);
            loadMore();
            expect(container.querySelectorAll('.item')).toHaveLength(5);
            expect(container.querySelector('button.load-more')).toBeNull();
            unmount();
        });

        test('Renders all items without load more when they fit one page', () => {
            const { container, unmount } = renderIntoContainer(<List items={buildMediaItems(3)} />);
            expect(container.querySelectorAll('.item')).toHaveLength(3);
            expect(container.querySelector('.load-more')).toBeNull();
            unmount();
        });

        test('Renders nothing for an empty list', () => {
            const { container, unmount } = renderIntoContainer(<List items={[]} />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Applies item props such as hidden meta and edit links', () => {
            const { container, unmount } = renderIntoContainer(
                <List items={buildMediaItems(1)} hideAllMeta={true} canEdit={true} />
            );
            expect(container.querySelector('.item-meta')).toBeNull();
            expect(container.querySelector('a.item-edit-icon')?.getAttribute('href')).toBe('/edit?m=tok0');
            unmount();
        });
    });
});
