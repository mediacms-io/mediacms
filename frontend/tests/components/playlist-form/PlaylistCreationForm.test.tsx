import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, changeValue } from '../../_support/compD_dom';
import { MediaPageStore, PlaylistPageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions, PlaylistPageActions } from '../../../src/static/js/utils/actions/';
import { PlaylistCreationForm } from '../../../src/static/js/components/playlist-form/PlaylistCreationForm';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;

describe('components/playlist-form', () => {
    describe('PlaylistCreationForm', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mediaStore.__reset();
            (PlaylistPageStore as any).__reset({ title: 'Old title', description: 'Old description' });
        });

        function setup(id?: string) {
            const onCancel = jest.fn();
            const onPlaylistSave = jest.fn();
            const view = renderIntoContainer(<PlaylistCreationForm id={id} onCancel={onCancel} onPlaylistSave={onPlaylistSave} />);
            return { ...view, onCancel, onPlaylistSave };
        }

        test('Starts empty in create mode and focuses the title', () => {
            const { container, unmount } = setup();
            const input = container.querySelector('.playlist-title input') as HTMLInputElement;
            expect(input.value).toBe('');
            expect(document.activeElement).toBe(input);
            expect(container.querySelector('.create-btn')?.textContent).toBe('CREATE');
            expect(container.querySelector('.playlist-title')?.className).toContain('focused');
            unmount();
        });

        test('Prefills from the playlist page store in update mode', () => {
            const { container, unmount } = setup('pl1');
            expect((container.querySelector('.playlist-title input') as HTMLInputElement).value).toBe('Old title');
            expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Old description');
            expect(container.querySelector('.create-btn')?.textContent).toBe('UPDATE');
            unmount();
        });

        test('Marks the title invalid when empty and clears it on click', () => {
            const { container, unmount } = setup();
            click(container.querySelector('.create-btn'));
            expect(container.querySelector('.playlist-title')?.className).toContain('invalid');
            expect((MediaPageActions as any).createPlaylist).not.toHaveBeenCalled();
            click(container.querySelector('.playlist-title input'));
            expect(container.querySelector('.playlist-title')?.className).not.toContain('invalid');
            unmount();
        });

        test('Creates a playlist with trimmed values', () => {
            const { container, unmount } = setup();
            changeValue(container.querySelector('.playlist-title input'), '  Mix  ');
            changeValue(container.querySelector('textarea'), ' Desc ');
            click(container.querySelector('.create-btn'));
            expect((MediaPageActions as any).createPlaylist).toHaveBeenCalledWith({ title: 'Mix', description: 'Desc' });
            unmount();
        });

        test('Updates an existing playlist', () => {
            const { container, unmount } = setup('pl1');
            changeValue(container.querySelector('.playlist-title input'), 'New');
            click(container.querySelector('.create-btn'));
            expect((PlaylistPageActions as any).updatePlaylist).toHaveBeenCalledWith({ title: 'New', description: 'Old description' });
            unmount();
        });

        test('Description focus and blur toggle the focused class', () => {
            const { container, unmount } = setup();
            act(() => {
                (container.querySelector('textarea') as HTMLTextAreaElement).focus();
            });
            expect(container.querySelector('.playlist-description')?.className).toContain('focused');
            expect(container.querySelector('.playlist-title')?.className).not.toContain('focused');
            act(() => {
                (container.querySelector('textarea') as HTMLTextAreaElement).blur();
            });
            expect(container.querySelector('.playlist-description')?.className).not.toContain('focused');
            unmount();
        });

        test('Creation completion notifies and passes normalized playlist data', () => {
            jest.useFakeTimers();
            const { onPlaylistSave, unmount } = setup();
            act(() => {
                mediaStore.emit('playlist_creation_completed', {
                    url: 'https://example.com/playlists/abc123',
                    add_date: '2024-01-01',
                    description: 'd',
                    title: 't',
                });
            });
            jest.advanceTimersByTime(100);
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Playlist created', 'playlistCreationCompleted');
            expect(onPlaylistSave).toHaveBeenCalledWith({ playlist_id: 'abc123', add_date: '2024-01-01', description: 'd', title: 't', media_list: [] });
            unmount();
            jest.useRealTimers();
        });

        test('Creation failure notifies and cancel calls back', () => {
            jest.useFakeTimers();
            const { container, onCancel, unmount } = setup();
            act(() => {
                mediaStore.emit('playlist_creation_failed');
            });
            jest.advanceTimersByTime(100);
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Playlist creation failed', 'playlistCreationFailed');
            click(container.querySelector('.cancel-btn'));
            expect(onCancel).toHaveBeenCalled();
            unmount();
            expect(mediaStore.listenerCount('playlist_creation_failed')).toBe(0);
            jest.useRealTimers();
        });
    });
});
