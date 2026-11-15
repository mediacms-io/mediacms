import '../../_support/hooksB_setupSiteUrlWithoutSlash';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { useMediaItem, itemClassname } from '../../../src/static/js/utils/hooks/useMediaItem';

const baseProps = {
    title: 'Clip',
    link: '/view?m=1',
    thumbnail: '',
    description: 'Descr',
    author_name: 'Jane',
    author_link: '/user/jane',
    views: 1500,
    publish_date: '2024-01-01T00:00:00Z',
    editLink: '/edit?m=1',
};

function renderMediaItem(props: any) {
    function Probe() {
        const [, , , , editMediaComponent, metaComponents, viewMediaComponent] = useMediaItem(props) as any[];
        return (
            <div>
                <div className="edit">{editMediaComponent()}</div>
                <div className="meta">{metaComponents()}</div>
                <div className="view">{viewMediaComponent()}</div>
            </div>
        );
    }
    return renderIntoContainer(<Probe />);
}

describe('utils/hooks', () => {
    describe('itemClassname', () => {
        test('Combines default, inherited and active classes', () => {
            expect(itemClassname('item', '', false)).toBe('item');
            expect(itemClassname('item', 'wide', false)).toBe('item wide');
            expect(itemClassname('item', 'wide', true)).toBe('item wide pl-active-item');
            expect(itemClassname('item', '', true)).toBe('item pl-active-item');
        });
    });

    describe('useMediaItem', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-03T00:00:00Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
            delete (window as any).REPLACEMENTS;
        });

        test('Renders author link, views and relative publish date', () => {
            const { container, unmount } = renderMediaItem(baseProps);
            const author = container.querySelector('.meta .item-author a') as HTMLAnchorElement;
            expect(author.getAttribute('href')).toBe('https://example.com/user/jane');
            expect(author.textContent).toBe('Jane');
            expect(container.querySelector('.meta .item-views')?.textContent).toBe('1.5K views');
            const time = container.querySelector('.meta .item-date time') as HTMLElement;
            expect(time.textContent).toBe('2 days ago');
            expect(time.getAttribute('datetime')).toBe(String(Date.parse('2024-01-01T00:00:00Z')));
            expect(time.getAttribute('content')).toBe('2024-01-01T00:00:00Z');
            unmount();
        });

        test('Applies replacement strings to the publish date', () => {
            (window as any).REPLACEMENTS = { days: 'jours' };
            const { container, unmount } = renderMediaItem(baseProps);
            expect(container.querySelector('.item-date time')?.textContent).toBe('2 jours ago');
            unmount();
        });

        test('Accepts non string publish dates', () => {
            const date = new Date('2024-01-02T00:00:00Z');
            const { container, unmount } = renderMediaItem({ ...baseProps, publish_date: date });
            expect(container.querySelector('.item-date time')?.getAttribute('datetime')).toBe(
                String(Date.parse(date.toString()))
            );
            unmount();
        });

        test('Uses singular view label for a single view', () => {
            const { container, unmount } = renderMediaItem({ ...baseProps, views: 1 });
            expect(container.querySelector('.item-views')?.textContent).toBe('1 view');
            unmount();
        });

        test('Single link content renders the author without a link', () => {
            const { container, unmount } = renderMediaItem({ ...baseProps, singleLinkContent: true });
            expect(container.querySelector('.item-author a')).toBeNull();
            expect(container.querySelector('.item-author span')?.textContent).toBe('Jane');
            unmount();
        });

        test('Empty author link renders an author link without href', () => {
            const { container, unmount } = renderMediaItem({ ...baseProps, author_link: '' });
            expect(container.querySelector('.item-author a')?.hasAttribute('href')).toBe(false);
            unmount();
        });

        test('Hide flags remove the matching meta parts', () => {
            const { container, unmount } = renderMediaItem({
                ...baseProps,
                hideAuthor: true,
                hideViews: true,
                hideDate: true,
            });
            expect(container.querySelector('.meta .item-meta')?.innerHTML).toBe('');
            unmount();
        });

        test('hideAllMeta removes the meta wrapper', () => {
            const { container, unmount } = renderMediaItem({ ...baseProps, hideAllMeta: true });
            expect(container.querySelector('.meta')?.innerHTML).toBe('');
            unmount();
        });

        test('Edit link renders when provided', () => {
            const { container, unmount } = renderMediaItem(baseProps);
            const edit = container.querySelector('.edit a.item-edit-icon') as HTMLAnchorElement;
            expect(edit.getAttribute('href')).toBe('/edit?m=1');
            expect(edit.getAttribute('title')).toBe('Edit media');
            unmount();
        });

        test('Edit link is omitted without editLink', () => {
            const { container, unmount } = renderMediaItem({ ...baseProps, editLink: undefined });
            expect(container.querySelector('.edit')?.innerHTML).toBe('');
            unmount();
        });

        test('View link only renders in selection mode and prefers the publish link', () => {
            const hidden = renderMediaItem(baseProps);
            expect(hidden.container.querySelector('.view')?.innerHTML).toBe('');
            hidden.unmount();

            const publish = renderMediaItem({ ...baseProps, showSelection: true, publishLink: '/publish?m=1' });
            expect(publish.container.querySelector('.view a.item-view-icon')?.getAttribute('href')).toBe('/publish?m=1');
            publish.unmount();

            const fallback = renderMediaItem({ ...baseProps, showSelection: true });
            expect(fallback.container.querySelector('.view a')?.getAttribute('href')).toBe('/view?m=1');
            fallback.unmount();
        });

        test('Returns title, description, thumbnail and wrapper from useItem', () => {
            let values: any[] = [];
            function Probe() {
                values = useMediaItem({ ...baseProps, thumbnail: '/t.jpg' });
                return null;
            }
            const { unmount } = renderIntoContainer(<Probe />);
            expect(typeof values[0]).toBe('function');
            expect(typeof values[1]).toBe('function');
            expect(values[2]).toBe('https://example.com/t.jpg');
            expect(typeof values[3]).toBe('function');
            unmount();
        });
    });
});
