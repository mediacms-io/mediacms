import React from 'react';
import { renderIntoContainer } from '../_support/render';
import { click, changeValue, flush, jsonResponse } from '../_support/compD_dom';
import { BulkActionPublishStateModal } from '../../src/static/js/components/BulkActionPublishStateModal';

describe('components', () => {
    describe('BulkActionPublishStateModal', () => {
        let fetchMock: jest.Mock;

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            delete (global as any).fetch;
            sessionStorage.clear();
            jest.restoreAllMocks();
        });

        function setup(isOpen = true) {
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionPublishStateModal isOpen={isOpen} selectedMediaIds={['a', 'b']} csrfToken="tok" {...props} />
            );
            return { ...view, ...props };
        }

        test('Renders nothing when closed', () => {
            const { container, unmount } = setup(false);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Lists all publish states and keeps submit disabled until one is selected', () => {
            const { container, unmount } = setup();
            const values = Array.from(container.querySelectorAll('option')).map((o) => o.value);
            expect(values).toEqual(['', 'public', 'unlisted', 'private']);
            const submit = container.querySelector('.publish-state-btn-submit') as HTMLButtonElement;
            expect(submit.disabled).toBe(true);
            changeValue(container.querySelector('select'), 'unlisted');
            expect(submit.disabled).toBe(false);
            unmount();
        });

        test('Hides the public state in LMS embed mode', () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            const { container, unmount } = setup();
            const values = Array.from(container.querySelectorAll('option')).map((o) => o.value);
            expect(values).toEqual(['', 'unlisted', 'private']);
            unmount();
        });

        test('Requires acknowledgement when removing sharing', () => {
            const { container, unmount } = setup();
            changeValue(container.querySelector('select'), 'private');
            const removeSharing = container.querySelector('.shared-selector input') as HTMLInputElement;
            click(removeSharing);
            const ack = container.querySelector('.shared-selector-acknowledge input') as HTMLInputElement;
            expect(ack).not.toBeNull();
            const submit = container.querySelector('.publish-state-btn-submit') as HTMLButtonElement;
            expect(submit.disabled).toBe(true);
            click(ack);
            expect(submit.disabled).toBe(false);
            click(removeSharing);
            expect(container.querySelector('.shared-selector-acknowledge')).toBeNull();
            unmount();
        });

        test('Posts set_state with remove_sharing and reports server detail', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({ detail: 'Done' }));
            const { container, onSuccess, onCancel, unmount } = setup();
            changeValue(container.querySelector('select'), 'private');
            click(container.querySelector('.shared-selector input'));
            click(container.querySelector('.shared-selector-acknowledge input'));
            click(container.querySelector('.publish-state-btn-submit'));
            await flush();
            expect(fetchMock).toHaveBeenCalledWith('/api/v1/media/user/bulk_actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': 'tok' },
                body: JSON.stringify({ action: 'set_state', media_ids: ['a', 'b'], state: 'private', remove_sharing: true }),
            });
            expect(onSuccess).toHaveBeenCalledWith('Done');
            expect(onCancel).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Uses default success message when server returns no detail', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}));
            const { container, onSuccess, unmount } = setup();
            changeValue(container.querySelector('select'), 'public');
            click(container.querySelector('.publish-state-btn-submit'));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'set_state', media_ids: ['a', 'b'], state: 'public' });
            expect(onSuccess).toHaveBeenCalledWith('Successfully updated publish state');
            unmount();
        });

        test('Reports an error when the request fails', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { container, onError, onSuccess, onCancel, unmount } = setup();
            changeValue(container.querySelector('select'), 'public');
            click(container.querySelector('.publish-state-btn-submit'));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to set publish state. Please try again.');
            expect(onSuccess).not.toHaveBeenCalled();
            expect(onCancel).not.toHaveBeenCalled();
            expect((container.querySelector('.publish-state-btn-submit') as HTMLButtonElement).textContent).toBe('Submit');
            unmount();
        });

        test('Close and cancel buttons call onCancel', () => {
            const { container, onCancel, unmount } = setup();
            click(container.querySelector('.publish-state-modal-close'));
            click(container.querySelector('.publish-state-btn-cancel'));
            expect(onCancel).toHaveBeenCalledTimes(2);
            unmount();
        });
    });
});
