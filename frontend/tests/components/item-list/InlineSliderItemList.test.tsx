import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { getRequest } from '../../../src/static/js/utils/helpers/requests';
import PageStore from '../../../src/static/js/utils/stores/PageStore';
import { LayoutContext } from '../../../src/static/js/utils/contexts/LayoutContext';
import { InlineSliderItemList } from '../../../src/static/js/components/item-list/InlineSliderItemList';
import { InlineSliderItemListAsync } from '../../../src/static/js/components/item-list/InlineSliderItemListAsync';
import { buildMediaItems } from '../../_support/compC_mediaItems';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    ...jest.requireActual('../../../src/static/js/utils/helpers/requests'),
    getRequest: jest.fn(),
}));

const mockedGetRequest = getRequest as jest.Mock;
const Slider = InlineSliderItemList as any;
const SliderAsync = InlineSliderItemListAsync as any;

function Layout({ visibleSidebar = false, children }: { visibleSidebar?: boolean; children: React.ReactNode }) {
    return <LayoutContext.Provider value={{ visibleSidebar } as any}>{children}</LayoutContext.Provider>;
}

describe('components/item-list', () => {
    let widthSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        widthSpy = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
            return this.classList.contains('items-list-wrap') ? 300 : 100;
        });
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
        widthSpy.mockRestore();
    });

    function slideButtons(container: HTMLElement) {
        return {
            prev: container.querySelector('.previous-slide button') as HTMLButtonElement | null,
            next: container.querySelector('.next-slide button') as HTMLButtonElement | null,
        };
    }

    describe('InlineSliderItemList', () => {
        test('Renders slider classes and loads enough items to fill two slides', () => {
            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <Slider items={buildMediaItems(10)} pageItems={2} className="extra" />
                </Layout>
            );
            const outer = container.firstElementChild as HTMLElement;
            expect(outer.className).toBe('items-list-outer list-inline list-slider extra');
            expect(container.querySelectorAll('.item').length).toBeGreaterThanOrEqual(6);
            const { prev, next } = slideButtons(container);
            expect(prev).toBeNull();
            expect(next).not.toBeNull();
            expect(next?.className).toBe('circle-icon-button button-shadow');
            unmount();
            expect(PageStore.listenerCount('window_resize')).toBe(0);
        });

        test('Navigates with next and previous buttons and scrolls the wrapper', () => {
            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <Slider items={buildMediaItems(6)} pageItems={6} />
                </Layout>
            );
            const wrapper = container.querySelector('.items-list-wrap') as HTMLElement;
            act(() => {
                (slideButtons(container).next as HTMLButtonElement).click();
            });
            expect(wrapper.scrollLeft).toBe(300);
            expect(slideButtons(container).next).toBeNull();
            expect(slideButtons(container).prev).not.toBeNull();

            act(() => {
                (slideButtons(container).prev as HTMLButtonElement).click();
            });
            expect(wrapper.scrollLeft).toBe(0);
            expect(slideButtons(container).prev).toBeNull();
            unmount();
        });

        test('Loads more items when moving next near the end of loaded items', () => {
            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <Slider items={buildMediaItems(12)} pageItems={6} />
                </Layout>
            );
            expect(container.querySelectorAll('.item')).toHaveLength(6);
            act(() => {
                (slideButtons(container).next as HTMLButtonElement).click();
            });
            expect(container.querySelectorAll('.item')).toHaveLength(9);
            unmount();
        });

        test('Marks wrapper as resizing on window resize until the debounce ends', () => {
            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <Slider items={buildMediaItems(6)} pageItems={6} />
                </Layout>
            );
            const wrapper = container.querySelector('.items-list-wrap') as HTMLElement;
            act(() => {
                PageStore.emit('window_resize');
            });
            expect(wrapper.classList.contains('resizing')).toBe(true);
            act(() => {
                jest.advanceTimersByTime(200);
            });
            expect(wrapper.classList.contains('resizing')).toBe(false);
            unmount();
        });

        test('Recalculates buttons after sidebar visibility changes', () => {
            const view = renderIntoContainer(
                <Layout>
                    <Slider items={buildMediaItems(6)} pageItems={6} />
                </Layout>
            );
            widthSpy.mockImplementation(function (this: HTMLElement) {
                return this.classList.contains('items-list-wrap') ? 600 : 100;
            });
            view.rerender(
                <Layout visibleSidebar={true}>
                    <Slider items={buildMediaItems(6)} pageItems={6} />
                </Layout>
            );
            act(() => {
                jest.advanceTimersByTime(200);
            });
            expect(slideButtons(view.container).next).toBeNull();
            view.unmount();
        });

        test('Renders nothing for an empty list', () => {
            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <Slider items={[]} />
                </Layout>
            );
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });

    describe('InlineSliderItemListAsync', () => {
        test('Renders pending list then fetched items', () => {
            const pending: { url: string; cb: (r: any) => void }[] = [];
            mockedGetRequest.mockReset();
            mockedGetRequest.mockImplementation((url: string, _sync: boolean, cb: (r: any) => void) => {
                pending.push({ url, cb });
            });

            const { container, unmount } = renderIntoContainer(
                <Layout>
                    <SliderAsync requestUrl="https://example.com/api/v1/media" pageItems={6} />
                </Layout>
            );
            expect(container.querySelector('.items-list-wrap-waiting')).not.toBeNull();
            act(() => {
                (pending.shift() as any).cb({ data: { count: 4, next: null, results: buildMediaItems(4) } });
            });
            expect(container.querySelectorAll('.item')).toHaveLength(4);
            expect(slideButtons(container).next).not.toBeNull();
            unmount();
        });
    });
});
