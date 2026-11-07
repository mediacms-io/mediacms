import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { click, changeValue, flush, jsonResponse } from '../_support/compD_dom';
import { BulkActionPermissionModal } from '../../src/static/js/components/BulkActionPermissionModal';

describe('components', () => {
    describe('BulkActionPermissionModal', () => {
        let fetchMock: jest.Mock;
        const ids = ['m1', 'm2'];

        beforeEach(() => {
            jest.useFakeTimers();
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
            delete (global as any).fetch;
            jest.restoreAllMocks();
        });

        async function setup(permissionType: 'viewer' | 'editor' | 'owner' | null, existing: string[] = [], selectedMediaIds = ids) {
            fetchMock.mockReturnValueOnce(jsonResponse({ results: existing }));
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionPermissionModal isOpen permissionType={permissionType} selectedMediaIds={selectedMediaIds} csrfToken="tok" {...props} />
            );
            await flush();
            return { ...view, ...props };
        }

        async function searchFor(container: HTMLElement, term: string) {
            changeValue(container.querySelector('.permission-panel .search-box input'), term);
            act(() => {
                jest.advanceTimersByTime(300);
            });
            await flush();
        }

        const existingItems = (c: HTMLElement) => c.querySelectorAll('.permission-panel')[1].querySelectorAll('.user-item');

        test('Renders nothing when closed', () => {
            const view = renderIntoContainer(
                <BulkActionPermissionModal isOpen={false} permissionType="viewer" selectedMediaIds={ids} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            expect(view.container.innerHTML).toBe('');
            expect(fetchMock).not.toHaveBeenCalled();
            view.unmount();
        });

        test.each([
            ['viewer', 'Share with Co-Viewers', 'Existing co-viewers'],
            ['editor', 'Share with Co-Editors', 'Existing co-editors'],
            ['owner', 'Share with Co-Owners', 'Existing co-owners'],
        ] as const)('Shows labels for %s permission', async (type, title, existingTitle) => {
            const { container, unmount } = await setup(type);
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'get_ownership', media_ids: ids, ownership_type: type });
            expect(container.querySelector('h2')?.textContent).toBe(title);
            expect(container.querySelector('.permission-modal-subtitle')).not.toBeNull();
            expect(container.querySelectorAll('h3')[1].textContent?.startsWith(existingTitle)).toBe(true);
            expect(container.querySelectorAll('.permission-panel')[1].querySelector('.empty-message')?.textContent).toBe(
                'No existing ' + title.replace('Share with ', '').toLowerCase()
            );
            unmount();
        });

        test('Does not fetch without a permission type', async () => {
            const view = renderIntoContainer(
                <BulkActionPermissionModal isOpen permissionType={null} selectedMediaIds={ids} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            await flush();
            expect(fetchMock).not.toHaveBeenCalled();
            view.unmount();
        });

        test('Reports load error', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const onError = jest.fn();
            const view = renderIntoContainer(
                <BulkActionPermissionModal isOpen permissionType="viewer" selectedMediaIds={ids} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={onError} />
            );
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to load existing permissions');
            view.unmount();
        });

        test('Searches only with at least three characters after the debounce', async () => {
            const { container, unmount } = await setup('viewer');
            await searchFor(container, 'ab');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            fetchMock.mockReturnValueOnce(jsonResponse({ results: [{ name: 'Ann', username: 'ann', email: 'a@x' }] }));
            await searchFor(container, 'ann');
            expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/users?name=ann&exclude_self=True');
            expect(container.querySelector('.search-result-item')?.textContent).toBe('Ann - a@x');
            unmount();
        });

        test('Non array or failed search results leave no results', async () => {
            const { container, unmount } = await setup('viewer');
            fetchMock.mockReturnValueOnce(jsonResponse({ results: 'bad' }));
            await searchFor(container, 'abc');
            expect(container.querySelector('.search-results')).toBeNull();
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            await searchFor(container, 'abcd');
            expect(container.querySelector('.search-results')).toBeNull();
            unmount();
        });

        test('Filters and marks existing users and posts add and remove requests', async () => {
            const { container, onSuccess, onCancel, unmount } = await setup('editor', ['Ann - ann', 'Bob - bob']);
            changeValue(container.querySelectorAll('.permission-panel')[1].querySelector('.search-box input'), 'BOB');
            expect(existingItems(container).length).toBe(1);
            changeValue(container.querySelectorAll('.permission-panel')[1].querySelector('.search-box input'), '');

            click(existingItems(container)[1].querySelector('.remove-btn'));
            expect(existingItems(container)[1].className).toContain('marked-for-removal');
            expect((existingItems(container)[1].querySelector('.remove-btn') as HTMLElement).title).toBe('Undo removal');

            fetchMock.mockReturnValueOnce(jsonResponse({ results: [{ name: 'Cat', username: 'cat' }] }));
            await searchFor(container, 'cat');
            click(container.querySelector('.search-result-item'));
            expect(container.querySelector('.search-results')).toBeNull();
            fetchMock.mockReturnValueOnce(jsonResponse({ results: [{ name: 'Cat', username: 'cat' }] }));
            await searchFor(container, 'cat');
            click(container.querySelector('.search-result-item'));
            const addList = container.querySelectorAll('.permission-panel')[0].querySelectorAll('.user-item span');
            expect(Array.from(addList).map((s) => s.textContent)).toEqual(['Cat - cat']);

            fetchMock.mockReturnValueOnce(jsonResponse({})).mockReturnValueOnce(jsonResponse({}));
            click(container.querySelector('.permission-btn-proceed'));
            await flush();
            const bodies = fetchMock.mock.calls.slice(-2).map((c) => JSON.parse(c[1].body));
            expect(bodies).toEqual([
                { action: 'set_ownership', media_ids: ids, ownership_type: 'editor', users: ['cat'] },
                { action: 'remove_ownership', media_ids: ids, ownership_type: 'editor', users: ['bob'] },
            ]);
            expect(onSuccess).toHaveBeenCalledWith('Successfully updated Co-Editors');
            expect(onCancel).toHaveBeenCalled();
            unmount();
        });

        test('Undo removal and removing from add list disable proceed', async () => {
            const { container, unmount } = await setup('owner', ['Ann - ann'], ['one']);
            const proceed = () => container.querySelector('.permission-btn-proceed') as HTMLButtonElement;
            click(existingItems(container)[0].querySelector('.remove-btn'));
            expect(proceed().disabled).toBe(false);
            click(existingItems(container)[0].querySelector('.remove-btn'));
            expect(proceed().disabled).toBe(true);

            fetchMock.mockReturnValueOnce(jsonResponse({ results: [{ name: 'Cat', username: 'cat' }] }));
            await searchFor(container, 'cat');
            click(container.querySelector('.search-result-item'));
            click(container.querySelectorAll('.permission-panel')[0].querySelector('.remove-btn'));
            expect(container.querySelectorAll('.permission-panel')[0].querySelector('.empty-message')?.textContent).toBe('No users to add');
            unmount();
        });

        test('Proceed failure reports an error', async () => {
            const { container, onError, unmount } = await setup('viewer', ['Ann - ann']);
            click(existingItems(container)[0].querySelector('.remove-btn'));
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(container.querySelector('.permission-btn-proceed'));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to update permissions. Please try again.');
            unmount();
        });
    });
});
