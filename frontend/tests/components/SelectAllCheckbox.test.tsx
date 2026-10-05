import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { SelectAllCheckbox } from '../../src/static/js/components/SelectAllCheckbox';
import { BulkActionConfirmModal } from '../../src/static/js/components/BulkActionConfirmModal';

describe('components', () => {
    describe('SelectAllCheckbox', () => {
        function setup(totalCount: number, selectedCount: number) {
            const onSelectAll = jest.fn();
            const onDeselectAll = jest.fn();
            const view = renderIntoContainer(
                <SelectAllCheckbox totalCount={totalCount} selectedCount={selectedCount} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} />
            );
            const input = view.container.querySelector('input') as HTMLInputElement;
            return { ...view, input, onSelectAll, onDeselectAll };
        }

        test('Is disabled with no items', () => {
            const { container, input, unmount } = setup(0, 0);
            expect(input.disabled).toBe(true);
            expect(container.querySelector('label')?.className).toBe('select-all-label disabled');
            expect(input.getAttribute('aria-label')).toBe('Select all media');
            unmount();
        });

        test('Selects all when nothing is selected', () => {
            const { input, onSelectAll, onDeselectAll, unmount } = setup(3, 0);
            expect(input.checked).toBe(false);
            expect(input.indeterminate).toBe(false);
            act(() => input.click());
            expect(onSelectAll).toHaveBeenCalledTimes(1);
            expect(onDeselectAll).not.toHaveBeenCalled();
            unmount();
        });

        test('Is indeterminate and deselects when some are selected', () => {
            const { input, onDeselectAll, unmount } = setup(3, 1);
            expect(input.indeterminate).toBe(true);
            expect(input.checked).toBe(false);
            act(() => input.click());
            expect(onDeselectAll).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Is checked and deselects when all are selected', () => {
            const { input, onDeselectAll, unmount } = setup(2, 2);
            expect(input.checked).toBe(true);
            expect(input.indeterminate).toBe(false);
            act(() => input.click());
            expect(onDeselectAll).toHaveBeenCalledTimes(1);
            unmount();
        });
    });

    describe('BulkActionConfirmModal', () => {
        test('Renders nothing when closed', () => {
            const { container, unmount } = renderIntoContainer(
                <BulkActionConfirmModal isOpen={false} message="m" onCancel={jest.fn()} onProceed={jest.fn()} />
            );
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Renders message and wires buttons and overlay', () => {
            const onCancel = jest.fn();
            const onProceed = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <BulkActionConfirmModal isOpen message="Delete 3 items?" onCancel={onCancel} onProceed={onProceed} />
            );
            expect(container.querySelector('h3')?.textContent).toBe('Confirm Action');
            expect(container.querySelector('p')?.textContent).toBe('Delete 3 items?');
            act(() => (container.querySelector('.bulk-action-btn-proceed') as HTMLElement).click());
            expect(onProceed).toHaveBeenCalledTimes(1);
            act(() => (container.querySelector('.bulk-action-btn-cancel') as HTMLElement).click());
            expect(onCancel).toHaveBeenCalledTimes(1);
            act(() => (container.querySelector('.bulk-action-modal-content') as HTMLElement).click());
            expect(onCancel).toHaveBeenCalledTimes(1);
            act(() => (container.querySelector('.bulk-action-modal-overlay') as HTMLElement).click());
            expect(onCancel).toHaveBeenCalledTimes(2);
            unmount();
        });
    });
});
