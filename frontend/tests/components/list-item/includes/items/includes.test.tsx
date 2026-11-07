import '../../../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../../../_support/render';
import {
    ItemDescription,
    ItemMain,
    ItemMainInLink,
    ItemTitle,
    ItemTitleLink,
    UserItemMemberSince,
    TaxonomyItemMediaCount,
    PlaylistItemMetaDate,
    MediaItemEditLink,
    MediaItemViewLink,
    MediaItemThumbnailLink,
    UserItemThumbnailLink,
    MediaItemAuthor,
    MediaItemAuthorLink,
    MediaItemMetaViews,
    MediaItemMetaDate,
    MediaItemDuration,
    MediaItemVideoPreviewer,
    MediaItemVideoPlayer,
    MediaItemPlaylistIndex,
    itemClassname,
} from '../../../../../src/static/js/components/list-item/includes/items';

function render(element: React.ReactElement) {
    return renderIntoContainer(element);
}

describe('components/list-item', () => {
    describe('includes/items', () => {
        afterEach(() => {
            (window as any).MediaCMS.site.devEnv = false;
            (window as any).MediaCMS.features.listings.includeNumbers = false;
        });

        test('itemClassname appends inherited and active playback classes', () => {
            expect(itemClassname('item', '', false)).toBe('item');
            expect(itemClassname('item', 'extra', false)).toBe('item extra');
            expect(itemClassname('item', 'extra', true)).toBe('item extra pl-active-item');
        });

        test('ItemDescription renders text or nothing for empty string', () => {
            const a = render(<ItemDescription description="Hello" />);
            expect(a.container.querySelector('.item-description > div')?.textContent).toBe('Hello');
            a.unmount();
            const b = render(<ItemDescription description="" />);
            expect(b.container.innerHTML).toBe('');
            b.unmount();
        });

        test('ItemMain and ItemMainInLink wrap children', () => {
            const a = render(
                <ItemMain>
                    <b>x</b>
                </ItemMain>
            );
            expect(a.container.querySelector('.item-main > b')).not.toBeNull();
            a.unmount();
            const b = render(
                <ItemMainInLink link="/v" title="T">
                    <b>x</b>
                </ItemMainInLink>
            );
            const link = b.container.querySelector('.item-main > a.item-content-link') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/v');
            expect(link.getAttribute('title')).toBe('T');
            expect(link.querySelector('b')).not.toBeNull();
            b.unmount();
        });

        test('ItemTitle and ItemTitleLink render aria label and skip empty titles', () => {
            const a = render(<ItemTitle title="My title" ariaLabel="My title label" />);
            expect(a.container.querySelector('h3 > span')?.getAttribute('aria-label')).toBe('My title label');
            a.unmount();
            const b = render(<ItemTitleLink title="My title" ariaLabel="lbl" link="/m" />);
            const link = b.container.querySelector('h3 > a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/m');
            expect(link.textContent).toBe('My title');
            b.unmount();
            const c = render(
                <div>
                    <ItemTitle title="" />
                    <ItemTitleLink title="" link="/m" />
                </div>
            );
            expect(c.container.firstElementChild?.innerHTML).toBe('');
            c.unmount();
        });

        test('UserItemMemberSince and PlaylistItemMetaDate show relative dates', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
            const a = render(<UserItemMemberSince date="2020-01-01T00:00:00Z" />);
            expect(a.container.querySelector('time')?.textContent).toBe('Member for 4 years');
            a.unmount();
            jest.useRealTimers();

            const b = render(<PlaylistItemMetaDate dateTime={123} text="Created today" />);
            const time = b.container.querySelector('.item-meta .playlist-date time') as HTMLElement;
            expect(time.getAttribute('datetime')).toBe('123');
            expect(time.textContent).toBe('Created today');
            b.unmount();
        });

        test('TaxonomyItemMediaCount depends on listings.includeNumbers', () => {
            const a = render(<TaxonomyItemMediaCount count={7} />);
            expect(a.container.innerHTML).toBe('');
            a.unmount();
            (window as any).MediaCMS.features.listings.includeNumbers = true;
            const b = render(<TaxonomyItemMediaCount count={7} />);
            expect(b.container.querySelector('.item-media-count')?.textContent).toBe(' 7 media');
            b.unmount();
        });

        test('MediaItemEditLink renders link, devEnv override or nothing', () => {
            const a = render(<MediaItemEditLink link="/edit?m=1" />);
            const link = a.container.querySelector('a.item-edit-icon') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/edit?m=1');
            expect(link.getAttribute('title')).toBe('Edit media');
            a.unmount();
            (window as any).MediaCMS.site.devEnv = true;
            const b = render(<MediaItemEditLink link="/edit?m=1" />);
            expect(b.container.querySelector('a')?.getAttribute('href')).toBe('/edit-media.html');
            b.unmount();
            const c = render(<MediaItemEditLink link="" />);
            expect(c.container.innerHTML).toBe('');
            c.unmount();
        });

        test('MediaItemViewLink renders publish link or nothing', () => {
            const a = render(<MediaItemViewLink link="/publish?m=1" />);
            const link = a.container.querySelector('a.item-view-icon') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/publish?m=1');
            expect(link.getAttribute('title')).toBe('Publish media');
            a.unmount();
            const b = render(<MediaItemViewLink />);
            expect(b.container.innerHTML).toBe('');
            b.unmount();
        });

        test('Thumbnail links set background image or no-thumb class', () => {
            const a = render(<MediaItemThumbnailLink src="https://cdn/t.jpg" title="T" link="/v" />);
            const link = a.container.querySelector('a.item-thumb') as HTMLAnchorElement;
            expect(link.className).toBe('item-thumb');
            expect(link.style.backgroundImage).toContain('https://cdn/t.jpg');
            expect(link.getAttribute('tabindex')).toBe('-1');
            expect(link.getAttribute('aria-hidden')).toBe('true');
            expect(link.querySelector('.item-type-icon')).not.toBeNull();
            a.unmount();

            const b = render(<MediaItemThumbnailLink src="" title="T" link="/v" />);
            expect(b.container.querySelector('a')?.className).toBe('item-thumb no-thumb');
            expect(b.container.querySelector('.item-type-icon')).toBeNull();
            b.unmount();

            const c = render(<UserItemThumbnailLink src="https://cdn/u.jpg" title="U" link="/u" />);
            expect((c.container.querySelector('a') as HTMLAnchorElement).style.backgroundImage).toContain('https://cdn/u.jpg');
            c.unmount();
            const d = render(<UserItemThumbnailLink src="" title="U" link="/u" />);
            expect(d.container.querySelector('a')?.className).toBe('item-thumb no-thumb');
            d.unmount();
        });

        test('Author components render name with optional link', () => {
            const a = render(<MediaItemAuthor name="Ann" />);
            expect(a.container.querySelector('.item-author > span')?.textContent).toBe('Ann');
            a.unmount();
            const b = render(<MediaItemAuthorLink name="Ann" link="/user/ann" />);
            const link = b.container.querySelector('.item-author > a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/user/ann');
            expect(link.getAttribute('title')).toBe('Ann');
            b.unmount();
            const c = render(
                <div>
                    <MediaItemAuthor name="" />
                    <MediaItemAuthorLink name="" link="/x" />
                </div>
            );
            expect(c.container.firstElementChild?.innerHTML).toBe('');
            c.unmount();
        });

        test.each([
            [0, '0 view'],
            [1, '1 view'],
            [2, '2 views'],
            [1500, '1.5K views'],
        ])('MediaItemMetaViews formats %p as %p', (views, expected) => {
            const v = render(<MediaItemMetaViews views={views} />);
            expect(v.container.querySelector('.item-views')?.textContent).toBe(expected);
            v.unmount();
        });

        test('MediaItemMetaDate and MediaItemDuration expose machine readable values', () => {
            const a = render(<MediaItemMetaDate dateTime={1000} time="2020-01-01" text="4 years ago" />);
            const time = a.container.querySelector('.item-date time') as HTMLElement;
            expect(time.getAttribute('datetime')).toBe('1000');
            expect(time.getAttribute('content')).toBe('2020-01-01');
            expect(time.textContent).toBe('4 years ago');
            a.unmount();
            const b = render(<MediaItemDuration ariaLabel="1 minutes" time="P0Y0M0DT0H1M0S" text="1:00" />);
            const span = b.container.querySelector('.item-duration > span') as HTMLElement;
            expect(span.getAttribute('aria-label')).toBe('1 minutes');
            expect(span.getAttribute('content')).toBe('P0Y0M0DT0H1M0S');
            expect(span.textContent).toBe('1:00');
            b.unmount();
        });

        test('MediaItemVideoPreviewer renders nothing for empty url', () => {
            const v = render(<MediaItemVideoPreviewer url="" />);
            expect(v.container.innerHTML).toBe('');
            v.unmount();
        });

        test('MediaItemVideoPreviewer renders image preview placeholder for image urls', () => {
            const v = render(<MediaItemVideoPreviewer url="/media/preview.thumb.gif" />);
            const span = v.container.querySelector('span.item-img-preview') as HTMLElement;
            expect(span.getAttribute('data-src')).toBe('/media/preview.thumb');
            expect(span.getAttribute('data-ext')).toBe('gif');
            v.unmount();
        });

        test('MediaItemVideoPreviewer plays muted video on hover and resets on leave', () => {
            const originalError = console.error;
            const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
                if ('string' === typeof args[0] && args[0].includes('unstable_flushDiscreteUpdates')) {
                    return;
                }
                originalError(...args);
            });
            const v = render(<MediaItemVideoPreviewer url="/media/preview.mp4" />);
            errorSpy.mockRestore();
            const video = v.container.querySelector('video.item-video-preview') as HTMLVideoElement;
            expect(video.getAttribute('src')).toBe('/media/preview.mp4');
            expect(video.getAttribute('preload')).toBe('none');

            const rejected = Promise.reject(new Error('not allowed'));
            const play = jest.spyOn(video, 'play').mockReturnValue(rejected);
            const pause = jest.spyOn(video, 'pause').mockImplementation(() => undefined);

            act(() => {
                video.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
            });
            expect(play).toHaveBeenCalledTimes(1);
            expect(video.muted).toBe(true);

            video.currentTime = 3;
            act(() => {
                video.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
            });
            expect(pause).toHaveBeenCalledTimes(1);
            expect(video.currentTime).toBe(0);
            v.unmount();
        });

        test('MediaItemVideoPlayer renders its wrapper', () => {
            const v = render(<MediaItemVideoPlayer mediaPageLink="/view?m=1" />);
            expect(v.container.querySelector('.item-player-wrapper .item-player-wrapper-inner')).not.toBeNull();
            v.unmount();
        });

        test('MediaItemPlaylistIndex shows index or play icon for active playback item', () => {
            const a = render(<MediaItemPlaylistIndex index={2} activeIndex={2} inPlayback={false} media_id="m1" />);
            const inner = a.container.querySelector('.item-order-number [data-order]') as HTMLElement;
            expect(inner.getAttribute('data-order')).toBe('2');
            expect(inner.getAttribute('data-id')).toBe('m1');
            expect(inner.textContent).toBe('2');
            a.unmount();
            const b = render(<MediaItemPlaylistIndex index={2} activeIndex={2} inPlayback={true} />);
            expect(b.container.querySelector('i.material-icons')?.textContent).toBe('play_arrow');
            b.unmount();
        });
    });
});
