import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { useBulkActions } from '../../../src/static/js/utils/hooks/useBulkActions';

// Mock translateString to return the input for easier assertions
jest.mock('../../../src/static/js/utils/helpers', () => ({
    translateString: (s: string) => s,
}));

// Component that exposes hook state/handlers to DOM for testing
function HookConsumer() {
    const hook = useBulkActions();

    return (
        <div>
            <div data-testid="selected-count">{Array.from(hook.selectedMedia).length}</div>
            <div data-testid="available-count">{hook.availableMediaIds.length}</div>
            <div data-testid="show-confirm">{String(hook.showConfirmModal)}</div>
            <div data-testid="confirm-message">{hook.confirmMessage}</div>
            <div data-testid="list-key">{hook.listKey}</div>
            <div data-testid="notification-message">{hook.notificationMessage}</div>
            <div data-testid="show-notification">{String(hook.showNotification)}</div>

            {/* @todo: It doesn't used */}
            {/* <div data-testid="notification-type">{hook.notificationType}</div> */}

            <div data-testid="show-permission">{String(hook.showPermissionModal)}</div>
            <div data-testid="permission-type">{hook.permissionType || ''}</div>
            <div data-testid="show-playlist">{String(hook.showPlaylistModal)}</div>
            <div data-testid="show-change-owner">{String(hook.showChangeOwnerModal)}</div>
            <div data-testid="show-publish-state">{String(hook.showPublishStateModal)}</div>
            <div data-testid="show-category">{String(hook.showCategoryModal)}</div>
            <div data-testid="show-tag">{String(hook.showTagModal)}</div>

            <button data-testid="btn-handle-media-select" onClick={() => hook.handleMediaSelection('m1', true)} />
            <button data-testid="btn-handle-media-deselect" onClick={() => hook.handleMediaSelection('m1', false)} />
            <button
                data-testid="btn-handle-items-update"
                onClick={() => hook.handleItemsUpdate([{ id: 'a' }, { uid: 'b' }, { friendly_token: 'c' }])}
            />
            <button data-testid="btn-select-all" onClick={() => hook.handleSelectAll()} />
            <button data-testid="btn-deselect-all" onClick={() => hook.handleDeselectAll()} />
            <button data-testid="btn-clear-selection" onClick={() => hook.clearSelection()} />
            <button data-testid="btn-clear-refresh" onClick={() => hook.clearSelectionAndRefresh()} />

            <button data-testid="btn-bulk-delete" onClick={() => hook.handleBulkAction('delete-media')} />
            <button data-testid="btn-bulk-enable-comments" onClick={() => hook.handleBulkAction('enable-comments')} />
            <button data-testid="btn-bulk-disable-comments" onClick={() => hook.handleBulkAction('disable-comments')} />
            <button data-testid="btn-bulk-enable-download" onClick={() => hook.handleBulkAction('enable-download')} />
            <button data-testid="btn-bulk-disable-download" onClick={() => hook.handleBulkAction('disable-download')} />
            <button data-testid="btn-bulk-copy" onClick={() => hook.handleBulkAction('copy-media')} />
            <button data-testid="btn-bulk-perm-viewer" onClick={() => hook.handleBulkAction('add-remove-coviewers')} />
            <button data-testid="btn-bulk-perm-editor" onClick={() => hook.handleBulkAction('add-remove-coeditors')} />
            <button data-testid="btn-bulk-perm-owner" onClick={() => hook.handleBulkAction('add-remove-coowners')} />
            <button data-testid="btn-bulk-playlist" onClick={() => hook.handleBulkAction('add-remove-playlist')} />
            <button data-testid="btn-bulk-change-owner" onClick={() => hook.handleBulkAction('change-owner')} />
            <button data-testid="btn-bulk-publish" onClick={() => hook.handleBulkAction('publish-state')} />
            <button data-testid="btn-bulk-category" onClick={() => hook.handleBulkAction('add-remove-category')} />
            <button data-testid="btn-bulk-tag" onClick={() => hook.handleBulkAction('add-remove-tags')} />
            <button data-testid="btn-bulk-unknown" onClick={() => hook.handleBulkAction('unknown-action')} />

            <button data-testid="btn-confirm-proceed" onClick={() => hook.handleConfirmProceed()} />
            <button data-testid="btn-confirm-cancel" onClick={() => hook.handleConfirmCancel()} />
            <button data-testid="btn-perm-cancel" onClick={() => hook.handlePermissionModalCancel()} />

            <button data-testid="btn-perm-success" onClick={() => hook.handlePermissionModalSuccess('perm ok')} />
            <button data-testid="btn-perm-error" onClick={() => hook.handlePermissionModalError('perm err')} />
            <button data-testid="btn-playlist-cancel" onClick={() => hook.handlePlaylistModalCancel()} />

            <button data-testid="btn-playlist-success" onClick={() => hook.handlePlaylistModalSuccess('pl ok')} />
            <button data-testid="btn-playlist-error" onClick={() => hook.handlePlaylistModalError('pl err')} />
            <button data-testid="btn-change-owner-cancel" onClick={() => hook.handleChangeOwnerModalCancel()} />

            <button
                data-testid="btn-change-owner-success"
                onClick={() => hook.handleChangeOwnerModalSuccess('owner ok')}
            />
            <button
                data-testid="btn-change-owner-error"
                onClick={() => hook.handleChangeOwnerModalError('owner err')}
            />
            <button data-testid="btn-publish-cancel" onClick={() => hook.handlePublishStateModalCancel()} />

            <button data-testid="btn-publish-success" onClick={() => hook.handlePublishStateModalSuccess('pub ok')} />
            <button data-testid="btn-publish-error" onClick={() => hook.handlePublishStateModalError('pub err')} />
            <button data-testid="btn-category-cancel" onClick={() => hook.handleCategoryModalCancel()} />

            <button data-testid="btn-category-success" onClick={() => hook.handleCategoryModalSuccess('cat ok')} />
            <button data-testid="btn-category-error" onClick={() => hook.handleCategoryModalError('cat err')} />
            <button data-testid="btn-tag-cancel" onClick={() => hook.handleTagModalCancel()} />

            <button data-testid="btn-tag-success" onClick={() => hook.handleTagModalSuccess('tag ok')} />
            <button data-testid="btn-tag-error" onClick={() => hook.handleTagModalError('tag err')} />

            <div data-testid="csrf">{String(hook.getCsrfToken())}</div>
        </div>
    );
}

describe('useBulkActions', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        document.cookie.split(';').forEach((c) => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });

        global.fetch = jest.fn();

        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Utility Functions', () => {
        test('getCsrfToken reads csrftoken from cookies', () => {
            document.cookie = 'csrftoken=abc123';
            const { getByTestId } = render(<HookConsumer />);
            expect(getByTestId('csrf').textContent).toBe('abc123');
        });

        test('getCsrfToken returns null when csrftoken is not present', () => {
            // No cookie set, should return null
            const { getByTestId } = render(<HookConsumer />);
            expect(getByTestId('csrf').textContent).toBe('null');
        });

        test('getCsrfToken returns null when document.cookie is empty', () => {
            // Even if we try to set empty cookie, it should return null if no csrftoken
            const { getByTestId } = render(<HookConsumer />);
            expect(getByTestId('csrf').textContent).toBe('null');
        });
    });

    describe('Selection Management', () => {
        test('handleMediaSelection toggles selected media', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            expect(getByTestId('selected-count').textContent).toBe('1');

            fireEvent.click(getByTestId('btn-handle-media-deselect'));
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('handleItemsUpdate extracts ids correctly from items with different id types', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-items-update'));
            expect(getByTestId('available-count').textContent).toBe('3');
        });

        test('handleSelectAll selects all available items', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-items-update'));
            fireEvent.click(getByTestId('btn-select-all'));
            expect(getByTestId('selected-count').textContent).toBe('3');
        });

        test('handleDeselectAll deselects all items', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-items-update'));
            fireEvent.click(getByTestId('btn-select-all'));
            fireEvent.click(getByTestId('btn-deselect-all'));
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('clearSelection clears all selected media', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            expect(getByTestId('selected-count').textContent).toBe('1');

            fireEvent.click(getByTestId('btn-clear-selection'));
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('clearSelectionAndRefresh clears selection and increments listKey', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-items-update'));
            fireEvent.click(getByTestId('btn-select-all'));
            expect(getByTestId('list-key').textContent).toBe('0');

            fireEvent.click(getByTestId('btn-clear-refresh'));
            expect(getByTestId('selected-count').textContent).toBe('0');
            expect(getByTestId('list-key').textContent).toBe('1');
        });
    });

    describe('Bulk Actions - Modal Opening', () => {
        test('handleBulkAction does nothing when no selection', () => {
            const { getByTestId } = render(<HookConsumer />);
            fireEvent.click(getByTestId('btn-bulk-delete'));
            expect(getByTestId('show-confirm').textContent).toBe('false');
        });

        test('handleBulkAction opens confirm modal for delete, enable/disable comments and download, copy', () => {
            const { getByTestId } = render(<HookConsumer />);
            fireEvent.click(getByTestId('btn-handle-media-select'));

            fireEvent.click(getByTestId('btn-bulk-delete'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-enable-comments'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-disable-comments'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-enable-download'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-disable-download'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-copy'));
            expect(getByTestId('show-confirm').textContent).toBe('true');
        });

        test('handleBulkAction opens permission modals with correct types', () => {
            const { getByTestId } = render(<HookConsumer />);
            fireEvent.click(getByTestId('btn-handle-media-select'));

            fireEvent.click(getByTestId('btn-bulk-perm-viewer'));
            expect(getByTestId('show-permission').textContent).toBe('true');
            expect(getByTestId('permission-type').textContent).toBe('viewer');

            fireEvent.click(getByTestId('btn-bulk-perm-editor'));
            expect(getByTestId('permission-type').textContent).toBe('editor');

            fireEvent.click(getByTestId('btn-bulk-perm-owner'));
            expect(getByTestId('permission-type').textContent).toBe('owner');
        });

        test('handleBulkAction opens other modals', () => {
            const { getByTestId } = render(<HookConsumer />);
            fireEvent.click(getByTestId('btn-handle-media-select'));

            fireEvent.click(getByTestId('btn-bulk-playlist'));
            expect(getByTestId('show-playlist').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-change-owner'));
            expect(getByTestId('show-change-owner').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-publish'));
            expect(getByTestId('show-publish-state').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-category'));
            expect(getByTestId('show-category').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-bulk-tag'));
            expect(getByTestId('show-tag').textContent).toBe('true');
        });

        test('handleBulkAction with unknown action does nothing', () => {
            const { getByTestId } = render(<HookConsumer />);
            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-unknown'));
            expect(getByTestId('show-confirm').textContent).toBe('false');
            expect(getByTestId('show-permission').textContent).toBe('false');
        });
    });

    describe('Confirm Modal Handlers', () => {
        test('handleConfirmCancel closes confirm modal and resets state', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-delete'));
            expect(getByTestId('show-confirm').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-confirm-cancel'));
            expect(getByTestId('show-confirm').textContent).toBe('false');
            expect(getByTestId('confirm-message').textContent).toBe('');
        });
    });

    describe('Delete Media Execution', () => {
        test('executeDeleteMedia success with notification', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-delete'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('The media was deleted successfully');
            expect(getByTestId('show-notification').textContent).toBe('true');

            act(() => {
                jest.advanceTimersByTime(5000);
            });
            expect(getByTestId('show-notification').textContent).toBe('false');
        });

        test('executeDeleteMedia handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-delete'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to delete media');
        });

        test('executeDeleteMedia handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-delete'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to delete media');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });
    });

    describe('Comments Management Execution', () => {
        test('executeEnableComments success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Successfully Enabled comments');
        });

        test('executeEnableComments handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to enable comments');
        });

        test('executeEnableComments handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to enable comments');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('executeDisableComments success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Successfully Disabled comments');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('executeDisableComments handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to disable comments');
        });

        test('executeDisableComments handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-comments'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to disable comments');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });
    });

    describe('Download Management Execution', () => {
        test('executeEnableDownload success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Successfully Enabled Download');
        });

        test('executeEnableDownload handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to enable download');
        });

        test('executeEnableDownload handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-enable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to enable download');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('executeDisableDownload success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Successfully Disabled Download');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });

        test('executeDisableDownload handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to disable download');
        });

        test('executeDisableDownload handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-disable-download'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to disable download');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });
    });

    describe('Copy Media Execution', () => {
        test('executeCopyMedia success', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-copy'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Successfully Copied');
        });

        test('executeCopyMedia handles response.ok = false', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-copy'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to copy media');
        });

        test('executeCopyMedia handles fetch rejection exception', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-copy'));

            await act(async () => {
                fireEvent.click(getByTestId('btn-confirm-proceed'));
                await Promise.resolve();
            });

            expect(getByTestId('notification-message').textContent).toContain('Failed to copy media');
            expect(getByTestId('selected-count').textContent).toBe('0');
        });
    });

    describe('Permission Modal Handlers', () => {
        test('handlePermissionModalCancel closes permission modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-perm-viewer'));
            expect(getByTestId('show-permission').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-perm-cancel'));
            expect(getByTestId('show-permission').textContent).toBe('false');
            expect(getByTestId('permission-type').textContent).toBe('');
        });

        test('handlePermissionModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-perm-success'));
            expect(getByTestId('notification-message').textContent).toBe('perm ok');
            expect(getByTestId('show-permission').textContent).toBe('false');
        });

        test('handlePermissionModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-perm-error'));
            expect(getByTestId('notification-message').textContent).toBe('perm err');
            expect(getByTestId('show-permission').textContent).toBe('false');
        });
    });

    describe('Playlist Modal Handlers', () => {
        test('handlePlaylistModalCancel closes playlist modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-playlist'));
            expect(getByTestId('show-playlist').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-playlist-cancel'));
            expect(getByTestId('show-playlist').textContent).toBe('false');
        });

        test('handlePlaylistModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-playlist-success'));
            expect(getByTestId('notification-message').textContent).toBe('pl ok');
            expect(getByTestId('show-playlist').textContent).toBe('false');
        });

        test('handlePlaylistModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-playlist-error'));
            expect(getByTestId('notification-message').textContent).toBe('pl err');
            expect(getByTestId('show-playlist').textContent).toBe('false');
        });
    });

    describe('Change Owner Modal Handlers', () => {
        test('handleChangeOwnerModalCancel closes change owner modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-change-owner'));
            expect(getByTestId('show-change-owner').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-change-owner-cancel'));
            expect(getByTestId('show-change-owner').textContent).toBe('false');
        });

        test('handleChangeOwnerModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-change-owner-success'));
            expect(getByTestId('notification-message').textContent).toBe('owner ok');
            expect(getByTestId('show-change-owner').textContent).toBe('false');
        });

        test('handleChangeOwnerModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-change-owner-error'));
            expect(getByTestId('notification-message').textContent).toBe('owner err');
            expect(getByTestId('show-change-owner').textContent).toBe('false');
        });
    });

    describe('Publish State Modal Handlers', () => {
        test('handlePublishStateModalCancel closes publish state modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-publish'));
            expect(getByTestId('show-publish-state').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-publish-cancel'));
            expect(getByTestId('show-publish-state').textContent).toBe('false');
        });

        test('handlePublishStateModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-publish-success'));
            expect(getByTestId('notification-message').textContent).toBe('pub ok');
            expect(getByTestId('show-publish-state').textContent).toBe('false');
        });

        test('handlePublishStateModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-publish-error'));
            expect(getByTestId('notification-message').textContent).toBe('pub err');
            expect(getByTestId('show-publish-state').textContent).toBe('false');
        });
    });

    describe('Category Modal Handlers', () => {
        test('handleCategoryModalCancel closes category modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-category'));
            expect(getByTestId('show-category').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-category-cancel'));
            expect(getByTestId('show-category').textContent).toBe('false');
        });

        test('handleCategoryModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-category-success'));
            expect(getByTestId('notification-message').textContent).toBe('cat ok');
            expect(getByTestId('show-category').textContent).toBe('false');
        });

        test('handleCategoryModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-category-error'));
            expect(getByTestId('notification-message').textContent).toBe('cat err');
            expect(getByTestId('show-category').textContent).toBe('false');
        });
    });

    describe('Tag Modal Handlers', () => {
        test('handleTagModalCancel closes tag modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-handle-media-select'));
            fireEvent.click(getByTestId('btn-bulk-tag'));
            expect(getByTestId('show-tag').textContent).toBe('true');

            fireEvent.click(getByTestId('btn-tag-cancel'));
            expect(getByTestId('show-tag').textContent).toBe('false');
        });

        test('handleTagModalSuccess shows notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-tag-success'));
            expect(getByTestId('notification-message').textContent).toBe('tag ok');
            expect(getByTestId('show-tag').textContent).toBe('false');
        });

        test('handleTagModalError shows error notification and closes modal', () => {
            const { getByTestId } = render(<HookConsumer />);

            fireEvent.click(getByTestId('btn-tag-error'));
            expect(getByTestId('notification-message').textContent).toBe('tag err');
            expect(getByTestId('show-tag').textContent).toBe('false');
        });
    });
});
