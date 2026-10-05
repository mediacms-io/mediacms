import '../../_support/setupMediaCMS';
import React from 'react';
import axios from 'axios';
import { renderIntoContainer, act } from '../../_support/render';
import { PlaylistPageActions } from '../../../src/static/js/utils/actions';
import { PlaylistMediaList } from '../../../src/static/js/components/playlist-page/PlaylistMediaList';

jest.mock('axios');
jest.mock('sortablejs', () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock('../../../src/static/js/utils/actions', () => require('../../_support/compD_storeMocks').mockActionsModule());
jest.mock('../../../src/static/js/components/playlist-page/PlaylistPageMedia', () => {
    const React_ = require('react');
    return {
        PlaylistPageMedia: (props: any) => {
            React_.useEffect(() => {
                props.itemsLoadCallback();
            }, []);
            return React_.createElement(
                'div',
                { className: 'items-list', 'data-hide-options': String(props.hidePlaylistOptions) },
                props.media.map((m: any, i: number) =>
                    React_.createElement(
                        'div',
                        { key: m.friendly_token, className: 'item-order-number' },
                        React_.createElement('div', null, React_.createElement('div', { 'data-order': i + 1 }, i + 1))
                    )
                )
            );
        },
    };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;
const createMock = require('sortablejs').default.create as jest.Mock;
const List = PlaylistMediaList as unknown as React.ComponentType<any>;

describe('components/playlist-page', () => {
    describe('PlaylistMediaList', () => {
        const media = [{ friendly_token: 'a' }, { friendly_token: 'b' }, { friendly_token: 'c' }];

        beforeEach(() => {
            jest.clearAllMocks();
            mockedAxios.put.mockResolvedValue({} as any);
            document.cookie = 'csrftoken=tok';
        });

        test('Renders nothing inside the list for an empty playlist', () => {
            const { container, unmount } = renderIntoContainer(<List id="p1" media={[]} />);
            expect(container.innerHTML).toBe('<div class="playlist-videos-list"></div>');
            unmount();
        });

        test('Is not sortable for other users playlists', () => {
            const { container, unmount } = renderIntoContainer(<List id="p1" media={media} />);
            expect(container.querySelector('.items-list')?.getAttribute('data-hide-options')).toBe('true');
            expect(createMock).not.toHaveBeenCalled();
            unmount();
        });

        test('Persists drag reordering for own playlists', () => {
            const { container, unmount } = renderIntoContainer(<List id="p1" media={media} loggedinUserPlaylist />);
            expect(container.firstElementChild?.className).toBe('playlist-videos-list draggable');
            expect(container.querySelector('.items-list')?.getAttribute('data-hide-options')).toBe('false');
            const [listEl, options] = createMock.mock.calls[0];
            expect(listEl).toBe(container.querySelector('.items-list'));

            options.onStart();
            expect(listEl.classList.contains('on-dragging')).toBe(true);

            const items = listEl.querySelectorAll('.item-order-number');
            listEl.insertBefore(items[2], items[0]);
            act(() => {
                options.onEnd();
            });

            expect(listEl.classList.contains('on-dragging')).toBe(false);
            const orders = Array.from(listEl.querySelectorAll('.item-order-number div div')).map((d: any) => d.getAttribute('data-order'));
            expect(orders).toEqual(['1', '2', '3']);
            expect(mockedAxios.put.mock.calls.map((c) => c[1])).toEqual([
                { type: 'ordering', ordering: 1, media_friendly_token: 'c' },
                { type: 'ordering', ordering: 2, media_friendly_token: 'a' },
                { type: 'ordering', ordering: 3, media_friendly_token: 'b' },
            ]);
            expect(mockedAxios.put.mock.calls[0][0]).toBe('https://example.com/api/v1/playlists/p1');
            expect(mockedAxios.put.mock.calls[0][2]).toEqual({ headers: { 'X-CSRFToken': 'tok' } });
            expect((PlaylistPageActions as any).reorderedMediaInPlaylist).toHaveBeenCalledWith([
                { friendly_token: 'c' },
                { friendly_token: 'a' },
                { friendly_token: 'b' },
            ]);
            unmount();
        });
    });
});
