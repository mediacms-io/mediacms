import React from 'react';
import { renderIntoContainer } from '../_support/render';
import { click } from '../_support/compD_dom';
import { BulkActionsModals } from '../../src/static/js/components/BulkActionsModals';

function baseProps(overrides: { [key: string]: any } = {}) {
    const fn = () => jest.fn();
    return {
        showConfirmModal: false,
        confirmMessage: 'Sure?',
        onConfirmCancel: fn(),
        onConfirmProceed: fn(),
        showPermissionModal: false,
        permissionType: null,
        selectedMediaIds: [],
        onPermissionModalCancel: fn(),
        onPermissionModalSuccess: fn(),
        onPermissionModalError: fn(),
        showPlaylistModal: false,
        onPlaylistModalCancel: fn(),
        onPlaylistModalSuccess: fn(),
        onPlaylistModalError: fn(),
        username: 'john',
        showChangeOwnerModal: false,
        onChangeOwnerModalCancel: fn(),
        onChangeOwnerModalSuccess: fn(),
        onChangeOwnerModalError: fn(),
        showPublishStateModal: false,
        onPublishStateModalCancel: fn(),
        onPublishStateModalSuccess: fn(),
        onPublishStateModalError: fn(),
        showCategoryModal: false,
        onCategoryModalCancel: fn(),
        onCategoryModalSuccess: fn(),
        onCategoryModalError: fn(),
        showTagModal: false,
        onTagModalCancel: fn(),
        onTagModalSuccess: fn(),
        onTagModalError: fn(),
        showCourseCleanupModal: false,
        onCourseCleanupModalCancel: fn(),
        onCourseCleanupModalSuccess: fn(),
        onCourseCleanupModalError: fn(),
        csrfToken: 'tok',
        showNotification: false,
        notificationMessage: '',
        notificationType: 'success',
        ...overrides,
    } as any;
}

describe('components', () => {
    describe('BulkActionsModals', () => {
        test('Renders nothing when every modal is closed', () => {
            const { container, unmount } = renderIntoContainer(<BulkActionsModals {...baseProps()} />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Renders the confirm modal wired to its callbacks', () => {
            const props = baseProps({ showConfirmModal: true });
            const { container, unmount } = renderIntoContainer(<BulkActionsModals {...props} />);
            expect(container.querySelector('.bulk-action-modal p')?.textContent).toBe('Sure?');
            click(container.querySelector('.bulk-action-btn-proceed'));
            expect(props.onConfirmProceed).toHaveBeenCalled();
            unmount();
        });

        test('Renders the publish state modal wired to its cancel callback', () => {
            const props = baseProps({ showPublishStateModal: true });
            const { container, unmount } = renderIntoContainer(<BulkActionsModals {...props} />);
            click(container.querySelector('.publish-state-modal-close'));
            expect(props.onPublishStateModalCancel).toHaveBeenCalled();
            unmount();
        });

        test.each([
            ['success', 'rgb(76, 175, 80)'],
            ['error', 'rgb(244, 67, 54)'],
        ])('Shows %s notification with matching color', (notificationType, color) => {
            const { container, unmount } = renderIntoContainer(
                <BulkActionsModals {...baseProps({ showNotification: true, notificationMessage: 'Saved', notificationType })} />
            );
            const note = container.firstElementChild as HTMLElement;
            expect(note.textContent).toBe('Saved');
            expect(note.style.backgroundColor).toBe(color);
            unmount();
        });
    });
});
