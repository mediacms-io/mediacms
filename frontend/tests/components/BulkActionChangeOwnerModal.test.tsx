import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { click, changeValue, flush, jsonResponse } from '../_support/compD_dom';
import { BulkActionChangeOwnerModal } from '../../src/static/js/components/BulkActionChangeOwnerModal';

describe('components', () => {
    describe('BulkActionChangeOwnerModal', () => {
        let fetchMock: jest.Mock;

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

        function setup(isOpen = true) {
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionChangeOwnerModal isOpen={isOpen} selectedMediaIds={['m1']} csrfToken="tok" {...props} />
            );
            return { ...view, ...props };
        }

        async function search(container: HTMLElement, term: string) {
            changeValue(container.querySelector('.search-box input'), term);
            act(() => {
                jest.advanceTimersByTime(300);
            });
            await flush();
        }

        test('Renders nothing when closed', () => {
            const { container, unmount } = setup(false);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Debounces user search and shows results', async () => {
            fetchMock.mockReturnValue(jsonResponse({ results: [{ name: 'Ann', username: 'ann', email: 'ann@x.org' }, { name: 'Bob', username: 'bob' }] }));
            const { container, unmount } = setup();
            changeValue(container.querySelector('.search-box input'), 'a');
            changeValue(container.querySelector('.search-box input'), 'an n');
            act(() => {
                jest.advanceTimersByTime(299);
            });
            expect(fetchMock).not.toHaveBeenCalled();
            act(() => {
                jest.advanceTimersByTime(1);
            });
            await flush();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith('/api/v1/users?name=an%20n&exclude_self=True');
            const items = Array.from(container.querySelectorAll('.search-result-item')).map((i) => i.textContent);
            expect(items).toEqual(['Ann - ann@x.org', 'Bob - bob']);
            unmount();
        });

        test('Blank search clears results without a request', async () => {
            const { container, unmount } = setup();
            await search(container, '   ');
            expect(fetchMock).not.toHaveBeenCalled();
            expect(container.querySelector('.search-results')).toBeNull();
            unmount();
        });

        test('Selecting a user fills the input and submitting posts change_owner', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse([{ name: 'Bob', username: 'bob' }]));
            const { container, onSuccess, onCancel, unmount } = setup();
            const submit = () => container.querySelector('.change-owner-btn-submit') as HTMLButtonElement;
            expect(submit().disabled).toBe(true);
            await search(container, 'bo');
            click(container.querySelector('.search-result-item'));
            expect((container.querySelector('.search-box input') as HTMLInputElement).value).toBe('Bob - bob');
            expect(container.querySelector('.search-results')).toBeNull();
            expect(container.querySelector('.selected-user')?.textContent).toBe('Selected: Bob - bob');
            expect(submit().disabled).toBe(false);

            fetchMock.mockReturnValueOnce(jsonResponse({ detail: 'Owner changed' }));
            click(submit());
            await flush();
            expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/media/user/bulk_actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': 'tok' },
                body: JSON.stringify({ action: 'change_owner', media_ids: ['m1'], owner: 'bob' }),
            });
            expect(onSuccess).toHaveBeenCalledWith('Owner changed');
            expect(onCancel).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Reports an error when changing owner fails', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse([{ name: 'Bob', username: 'bob' }]));
            const { container, onError, unmount } = setup();
            await search(container, 'bo');
            click(container.querySelector('.search-result-item'));
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(container.querySelector('.change-owner-btn-submit'));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to change owner. Please try again.');
            unmount();
        });

        test('Failed search keeps the results empty', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { container, unmount } = setup();
            await search(container, 'zz');
            expect(container.querySelector('.search-results')).toBeNull();
            expect(console.error).toHaveBeenCalled();
            unmount();
        });
    });
});
