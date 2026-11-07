import { renderHook, act } from '../../_support/render';
import { useBulkActions } from '../../../src/static/js/utils/hooks/useBulkActions';

type BulkActions = ReturnType<typeof useBulkActions>;

async function flushPromises() {
    for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
    }
}

function jsonResponse(data: any, ok = true) {
    return { ok, json: () => Promise.resolve(data) };
}

describe('utils/hooks', () => {
    describe('useBulkActions', () => {
        let fetchMock: jest.Mock;
        let view: { result: { current: BulkActions }; unmount: () => void } | null;

        function mount() {
            view = renderHook(() => useBulkActions());
            return view.result;
        }

        function selectIds(result: { current: BulkActions }, ids: string[]) {
            act(() => {
                ids.forEach((id) => result.current.handleMediaSelection(id, true));
            });
        }

        async function proceed(result: { current: BulkActions }, action: string) {
            act(() => result.current.handleBulkAction(action));
            act(() => result.current.handleConfirmProceed());
            await act(async () => {
                await flushPromises();
            });
        }

        beforeEach(() => {
            jest.useFakeTimers();
            sessionStorage.clear();
            document.cookie = 'csrftoken=tok%20en';
            fetchMock = jest.fn();
            (globalThis as any).fetch = fetchMock;
            view = null;
        });

        afterEach(() => {
            act(() => {
                jest.runOnlyPendingTimers();
            });
            view?.unmount();
            jest.useRealTimers();
            delete (globalThis as any).fetch;
        });

        test('Starts with empty selection and closed modals', () => {
            const result = mount();
            const s = result.current;
            expect(s.selectedMedia.size).toBe(0);
            expect(s.availableMediaIds).toStrictEqual([]);
            expect(s.listKey).toBe(0);
            expect(s.showConfirmModal).toBe(false);
            expect(s.confirmMessage).toBe('');
            expect(s.showNotification).toBe(false);
            expect(s.notificationType).toBe('success');
            expect(s.permissionType).toBeNull();
            expect(s.showPlaylistModal || s.showChangeOwnerModal || s.showPublishStateModal).toBe(false);
            expect(s.showCategoryModal || s.showTagModal || s.showCourseCleanupModal).toBe(false);
            expect(s.hasContributorCourses).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        test('Inside an embedded app it detects contributor courses', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            fetchMock.mockResolvedValueOnce(jsonResponse({ results: [{ id: 1 }] }));
            const result = mount();
            await act(async () => {
                await flushPromises();
            });
            expect(fetchMock).toHaveBeenCalledWith('/api/v1/categories/contributor?lms_courses_only=true');
            expect(result.current.hasContributorCourses).toBe(true);
        });

        test('Inside an embedded app an empty course list keeps the flag off', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            fetchMock.mockResolvedValueOnce(jsonResponse([]));
            const result = mount();
            await act(async () => {
                await flushPromises();
            });
            expect(result.current.hasContributorCourses).toBe(false);
        });

        test('Inside an embedded app failed course lookups are ignored', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            fetchMock.mockResolvedValueOnce(jsonResponse(null, false));
            const result = mount();
            await act(async () => {
                await flushPromises();
            });
            expect(result.current.hasContributorCourses).toBe(false);
        });

        test('Inside an embedded app rejected course lookups are swallowed', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            fetchMock.mockRejectedValueOnce(new Error('offline'));
            const result = mount();
            await act(async () => {
                await flushPromises();
            });
            expect(result.current.hasContributorCourses).toBe(false);
        });

        test('getCsrfToken decodes the csrftoken cookie', () => {
            const result = mount();
            expect(result.current.getCsrfToken()).toBe('tok en');
        });

        test('handleMediaSelection adds and removes ids', () => {
            const result = mount();
            selectIds(result, ['a', 'b']);
            expect(Array.from(result.current.selectedMedia)).toStrictEqual(['a', 'b']);
            act(() => result.current.handleMediaSelection('a', false));
            expect(Array.from(result.current.selectedMedia)).toStrictEqual(['b']);
        });

        test('handleItemsUpdate prefers friendly_token, then uid, then id and select all uses them', () => {
            const result = mount();
            act(() => result.current.handleItemsUpdate([{ friendly_token: 'ft', uid: 'u' }, { uid: 'u2', id: 3 }, { id: 4 }]));
            expect(result.current.availableMediaIds).toStrictEqual(['ft', 'u2', 4]);

            act(() => result.current.handleSelectAll());
            expect(Array.from(result.current.selectedMedia)).toStrictEqual(['ft', 'u2', 4]);

            act(() => result.current.handleDeselectAll());
            expect(result.current.selectedMedia.size).toBe(0);
        });

        test('clearSelection and clearSelectionAndRefresh empty the selection', () => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.clearSelection());
            expect(result.current.selectedMedia.size).toBe(0);
            expect(result.current.listKey).toBe(0);

            selectIds(result, ['a']);
            act(() => result.current.clearSelectionAndRefresh());
            expect(result.current.selectedMedia.size).toBe(0);
            expect(result.current.listKey).toBe(1);
        });

        test('Bulk actions are ignored without a selection', () => {
            const result = mount();
            act(() => result.current.handleBulkAction('delete-media'));
            act(() => result.current.handleBulkAction('add-remove-playlist'));
            expect(result.current.showConfirmModal).toBe(false);
            expect(result.current.showPlaylistModal).toBe(false);
        });

        test('Course cleanup opens its modal even without a selection', () => {
            const result = mount();
            act(() => result.current.handleBulkAction('course-cleanup'));
            expect(result.current.showCourseCleanupModal).toBe(true);
            act(() => result.current.handleCourseCleanupModalCancel());
            expect(result.current.showCourseCleanupModal).toBe(false);
        });

        test.each([
            ['delete-media', 'You are going to delete 2 media, are you sure?'],
            ['enable-comments', 'You are going to enable comments to 2 media, are you sure?'],
            ['disable-comments', 'You are going to disable comments to 2 media, are you sure?'],
            ['delete-comments', 'You are going to delete all comments from 2 media, are you sure?'],
            ['enable-download', 'You are going to enable download for 2 media, are you sure?'],
            ['disable-download', 'You are going to disable download for 2 media, are you sure?'],
            ['copy-media', 'You are going to copy 2 media, are you sure?'],
        ])('%s asks for confirmation', (action, message) => {
            const result = mount();
            selectIds(result, ['a', 'b']);
            act(() => result.current.handleBulkAction(action));
            expect(result.current.showConfirmModal).toBe(true);
            expect(result.current.confirmMessage).toBe(message);

            act(() => result.current.handleConfirmCancel());
            expect(result.current.showConfirmModal).toBe(false);
            expect(result.current.confirmMessage).toBe('');
            act(() => result.current.handleConfirmProceed());
            expect(fetchMock).not.toHaveBeenCalled();
        });

        test.each([
            ['add-remove-coviewers', 'viewer'],
            ['add-remove-coeditors', 'editor'],
            ['add-remove-coowners', 'owner'],
        ])('%s opens the permission modal for %s', (action, type) => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction(action));
            expect(result.current.showPermissionModal).toBe(true);
            expect(result.current.permissionType).toBe(type);

            act(() => result.current.handlePermissionModalCancel());
            expect(result.current.showPermissionModal).toBe(false);
            expect(result.current.permissionType).toBeNull();
        });

        test.each([
            ['add-remove-playlist', 'showPlaylistModal'],
            ['change-owner', 'showChangeOwnerModal'],
            ['publish-state', 'showPublishStateModal'],
            ['add-remove-category', 'showCategoryModal'],
            ['add-remove-tags', 'showTagModal'],
        ])('%s opens %s', (action, flag) => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction(action));
            expect((result.current as any)[flag]).toBe(true);
        });

        test('Unknown actions do nothing', () => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction('unknown'));
            expect(result.current.showConfirmModal).toBe(false);
            expect(result.current.showPermissionModal).toBe(false);
        });

        test.each([
            ['enable-comments', 'enable_comments', 'Successfully Enabled comments'],
            ['disable-comments', 'disable_comments', 'Successfully Disabled comments'],
            ['delete-comments', 'delete_comments', 'Successfully deleted comments'],
            ['enable-download', 'enable_download', 'Successfully Enabled Download'],
            ['disable-download', 'disable_download', 'Successfully Disabled Download'],
        ])('Confirmed %s posts %s and clears selection', async (action, apiAction, message) => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));
            const result = mount();
            selectIds(result, ['a', 'b']);
            await proceed(result, action);

            expect(fetchMock).toHaveBeenCalledWith('/api/v1/media/user/bulk_actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': 'tok en' },
                body: JSON.stringify({ action: apiAction, media_ids: ['a', 'b'] }),
            });
            expect(result.current.notificationMessage).toBe(message);
            expect(result.current.notificationType).toBe('success');
            expect(result.current.showNotification).toBe(true);
            expect(result.current.selectedMedia.size).toBe(0);
            expect(result.current.listKey).toBe(0);
            expect(result.current.showConfirmModal).toBe(false);
        });

        test.each([
            ['enable-comments', 'Failed to enable comments.'],
            ['disable-comments', 'Failed to disable comments.'],
            ['delete-comments', 'Failed to delete comments.'],
            ['enable-download', 'Failed to enable download.'],
            ['disable-download', 'Failed to disable download.'],
            ['copy-media', 'Failed to copy media.'],
        ])('Failed %s shows an error and clears selection without refresh', async (action, message) => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
            const result = mount();
            selectIds(result, ['a']);
            await proceed(result, action);

            expect(result.current.notificationMessage).toBe(message);
            expect(result.current.notificationType).toBe('error');
            expect(result.current.selectedMedia.size).toBe(0);
            expect(result.current.listKey).toBe(0);
        });

        test('Deleting a single media reports singular success and refreshes the list', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));
            const result = mount();
            selectIds(result, ['a']);
            await proceed(result, 'delete-media');

            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toStrictEqual({ action: 'delete_media', media_ids: ['a'] });
            expect(result.current.notificationMessage).toBe('The media was deleted successfully.');
            expect(result.current.listKey).toBe(1);
        });

        test('Deleting several media reports the count', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));
            const result = mount();
            selectIds(result, ['a', 'b', 'c']);
            await proceed(result, 'delete-media');
            expect(result.current.notificationMessage).toBe('Successfully deleted 3 media.');
        });

        test('Failed deletion shows an error and still refreshes the list', async () => {
            fetchMock.mockRejectedValueOnce(new Error('offline'));
            const result = mount();
            selectIds(result, ['a']);
            await proceed(result, 'delete-media');
            expect(result.current.notificationMessage).toBe('Failed to delete media. Please try again.');
            expect(result.current.notificationType).toBe('error');
            expect(result.current.listKey).toBe(1);
        });

        test('Copying media refreshes the list on success', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));
            const result = mount();
            selectIds(result, ['a']);
            await proceed(result, 'copy-media');
            expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe('copy_media');
            expect(result.current.notificationMessage).toBe('Successfully Copied');
            expect(result.current.listKey).toBe(1);
        });

        test('Notifications hide after five seconds', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));
            const result = mount();
            selectIds(result, ['a']);
            await proceed(result, 'enable-download');
            expect(result.current.showNotification).toBe(true);

            act(() => {
                jest.advanceTimersByTime(4999);
            });
            expect(result.current.showNotification).toBe(true);
            act(() => {
                jest.advanceTimersByTime(1);
            });
            expect(result.current.showNotification).toBe(false);
        });

        test('Permission modal success and error close the modal with a notification', () => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction('add-remove-coviewers'));
            act(() => result.current.handlePermissionModalSuccess('Saved'));
            expect(result.current.showPermissionModal).toBe(false);
            expect(result.current.permissionType).toBeNull();
            expect(result.current.notificationMessage).toBe('Saved');
            expect(result.current.selectedMedia.size).toBe(0);

            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction('add-remove-coeditors'));
            act(() => result.current.handlePermissionModalError('Nope'));
            expect(result.current.showPermissionModal).toBe(false);
            expect(result.current.notificationType).toBe('error');
            expect(result.current.selectedMedia.size).toBe(1);
        });

        test.each([
            ['add-remove-playlist', 'showPlaylistModal', 'PlaylistModal', false],
            ['change-owner', 'showChangeOwnerModal', 'ChangeOwnerModal', true],
            ['publish-state', 'showPublishStateModal', 'PublishStateModal', true],
            ['add-remove-category', 'showCategoryModal', 'CategoryModal', false],
            ['add-remove-tags', 'showTagModal', 'TagModal', false],
            ['course-cleanup', 'showCourseCleanupModal', 'CourseCleanupModal', true],
        ])('%s modal handlers close it and notify', (action, flag, name, refreshes) => {
            const result = mount();
            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction(action));
            act(() => (result.current as any)['handle' + name + 'Cancel']());
            expect((result.current as any)[flag]).toBe(false);

            act(() => result.current.handleBulkAction(action));
            act(() => (result.current as any)['handle' + name + 'Success']('Done'));
            expect((result.current as any)[flag]).toBe(false);
            expect(result.current.notificationMessage).toBe('Done');
            expect(result.current.notificationType).toBe('success');
            expect(result.current.selectedMedia.size).toBe(0);
            expect(result.current.listKey).toBe(refreshes ? 1 : 0);

            selectIds(result, ['a']);
            act(() => result.current.handleBulkAction(action));
            act(() => (result.current as any)['handle' + name + 'Error']('Broken'));
            expect((result.current as any)[flag]).toBe(false);
            expect(result.current.notificationMessage).toBe('Broken');
            expect(result.current.notificationType).toBe('error');
            expect(result.current.selectedMedia.size).toBe(1);
        });
    });
});
