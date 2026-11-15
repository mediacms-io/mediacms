import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { click, changeValue, flush, jsonResponse, findByText } from '../_support/compD_dom';
import { BulkActionPlaylistModal } from '../../src/static/js/components/BulkActionPlaylistModal';

describe('components', () => {
    describe('BulkActionPlaylistModal', () => {
        let fetchMock: jest.Mock;
        const ids = ['m1', 'm2'];
        const p1 = { id: 1, friendly_token: 'p1', title: 'Road trip' };
        const p2 = { id: 2, friendly_token: 'p2', title: 'Workout' };
        const p3 = { friendly_token: 'p3', title: 'No id' };

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            delete (global as any).fetch;
            jest.restoreAllMocks();
        });

        async function setup(all: any[] = [p1, p2], existing: any[] = [p1], selectedMediaIds = ids) {
            fetchMock.mockReturnValueOnce(jsonResponse({ results: all })).mockReturnValueOnce(jsonResponse({ results: existing }));
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionPlaylistModal isOpen selectedMediaIds={selectedMediaIds} csrfToken="tok" username="jo hn" {...props} />
            );
            await flush();
            return { ...view, ...props };
        }

        const leftPanel = (c: HTMLElement) => c.querySelectorAll('.playlist-panel')[0];
        const rightTitles = (c: HTMLElement) =>
            Array.from(c.querySelectorAll('.playlist-panel')[1].querySelectorAll('.playlist-item span')).map((s) => s.textContent);
        const proceed = (c: HTMLElement) => c.querySelector('.playlist-btn-proceed') as HTMLButtonElement;

        test('Renders nothing when closed', () => {
            const view = renderIntoContainer(
                <BulkActionPlaylistModal isOpen={false} selectedMediaIds={ids} csrfToken="t" username="u" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            expect(view.container.innerHTML).toBe('');
            view.unmount();
        });

        test('Loads author playlists and membership', async () => {
            const { container, unmount } = await setup();
            expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/playlists?author=jo%20hn');
            expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'playlist_membership', media_ids: ids });
            const items = leftPanel(container).querySelectorAll('.playlist-item');
            expect(items[0].className).toContain('playlist-item-disabled');
            expect((items[0].querySelector('.add-btn') as HTMLButtonElement).disabled).toBe(true);
            expect(items[1].className).not.toContain('playlist-item-disabled');
            expect(rightTitles(container)).toEqual(['Road trip']);
            expect(proceed(container).disabled).toBe(true);
            unmount();
        });

        test('Reports load errors', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(<BulkActionPlaylistModal isOpen selectedMediaIds={ids} csrfToken="t" username="u" {...props} />);
            await flush();
            expect(props.onError).toHaveBeenCalledWith('Failed to load playlists');
            view.unmount();
        });

        test('Filters playlists by search term and shows empty message', async () => {
            const { container, unmount } = await setup();
            changeValue(container.querySelector('.search-box input'), 'WORK');
            expect(Array.from(leftPanel(container).querySelectorAll('.playlist-item span')).map((s) => s.textContent)).toEqual(['Workout']);
            changeValue(container.querySelector('.search-box input'), 'zzz');
            expect(leftPanel(container).querySelector('.empty-message')?.textContent).toBe('No playlists available');
            unmount();
        });

        test('Selecting and removing playlists toggles pending changes', async () => {
            const { container, unmount } = await setup();
            click(findByText(leftPanel(container), '.playlist-item', 'Workout+'));
            expect(rightTitles(container)).toEqual(['Road trip', 'Workout']);
            expect(proceed(container).disabled).toBe(false);
            click(findByText(leftPanel(container), '.playlist-item', 'Road trip+'));
            expect(rightTitles(container)).toEqual(['Road trip', 'Workout']);
            const removes = container.querySelectorAll('.playlist-panel')[1].querySelectorAll('.remove-btn');
            click(removes[1]);
            expect(proceed(container).disabled).toBe(true);
            click(container.querySelectorAll('.playlist-panel')[1].querySelector('.remove-btn'));
            expect(container.querySelectorAll('.playlist-panel')[1].querySelector('.empty-message')?.textContent).toBe('No playlists selected');
            unmount();
        });

        test('Proceed posts add and remove requests using playlist ids', async () => {
            const { container, onSuccess, onCancel, unmount } = await setup();
            click(findByText(leftPanel(container), '.playlist-item', 'Workout+'));
            click(container.querySelectorAll('.playlist-panel')[1].querySelector('.remove-btn'));
            fetchMock.mockReturnValueOnce(jsonResponse({})).mockReturnValueOnce(jsonResponse({}));
            click(proceed(container));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'add_to_playlist', media_ids: ids, playlist_ids: [2] });
            expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ action: 'remove_from_playlist', media_ids: ids, playlist_ids: [1] });
            expect(onSuccess).toHaveBeenCalledWith('Successfully updated playlist membership');
            expect(onCancel).toHaveBeenCalled();
            unmount();
        });

        test('Skips requests for playlists without an id', async () => {
            const { container, onSuccess, unmount } = await setup([p3], []);
            click(findByText(leftPanel(container), '.playlist-item', 'No id+'));
            click(proceed(container));
            await flush();
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(onSuccess).toHaveBeenCalled();
            unmount();
        });

        test('Proceed failure reports an error', async () => {
            const { container, onError, unmount } = await setup();
            click(findByText(leftPanel(container), '.playlist-item', 'Workout+'));
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(proceed(container));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to update playlists. Please try again.');
            unmount();
        });

        test('Creates a playlist from the inline form via button and Enter key', async () => {
            const { container, unmount } = await setup([], []);
            click(container.querySelector('.create-playlist-btn'));
            const input = () => container.querySelector('.create-playlist-form input') as HTMLInputElement;
            click(container.querySelector('.create-playlist-form .create-btn'));
            expect(fetchMock).toHaveBeenCalledTimes(2);

            changeValue(input(), '  Chill  ');
            fetchMock.mockReturnValueOnce(jsonResponse({ id: 9, friendly_token: 'p9', title: 'Chill' }));
            click(container.querySelector('.create-playlist-form .create-btn'));
            await flush();
            expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/playlists');
            expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ title: 'Chill' });
            expect(container.querySelector('.create-playlist-form')).toBeNull();
            expect(leftPanel(container).querySelector('.playlist-item span')?.textContent).toBe('Chill');

            click(container.querySelector('.create-playlist-btn'));
            changeValue(input(), 'Night');
            fetchMock.mockReturnValueOnce(jsonResponse({ id: 10, friendly_token: 'p10', title: 'Night' }));
            act(() => {
                input().dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, charCode: 13, bubbles: true }));
            });
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ title: 'Night' });
            expect(leftPanel(container).querySelectorAll('.playlist-item').length).toBe(2);
            unmount();
        });

        test('Failed creation keeps the form open and cancel closes it', async () => {
            const { container, unmount } = await setup([], []);
            click(container.querySelector('.create-playlist-btn'));
            changeValue(container.querySelector('.create-playlist-form input'), 'X');
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(container.querySelector('.create-playlist-form .create-btn'));
            await flush();
            expect(container.querySelector('.create-playlist-form')).not.toBeNull();
            click(container.querySelector('.create-playlist-form .cancel-btn'));
            expect(container.querySelector('.create-playlist-form')).toBeNull();
            unmount();
        });
    });
});
