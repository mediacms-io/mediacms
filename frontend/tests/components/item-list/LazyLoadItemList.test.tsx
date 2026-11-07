import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { getRequest } from '../../../src/static/js/utils/helpers/requests';
import PageStore from '../../../src/static/js/utils/stores/PageStore';
import { LazyLoadItemList } from '../../../src/static/js/components/item-list/LazyLoadItemList';
import { LazyLoadItemListAsync } from '../../../src/static/js/components/item-list/LazyLoadItemListAsync';
import { buildMediaItems } from '../../_support/compC_mediaItems';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    ...jest.requireActual('../../../src/static/js/utils/helpers/requests'),
    getRequest: jest.fn(),
}));

const mockedGetRequest = getRequest as jest.Mock;
const LazyList = LazyLoadItemList as any;
const LazyListAsync = LazyLoadItemListAsync as any;

function setListBottom(bottom: number) {
    return [
        jest.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(bottom),
        jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0),
    ];
}

function scrollWindowTo(y: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
}

describe('components/item-list', () => {
    let spies: jest.SpyInstance[] = [];

    afterEach(() => {
        spies.forEach((s) => s.mockRestore());
        spies = [];
        scrollWindowTo(0);
    });

    describe('LazyLoadItemList', () => {
        test('Keeps loading pages while the list bottom is within the scroll threshold', () => {
            spies = setListBottom(0);
            const { container, unmount } = renderIntoContainer(<LazyList items={buildMediaItems(5)} pageItems={2} />);
            expect(container.querySelectorAll('.item')).toHaveLength(5);
            expect(container.querySelector('.load-more')).toBeNull();
            unmount();
            expect(PageStore.listenerCount('window_scroll')).toBe(0);
            expect(PageStore.listenerCount('document_visibility_change')).toBe(0);
        });

        test('Loads more on window scroll once the list comes into range', () => {
            spies = setListBottom(100000);
            const { container, unmount } = renderIntoContainer(<LazyList items={buildMediaItems(5)} pageItems={2} />);
            expect(container.querySelectorAll('.item')).toHaveLength(2);
            expect(PageStore.listenerCount('window_scroll')).toBe(1);

            scrollWindowTo(200000);
            act(() => {
                PageStore.emit('window_scroll');
            });
            expect(container.querySelectorAll('.item')).toHaveLength(5);
            unmount();
            expect(PageStore.listenerCount('window_scroll')).toBe(0);
        });

        test('Rechecks scroll position shortly after the document becomes visible', () => {
            jest.useFakeTimers();
            spies = setListBottom(100000);
            const { container, unmount } = renderIntoContainer(<LazyList items={buildMediaItems(5)} pageItems={2} />);
            scrollWindowTo(200000);

            act(() => {
                PageStore.emit('document_visibility_change');
            });
            expect(container.querySelectorAll('.item')).toHaveLength(2);
            act(() => {
                jest.advanceTimersByTime(10);
            });
            expect(container.querySelectorAll('.item')).toHaveLength(5);
            unmount();
            jest.useRealTimers();
        });

        test('Renders nothing for an empty list', () => {
            const { container, unmount } = renderIntoContainer(<LazyList items={[]} />);
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });

    describe('LazyLoadItemListAsync', () => {
        let pending: { url: string; cb: (r: any) => void }[];

        beforeEach(() => {
            pending = [];
            mockedGetRequest.mockReset();
            mockedGetRequest.mockImplementation((url: string, _sync: boolean, cb: (r: any) => void) => {
                pending.push({ url, cb });
            });
        });

        function respond(data: any) {
            const next = pending.shift() as { url: string; cb: (r: any) => void };
            act(() => {
                next.cb({ data });
            });
            return next.url;
        }

        test('Renders fetched items with selection state and reports data and items', () => {
            spies = setListBottom(100000);
            const onResponseDataLoaded = jest.fn();
            const onItemsUpdate = jest.fn();
            const onMediaSelection = jest.fn();
            const items = buildMediaItems(3);
            const { container, unmount } = renderIntoContainer(
                <LazyListAsync
                    requestUrl="https://example.com/api/v1/media"
                    pageItems={2}
                    showSelection={true}
                    hasAnySelection={false}
                    selectedMedia={new Set(['tok1'])}
                    onMediaSelection={onMediaSelection}
                    onResponseDataLoaded={onResponseDataLoaded}
                    onItemsUpdate={onItemsUpdate}
                />
            );
            expect(container.querySelector('.items-list-wrap-waiting')).not.toBeNull();

            const data = { count: 3, next: null, results: items };
            respond(data);
            expect(onResponseDataLoaded).toHaveBeenCalledWith(data);
            expect(onItemsUpdate).toHaveBeenLastCalledWith(items.slice(0, 2));

            const rendered = container.querySelectorAll('.item');
            expect(rendered).toHaveLength(2);
            expect(rendered[0].className).not.toContain(' selected');
            expect(rendered[1].className).toContain(' selected');

            act(() => {
                (rendered[0].querySelector('.item-selection-checkbox input') as HTMLInputElement).click();
            });
            expect(onMediaSelection).toHaveBeenCalledWith('tok0', true);

            scrollWindowTo(200000);
            act(() => {
                PageStore.emit('window_scroll');
            });
            expect(container.querySelectorAll('.item')).toHaveLength(3);
            expect(onItemsUpdate).toHaveBeenLastCalledWith(items);
            unmount();
        });

        test('Fetches following pages while scrolling', () => {
            spies = setListBottom(0);
            const items = buildMediaItems(4);
            const { container, unmount } = renderIntoContainer(
                <LazyListAsync requestUrl="https://example.com/api/v1/media" pageItems={2} />
            );
            respond({ count: 4, next: 'https://example.com/api/v1/media?page=2', results: items.slice(0, 2) });
            expect(container.querySelectorAll('.item')).toHaveLength(2);
            expect(respond({ count: 4, next: null, results: items.slice(2) })).toBe(
                'https://example.com/api/v1/media?page=2'
            );
            expect(container.querySelectorAll('.item')).toHaveLength(4);
            expect(pending).toHaveLength(0);
            unmount();
        });
    });
});
