import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { MediaItem } from '../../../src/static/js/components/list-item/MediaItem';
import { MediaItemVideo } from '../../../src/static/js/components/list-item/MediaItemVideo';
import { MediaItemAudio } from '../../../src/static/js/components/list-item/MediaItemAudio';
import { Item } from '../../../src/static/js/components/list-item/Item';

const baseProps = {
    title: 'Sunset',
    link: '/view?m=abc123',
    thumbnail: 'https://cdn.example.com/sunset.jpg',
    publish_date: '2020-01-01T00:00:00Z',
    views: 10,
    author_name: 'Ann',
    author_link: '/user/ann',
    description: ' A nice sunset ',
};

function enterSelectMediaMode() {
    window.history.pushState({}, '', '/?mode=lms_embed_mode&action=select_media');
}

function leaveSelectMediaMode() {
    window.history.pushState({}, '', '/?mode=standard');
    window.history.pushState({}, '', '/');
    sessionStorage.clear();
}

describe('components/list-item', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
        leaveSelectMediaMode();
    });

    describe('Item', () => {
        test('Declares shared default props for item components', () => {
            expect((Item as any).defaultPropValues).toStrictEqual({
                title: '',
                link: '#',
                singleLinkContent: false,
                description: '',
                meta_description: '',
                thumbnail: '',
                publish_date: 0,
            });
        });
    });

    describe.each([
        ['MediaItem image', MediaItem, { type: 'image' }, 'image-item'],
        ['MediaItem pdf', MediaItem, { type: 'pdf' }, 'pdf-item'],
        ['MediaItemAudio', MediaItemAudio, { duration: 65 }, 'audio-item'],
        ['MediaItemVideo', MediaItemVideo, { duration: 65, preview_thumbnail: '' }, 'video-item'],
    ])('%s', (_name, Component: any, extraProps, typeClass) => {
        test('Renders title link, thumbnail, meta and description', () => {
            const onMount = jest.fn();
            const { container, unmount } = renderIntoContainer(<Component {...baseProps} {...extraProps} onMount={onMount} />);
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('item ' + typeClass + ' pl-active-item');

            const titleLink = root.querySelector('.item-main h3 a') as HTMLAnchorElement;
            expect(titleLink.getAttribute('href')).toBe('/view?m=abc123');
            expect(titleLink.textContent).toBe('Sunset');

            const thumb = root.querySelector('a.item-thumb') as HTMLAnchorElement;
            expect(thumb.getAttribute('href')).toBe('/view?m=abc123');
            expect(thumb.style.backgroundImage).toContain('https://cdn.example.com/sunset.jpg');

            const authorLink = root.querySelector('.item-meta .item-author a') as HTMLAnchorElement;
            expect(authorLink.getAttribute('href')).toMatch(/^https:\/\/example\.com\/+user\/ann$/);
            expect(root.querySelector('.item-meta .item-views')?.textContent).toBe('10 views');
            expect(root.querySelector('.item-meta .item-date time')?.textContent).toBe('4 years ago');
            expect(root.querySelector('.item-description')?.textContent).toBe('A nice sunset');

            expect(root.querySelector('.item-selection-checkbox')).toBeNull();
            expect(root.querySelector('.item-edit-icon')).toBeNull();
            expect(root.querySelector('.item-view-icon')).toBeNull();
            expect(onMount).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Hides author, views, date or all meta when requested', () => {
            const a = renderIntoContainer(
                <Component {...baseProps} {...extraProps} hideAuthor={true} hideViews={true} hideDate={true} />
            );
            expect(a.container.querySelector('.item-meta')?.innerHTML).toBe('');
            a.unmount();
            const b = renderIntoContainer(<Component {...baseProps} {...extraProps} hideAllMeta={true} />);
            expect(b.container.querySelector('.item-meta')).toBeNull();
            b.unmount();
        });

        test('Single link content wraps main area in one link and renders plain author', () => {
            const { container, unmount } = renderIntoContainer(
                <Component {...baseProps} {...extraProps} singleLinkContent={true} />
            );
            const mainLink = container.querySelector('.item-main > a.item-content-link') as HTMLAnchorElement;
            expect(mainLink.getAttribute('href')).toBe('/view?m=abc123');
            expect(mainLink.querySelector('h3 > span')?.textContent).toBe('Sunset');
            expect(container.querySelector('.item-author > span')?.textContent).toBe('Ann');
            expect(container.querySelector('.item-author a')).toBeNull();
            unmount();
        });

        test('Renders no-thumb thumbnail without thumbnail url and edit link when provided', () => {
            const { container, unmount } = renderIntoContainer(
                <Component {...baseProps} {...extraProps} thumbnail="" editLink="/edit?m=abc123" class_name=" custom " playlistOrder={2} />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('item ' + typeClass + ' custom');
            expect(root.querySelector('.item-thumb')?.className).toBe('item-thumb no-thumb');
            expect(root.querySelector('a.item-edit-icon')?.getAttribute('href')).toBe('/edit?m=abc123');
            unmount();
        });

        test('Selection checkbox reports changes and item click toggles selection when any is selected', () => {
            const checkedValues: boolean[] = [];
            const onCheckboxChange = jest.fn((ev: any) => checkedValues.push(ev.target.checked));
            const { container, unmount } = renderIntoContainer(
                <Component
                    {...baseProps}
                    {...extraProps}
                    showSelection={true}
                    hasAnySelection={true}
                    isSelected={false}
                    publishLink="/publish?m=abc123"
                    onCheckboxChange={onCheckboxChange}
                />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toContain('with-selection');
            expect(root.className).toContain('has-any-selection');
            expect(root.className).not.toContain(' selected');
            expect(root.querySelector('a.item-view-icon')?.getAttribute('href')).toBe('/publish?m=abc123');

            const checkbox = root.querySelector('.item-selection-checkbox input') as HTMLInputElement;
            act(() => checkbox.click());
            expect(onCheckboxChange).toHaveBeenCalledTimes(1);
            expect(checkedValues).toStrictEqual([true]);

            const title = root.querySelector('h3 a') as HTMLAnchorElement;
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            act(() => {
                title.dispatchEvent(clickEvent);
            });
            expect(clickEvent.defaultPrevented).toBe(true);
            expect(onCheckboxChange).toHaveBeenCalledTimes(2);
            expect(onCheckboxChange.mock.calls[1][0]).toStrictEqual({ target: { checked: true } });

            act(() => {
                (root.querySelector('a.item-view-icon') as HTMLAnchorElement).dispatchEvent(
                    new MouseEvent('click', { bubbles: true, cancelable: true })
                );
            });
            expect(onCheckboxChange).toHaveBeenCalledTimes(2);
            unmount();
        });

        test('Item click does not toggle selection when nothing is selected', () => {
            const onCheckboxChange = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <Component {...baseProps} {...extraProps} isSelected={true} showSelection={true} onCheckboxChange={onCheckboxChange} />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toContain(' selected');
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            act(() => {
                (root.querySelector('h3 a') as HTMLAnchorElement).dispatchEvent(clickEvent);
            });
            expect(clickEvent.defaultPrevented).toBe(false);
            expect(onCheckboxChange).not.toHaveBeenCalled();
            unmount();
        });

        test('Select media embed mode removes links and toggles selection on click', () => {
            enterSelectMediaMode();
            const onCheckboxChange = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <Component {...baseProps} {...extraProps} editLink="/edit?m=abc123" onCheckboxChange={onCheckboxChange} />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toContain('has-any-selection');
            expect(root.querySelector('h3 a')).toBeNull();
            expect(root.querySelector('a.item-thumb')).toBeNull();
            expect(root.querySelector('.item-edit-icon')).toBeNull();
            expect(root.querySelector('.item-main h3 > span')?.textContent).toBe('Sunset');
            expect((root.querySelector('div.item-thumb') as HTMLElement).style.backgroundImage).toContain('sunset.jpg');

            act(() => (root.querySelector('h3') as HTMLElement).click());
            expect(onCheckboxChange).toHaveBeenCalledWith({ target: { checked: true } });
            unmount();
        });

        test('Select media embed mode marks missing thumbnails', () => {
            enterSelectMediaMode();
            const { container, unmount } = renderIntoContainer(<Component {...baseProps} {...extraProps} thumbnail="" />);
            expect(container.querySelector('div.item-thumb')?.className).toBe('item-thumb no-thumb');
            unmount();
        });
    });

    describe.each([
        ['MediaItemAudio', MediaItemAudio as any],
        ['MediaItemVideo', (props: any) => <MediaItemVideo preview_thumbnail="" {...props} />],
    ])('%s duration and playlist', (_name: string, Component: any) => {
        test('Shows formatted duration in the thumbnail', () => {
            const { container, unmount } = renderIntoContainer(<Component {...baseProps} duration={3725} />);
            const span = container.querySelector('a.item-thumb .item-duration > span') as HTMLElement;
            expect(span.textContent).toBe('1:02:05');
            expect(span.getAttribute('content')).toBe('P0Y0M0DT1H2M5S');
            expect(span.getAttribute('aria-label')).toBe('1 hours, 2 minutes, 5 seconds');
            unmount();
        });

        test('Shows playlist order number and hides duration in playlist playback', () => {
            const { container, unmount } = renderIntoContainer(
                <Component
                    {...baseProps}
                    duration={30}
                    hidePlaylistOrderNumber={false}
                    inPlaylistView={true}
                    playlistOrder={3}
                    playlistActiveItem={3}
                />
            );
            expect(container.querySelector('.item-order-number i')?.textContent).toBe('play_arrow');
            expect(container.querySelector('.item-duration')).toBeNull();
            unmount();
        });
    });

    describe('MediaItemVideo', () => {
        test('Renders video preview from preview thumbnail', () => {
            const { container, unmount } = renderIntoContainer(
                <MediaItemVideo {...baseProps} preview_thumbnail="/media/preview.gif" />
            );
            expect(container.querySelector('a.item-thumb .item-img-preview')?.getAttribute('data-ext')).toBe('gif');
            unmount();
        });

        test('Hides preview in playlist page', () => {
            const { container, unmount } = renderIntoContainer(
                <MediaItemVideo {...baseProps} preview_thumbnail="/media/preview.gif" inPlaylistPage={true} />
            );
            expect(container.querySelector('.item-img-preview')).toBeNull();
            unmount();
        });

        test('Renders media viewer instead of thumbnail when requested', () => {
            const { container, unmount } = renderIntoContainer(<MediaItemVideo {...baseProps} preview_thumbnail="" hasMediaViewer={true} />);
            expect(container.querySelector('.item-player-wrapper')).not.toBeNull();
            expect(container.querySelector('.item-thumb')).toBeNull();
            unmount();
        });

        test('Select media embed mode renders duration and preview without a link', () => {
            enterSelectMediaMode();
            const { container, unmount } = renderIntoContainer(
                <MediaItemVideo {...baseProps} duration={5} preview_thumbnail="/media/preview.gif" />
            );
            const thumb = container.querySelector('div.item-thumb') as HTMLElement;
            expect(thumb.querySelector('.item-duration')?.textContent).toBe('0:05');
            expect(thumb.querySelector('.item-img-preview')).not.toBeNull();
            unmount();
        });
    });
});
