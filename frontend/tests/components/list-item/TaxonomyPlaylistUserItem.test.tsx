import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { TaxonomyItem } from '../../../src/static/js/components/list-item/TaxonomyItem';
import { PlaylistItem } from '../../../src/static/js/components/list-item/PlaylistItem';
import { UserItem } from '../../../src/static/js/components/list-item/UserItem';

describe('components/list-item', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
        (window as any).MediaCMS.features.listings.includeNumbers = false;
    });

    describe('TaxonomyItem', () => {
        test('Renders thumbnail, title, description and optional media count', () => {
            (window as any).MediaCMS.features.listings.includeNumbers = true;
            const { container, unmount } = renderIntoContainer(
                <TaxonomyItem
                    type="category"
                    class_name="extra"
                    title="Nature"
                    link="/search?c=nature"
                    thumbnail="https://cdn.example.com/n.jpg"
                    description="All nature"
                    media_count={12}
                />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('item category-item extra');
            expect((root.querySelector('a.item-thumb') as HTMLElement).style.backgroundImage).toContain('n.jpg');
            expect(root.querySelector('h3 a')?.getAttribute('href')).toBe('/search?c=nature');
            expect(root.querySelector('.item-media-count')?.textContent).toBe(' 12 media');
            expect(root.querySelector('.item-description')?.textContent).toBe('All nature');
            unmount();
        });

        test('Hides meta and uses no-thumb class without thumbnail', () => {
            const { container, unmount } = renderIntoContainer(
                <TaxonomyItem type="tag" title="t" link="/t" hideAllMeta={true} />
            );
            expect(container.querySelector('.item-thumb')?.className).toBe('item-thumb no-thumb');
            expect(container.querySelector('.item-meta')).toBeNull();
            expect(container.querySelector('.item-description')).toBeNull();
            unmount();
        });
    });

    describe('PlaylistItem', () => {
        test('Renders media count, creation date and links', () => {
            const { container, unmount } = renderIntoContainer(
                <PlaylistItem
                    title="Mix"
                    link="/playlists/mix"
                    thumbnail="https://cdn.example.com/mix.jpg"
                    media_count={4}
                    publish_date="2020-01-01T00:00:00Z"
                />
            );
            const thumb = container.querySelector('a.item-thumb') as HTMLAnchorElement;
            expect(thumb.className).toBe('item-thumb');
            expect(thumb.getAttribute('href')).toBe('/playlists/mix');
            expect(thumb.querySelector('.playlist-count span')?.textContent).toBe('4');
            expect(thumb.querySelector('.playlist-hover-play-all span')?.textContent).toBe('PLAY ALL');
            const time = container.querySelector('.playlist-date time') as HTMLElement;
            expect(time.textContent).toBe('Created 4 years ago');
            expect(time.getAttribute('datetime')).toBe(String(Date.parse('2020-01-01T00:00:00Z')));
            expect(container.querySelector('.view-full-playlist')).toBeNull();
            expect(container.textContent).not.toContain('VIEW FULL PLAYLIST');
            unmount();
        });

        test('Accepts numeric publish dates and missing thumbnail', () => {
            const ts = Date.parse('2023-12-31T00:00:00Z');
            const { container, unmount } = renderIntoContainer(<PlaylistItem title="Mix" link="/p" publish_date={ts} />);
            expect(container.querySelector('a.item-thumb')?.className).toBe('item-thumb no-thumb');
            expect(container.querySelector('.playlist-count span')?.textContent).toBe('0');
            expect(container.querySelector('.playlist-date time')?.textContent).toBe('Created 1 day ago');
            unmount();
        });
    });

    describe('UserItem', () => {
        test('Renders member since meta and thumbnail', () => {
            const { container, unmount } = renderIntoContainer(
                <UserItem
                    title="bob"
                    link="/user/bob"
                    thumbnail="https://cdn.example.com/bob.jpg"
                    publish_date="2022-01-01T00:00:00Z"
                    description="Bio"
                />
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('item member-item');
            expect((root.querySelector('a.item-thumb') as HTMLElement).style.backgroundImage).toContain('bob.jpg');
            expect(root.querySelector('.item-meta time')?.textContent).toBe('Member for 2 years');
            expect(root.querySelector('.item-description')?.textContent).toBe('Bio');
            unmount();
        });

        test('Hides meta when requested', () => {
            const { container, unmount } = renderIntoContainer(
                <UserItem title="bob" link="/user/bob" hideAllMeta={true} />
            );
            expect(container.querySelector('.item-meta')).toBeNull();
            expect(container.querySelector('.item-thumb')?.className).toBe('item-thumb no-thumb');
            unmount();
        });
    });
});
