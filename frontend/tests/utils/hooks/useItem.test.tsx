import '../../_support/hooksB_setupSiteUrlWithoutSlash';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { useItem } from '../../../src/static/js/utils/hooks/useItem';
import { ItemMain, ItemMainInLink } from '../../../src/static/js/components/list-item/includes/items';

function renderItem(props: any) {
    const ref: { current: any } = { current: null };
    function Probe() {
        ref.current = useItem(props);
        return (
            <div>
                <div className="title">{ref.current.titleComponent()}</div>
                <div className="descr">{ref.current.descriptionComponent()}</div>
            </div>
        );
    }
    const view = renderIntoContainer(<Probe />);
    return { ref, ...view };
}

const baseProps = {
    type: 'media',
    title: 'My video',
    link: '/view?m=abc',
    thumbnail: '/media/thumb.jpg',
    description: '  Some text  ',
};

describe('utils/hooks', () => {
    describe('useItem', () => {
        test('Renders a linked title and trimmed description', () => {
            const { ref, container, unmount } = renderItem(baseProps);
            const anchor = container.querySelector('.title h3 a') as HTMLAnchorElement;
            expect(anchor.getAttribute('href')).toBe('/view?m=abc');
            expect(anchor.getAttribute('title')).toBe('My video');
            expect(anchor.querySelector('span')?.getAttribute('aria-label')).toBe('My video');
            expect(container.querySelector('.descr .item-description')?.textContent).toBe('Some text');
            expect(ref.current.UnderThumbWrapper).toBe(ItemMain);
            unmount();
        });

        test('Resolves relative thumbnails against the site url', () => {
            const { ref, unmount } = renderItem(baseProps);
            expect(ref.current.thumbnailUrl).toBe('https://example.com/media/thumb.jpg');
            unmount();
        });

        test('Keeps absolute thumbnails and maps empty thumbnail to null', () => {
            const absolute = renderItem({ ...baseProps, thumbnail: 'https://cdn.example.org/t.jpg' });
            expect(absolute.ref.current.thumbnailUrl).toBe('https://cdn.example.org/t.jpg');
            absolute.unmount();

            const empty = renderItem({ ...baseProps, thumbnail: '' });
            expect(empty.ref.current.thumbnailUrl).toBeNull();
            empty.unmount();
        });

        test('Single link content renders a plain title inside a link wrapper', () => {
            const { ref, container, unmount } = renderItem({ ...baseProps, singleLinkContent: true });
            expect(container.querySelector('.title h3 a')).toBeNull();
            expect(container.querySelector('.title h3 span')?.textContent).toBe('My video');
            expect(ref.current.UnderThumbWrapper).toBe(ItemMainInLink);
            unmount();
        });

        test('Media viewer items render meta and regular descriptions', () => {
            const { container, unmount } = renderItem({
                ...baseProps,
                hasMediaViewer: true,
                hasMediaViewerDescr: true,
                meta_description: ' Meta ',
            });
            const descriptions = Array.from(container.querySelectorAll('.descr .item-description')).map(
                (el) => el.textContent
            );
            expect(descriptions).toStrictEqual(['Meta', 'Some text']);
            unmount();
        });

        test('Media viewer items fall back to blank descriptions', () => {
            const { container, unmount } = renderItem({
                ...baseProps,
                description: undefined,
                hasMediaViewer: true,
                hasMediaViewerDescr: true,
            });
            expect(container.querySelectorAll('.descr .item-description').length).toBe(2);
            unmount();
        });

        test('Empty description renders nothing', () => {
            const { container, unmount } = renderItem({ ...baseProps, description: '   ' });
            expect(container.querySelector('.descr')?.innerHTML).toBe('');
            unmount();
        });

        test('Calls onMount once after mounting', () => {
            const onMount = jest.fn();
            const { unmount } = renderItem({ ...baseProps, onMount });
            expect(onMount).toHaveBeenCalledTimes(1);
            unmount();
        });
    });
});
