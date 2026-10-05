import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { ListItem, listItemProps as listItemPropsSource } from '../../../src/static/js/components/list-item/ListItem';
import { initPage } from '../../../src/static/js/utils/actions/PageActions';

const listItemProps = listItemPropsSource as (props: any, item: any, index: number) => any;

const mediaItem = {
    friendly_token: 'abc',
    url: '/view?m=abc',
    title: 'Clip',
    media_type: 'video',
    thumbnail_url: 'https://cdn.example.com/clip.jpg',
    preview_url: '/media/clip.gif',
    duration: 61,
    views: 5,
    author_name: 'Ann',
    author_profile: '/user/Ann Smith',
    add_date: '2020-01-01T00:00:00Z',
    description: ' <b>Bold</b> text ',
};

describe('components/list-item', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
        (window as any).MediaCMS.site.devEnv = false;
        initPage('home');
    });

    describe('listItemProps', () => {
        test('Maps a media item to list item args', () => {
            const args = listItemProps({}, mediaItem, 0);
            expect(args).toStrictEqual({
                order: 1,
                type: 'video',
                title: 'Clip',
                date: '2020-01-01T00:00:00Z',
                url: { view: '/view?m=abc', edit: null, publish: null },
                author: { name: 'Ann', url: '/user/Ann%20Smith' },
                stats: { views: 5 },
                thumbnail: 'https://cdn.example.com/clip.jpg',
                taxonomyPage: { current: false, type: null },
                playlistPage: { current: undefined, id: undefined, hideOptions: false, hideOrderNumber: false },
                playlistPlayback: { current: undefined, id: undefined, activeItem: false, hideOrderNumber: false },
                canEdit: false,
                singleLinkContent: false,
                hasMediaViewer: false,
                hasMediaViewerDescr: false,
                meta_description: 'Bold text',
                previewThumbnail: '/media/clip.gif',
                duration: 61,
                hide: { allMeta: false, date: false, views: false, author: false },
            });
        });

        test('Builds edit and publish urls when editing is allowed', () => {
            const args = listItemProps({ canEdit: true }, mediaItem, 2);
            expect(args.order).toBe(3);
            expect(args.url).toStrictEqual({ view: '/view?m=abc', edit: '/edit?m=abc', publish: '/publish?m=abc' });
            expect(args.canEdit).toBe(true);
        });

        test('Appends playlist id from props or from query string in playlist view', () => {
            expect(listItemProps({ playlistId: 'p1' }, mediaItem, 0).url.view).toBe('/view?m=abc&pl=p1');

            window.history.pushState({}, '', '/view?m=abc&pl=fromQuery');
            expect(listItemProps({ inPlaylistView: true, playlistId: 'p1' }, mediaItem, 0).url.view).toBe(
                '/view?m=abc&pl=fromQuery'
            );

            window.history.pushState({}, '', '/view?m=abc&pl');
            expect(listItemProps({ inPlaylistView: true }, mediaItem, 0).url.view).toBe('/view?m=abc');
        });

        test('Rewrites view urls in dev environment', () => {
            (window as any).MediaCMS.site.devEnv = true;
            expect(listItemProps({}, mediaItem, 0).url.view).toBe('/media.html?m=abc');
        });

        test('Builds category and tag archive items', () => {
            const category = { uid: 'c 1', title: 'Cat', url: '/search?c=Cat', media_count: '4', description: 'About' };
            const cat = listItemProps({ inCategoriesList: true }, category, 0);
            expect(cat.url.view).toBe('/search?c=c%201');
            expect(cat.taxonomyPage).toStrictEqual({ current: true, type: 'categories' });
            expect(cat.media_count).toBe(4);
            expect(cat.description).toBe('About');
            expect(cat.type).toBeUndefined();

            const tag = listItemProps({ inTagsList: true }, { title: 'a&b', url: '/search?t=a', media_count: 2 }, 0);
            expect(tag.url.view).toBe('/search?t=a%26b');
            expect(tag.taxonomyPage).toStrictEqual({ current: true, type: 'tags' });
        });

        test('Detects user and playlist items', () => {
            const user = listItemProps({}, { username: 'bob', url: '/user/bob', date_added: '2021-01-01', description: 'Hi' }, 0);
            expect(user.type).toBe('user');
            expect(user.title).toBe('bob');
            expect(user.date).toBe('2021-01-01');
            expect(user.description).toBe('Hi');
            expect(user.hide).toStrictEqual({ allMeta: false });

            const playlist = listItemProps({}, { title: 'PL', url: '/playlists/xyz', media_count: 3 }, 0);
            expect(playlist.type).toBe('playlist');
            expect(playlist.media_count).toBe(3);
            expect(playlist.date).toBeNull();
            expect(playlist.meta_description).toBeNull();
        });

        test('Uses summary and description for first item media viewer', () => {
            const args = listItemProps(
                { firstItemViewer: true, firstItemDescr: true, summary: ' <i>Sum</i> ' },
                mediaItem,
                0
            );
            expect(args.hasMediaViewer).toBe(true);
            expect(args.hasMediaViewerDescr).toBe(true);
            expect(args.description).toBe('Sum');
            expect(args.meta_description).toBe('Sum');
        });

        test('Prefers summary over description when requested and exposes description on search page', () => {
            initPage('search-results');
            const args = listItemProps({ preferSummary: true, summary: ' Short ' }, mediaItem, 0);
            expect(args.description).toBe('Short');
            expect(args.meta_description).toBeUndefined();
        });

        test('Applies hide flags and falls back to user field for author', () => {
            const args = listItemProps(
                { hideAllMeta: true, hideDate: true, hideViews: true, hideAuthor: true },
                { url: '/view?m=x', title: 'X', media_type: 'image', user: 'carl' },
                0
            );
            expect(args.author).toStrictEqual({ name: 'carl', url: null });
            expect(args.stats).toStrictEqual({ views: null });
            expect(args.hide).toStrictEqual({ allMeta: true, date: true, views: true, author: true });
            expect(args.thumbnail).toBe('');
            expect(args.duration).toBeUndefined();
        });
    });

    describe('ListItem', () => {
        function renderItem(props: any, item: any) {
            return renderIntoContainer(<ListItem {...listItemProps(props, item, 0)} />);
        }

        test.each([
            ['video', 'video-item'],
            ['audio', 'audio-item'],
            ['image', 'image-item'],
            ['pdf', 'pdf-item'],
        ])('Renders %s media items with the matching component', (mediaType, className) => {
            const { container, unmount } = renderItem({}, { ...mediaItem, media_type: mediaType });
            expect(container.firstElementChild?.className).toContain('item ' + className);
            expect(container.querySelector('.item-author a')?.getAttribute('href')).toContain('/user/Ann%20Smith');
            expect(container.querySelector('.item-views')?.textContent).toBe('5 views');
            unmount();
        });

        test('Falls back to attachment item for unknown media types', () => {
            const { container, unmount } = renderItem({}, { ...mediaItem, media_type: 'attachment' });
            expect(container.firstElementChild?.className).toBe('item attachment-item pl-active-item');
            unmount();
        });

        test('Renders user items', () => {
            const { container, unmount } = renderItem({}, { username: 'bob', url: '/user/bob', date_added: '2021-01-01T00:00:00Z', description: '' });
            expect(container.firstElementChild?.className).toBe('item member-item');
            expect(container.querySelector('h3 a')?.textContent).toBe('bob');
            unmount();
        });

        test('Renders playlist items and rewrites link in dev environment', () => {
            const a = renderItem({}, { title: 'PL', url: '/playlists/xyz', media_count: 3, add_date: '2021-01-01T00:00:00Z' });
            expect(a.container.firstElementChild?.className).toBe('item playlist-item');
            expect(a.container.querySelector('.playlist-count span')?.textContent).toBe('3');
            a.unmount();

            (window as any).MediaCMS.site.devEnv = true;
            const b = renderItem({}, { title: 'PL', url: '/playlists/xyz', media_count: 3, add_date: '2021-01-01T00:00:00Z' });
            expect(b.container.querySelector('h3 a')?.getAttribute('href')).toBe('playlist.html?pl=xyz');
            b.unmount();
        });

        test('Renders category and tag taxonomy items', () => {
            const a = renderItem({ inCategoriesList: true }, { uid: 'c1', title: 'Cat', url: '/c', media_count: 1, description: '' });
            expect(a.container.firstElementChild?.className).toBe('item category-item');
            a.unmount();
            const b = renderItem({ inTagsList: true }, { title: 'Tag', url: '/t', media_count: 1 });
            expect(b.container.firstElementChild?.className).toBe('item tag-item');
            b.unmount();
        });

        test('Passes edit links and playlist page settings through', () => {
            const { container, unmount } = renderItem(
                { canEdit: true, inPlaylistPage: true, playlistId: 'p1', hidePlaylistOrderNumber: false },
                mediaItem
            );
            expect(container.querySelector('a.item-edit-icon')?.getAttribute('href')).toBe('/edit?m=abc');
            expect(container.querySelector('.item-order-number [data-order]')?.textContent).toBe('1');
            unmount();
        });

        test('Passes playlist playback settings through', () => {
            const { container, unmount } = renderItem(
                { inPlaylistView: true, playlistId: 'p1', playlistActiveItem: 1, hidePlaylistOrderNumber: false },
                mediaItem
            );
            expect(container.firstElementChild?.className).toContain('pl-active-item');
            expect(container.querySelector('.item-order-number [data-order]')?.getAttribute('data-order')).toBe('1');
            unmount();
        });

        test('Forwards checkbox changes with media id', () => {
            const onSelectionChange = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ListItem
                    {...listItemProps({}, mediaItem, 0)}
                    mediaId="abc"
                    showSelection={true}
                    isSelected={false}
                    onSelectionChange={onSelectionChange}
                />
            );
            (container.querySelector('.item-selection-checkbox input') as HTMLInputElement).click();
            expect(onSelectionChange).toHaveBeenCalledWith('abc', true);
            unmount();
        });
    });
});
