import React from 'react';
import PropTypes from 'prop-types';
import { BulkActionConfirmModal } from './BulkActionConfirmModal';
import { BulkActionPermissionModal } from './BulkActionPermissionModal';
import { BulkActionPlaylistModal } from './BulkActionPlaylistModal';
import { BulkActionChangeOwnerModal } from './BulkActionChangeOwnerModal';
import { BulkActionPublishStateModal } from './BulkActionPublishStateModal';
import { BulkActionCategoryModal } from './BulkActionCategoryModal';
import { BulkActionTagModal } from './BulkActionTagModal';

/**
 * Renders all bulk action modals
 * This component is reusable across different pages
 */
export function BulkActionsModals({
  // Confirm modal props
  showConfirmModal,
  confirmMessage,
  onConfirmCancel,
  onConfirmProceed,

  // Permission modal props
  showPermissionModal,
  permissionType,
  selectedMediaIds,
  onPermissionModalCancel,
  onPermissionModalSuccess,
  onPermissionModalError,

  // Playlist modal props
  showPlaylistModal,
  onPlaylistModalCancel,
  onPlaylistModalSuccess,
  onPlaylistModalError,
  username,

  // Change owner modal props
  showChangeOwnerModal,
  onChangeOwnerModalCancel,
  onChangeOwnerModalSuccess,
  onChangeOwnerModalError,

  // Publish state modal props
  showPublishStateModal,
  onPublishStateModalCancel,
  onPublishStateModalSuccess,
  onPublishStateModalError,

  // Category modal props
  showCategoryModal,
  onCategoryModalCancel,
  onCategoryModalSuccess,
  onCategoryModalError,

  // Tag modal props
  showTagModal,
  onTagModalCancel,
  onTagModalSuccess,
  onTagModalError,

  // Common props
  csrfToken,

  // Notification
  showNotification,
  notificationMessage,
  notificationType,
}) {
  return (
    <>
      <BulkActionConfirmModal
        isOpen={showConfirmModal}
        message={confirmMessage}
        onCancel={onConfirmCancel}
        onProceed={onConfirmProceed}
      />

      <BulkActionPermissionModal
        isOpen={showPermissionModal}
        permissionType={permissionType}
        selectedMediaIds={selectedMediaIds}
        onCancel={onPermissionModalCancel}
        onSuccess={onPermissionModalSuccess}
        onError={onPermissionModalError}
        csrfToken={csrfToken}
      />

      <BulkActionPlaylistModal
        isOpen={showPlaylistModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onPlaylistModalCancel}
        onSuccess={onPlaylistModalSuccess}
        onError={onPlaylistModalError}
        csrfToken={csrfToken}
        username={username}
      />

      <BulkActionChangeOwnerModal
        isOpen={showChangeOwnerModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onChangeOwnerModalCancel}
        onSuccess={onChangeOwnerModalSuccess}
        onError={onChangeOwnerModalError}
        csrfToken={csrfToken}
      />

      <BulkActionPublishStateModal
        isOpen={showPublishStateModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onPublishStateModalCancel}
        onSuccess={onPublishStateModalSuccess}
        onError={onPublishStateModalError}
        csrfToken={csrfToken}
      />

      <BulkActionCategoryModal
        isOpen={showCategoryModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onCategoryModalCancel}
        onSuccess={onCategoryModalSuccess}
        onError={onCategoryModalError}
        csrfToken={csrfToken}
      />

      <BulkActionTagModal
        isOpen={showTagModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onTagModalCancel}
        onSuccess={onTagModalSuccess}
        onError={onTagModalError}
        csrfToken={csrfToken}
      />

      {showNotification && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '260px',
            backgroundColor: notificationType === 'error' ? '#f44336' : '#4CAF50',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {notificationMessage}
        </div>
      )}
    </>
  );
}

BulkActionsModals.propTypes = {
  showConfirmModal: PropTypes.bool.isRequired,
  confirmMessage: PropTypes.string.isRequired,
  onConfirmCancel: PropTypes.func.isRequired,
  onConfirmProceed: PropTypes.func.isRequired,

  showPermissionModal: PropTypes.bool.isRequired,
  permissionType: PropTypes.oneOf(['viewer', 'editor', 'owner', null]),
  selectedMediaIds: PropTypes.array.isRequired,
  onPermissionModalCancel: PropTypes.func.isRequired,
  onPermissionModalSuccess: PropTypes.func.isRequired,
  onPermissionModalError: PropTypes.func.isRequired,

  showPlaylistModal: PropTypes.bool.isRequired,
  onPlaylistModalCancel: PropTypes.func.isRequired,
  onPlaylistModalSuccess: PropTypes.func.isRequired,
  onPlaylistModalError: PropTypes.func.isRequired,
  username: PropTypes.string,

  showChangeOwnerModal: PropTypes.bool.isRequired,
  onChangeOwnerModalCancel: PropTypes.func.isRequired,
  onChangeOwnerModalSuccess: PropTypes.func.isRequired,
  onChangeOwnerModalError: PropTypes.func.isRequired,

  showPublishStateModal: PropTypes.bool.isRequired,
  onPublishStateModalCancel: PropTypes.func.isRequired,
  onPublishStateModalSuccess: PropTypes.func.isRequired,
  onPublishStateModalError: PropTypes.func.isRequired,

  showCategoryModal: PropTypes.bool.isRequired,
  onCategoryModalCancel: PropTypes.func.isRequired,
  onCategoryModalSuccess: PropTypes.func.isRequired,
  onCategoryModalError: PropTypes.func.isRequired,

  showTagModal: PropTypes.bool.isRequired,
  onTagModalCancel: PropTypes.func.isRequired,
  onTagModalSuccess: PropTypes.func.isRequired,
  onTagModalError: PropTypes.func.isRequired,

  csrfToken: PropTypes.string.isRequired,

  showNotification: PropTypes.bool.isRequired,
  notificationMessage: PropTypes.string.isRequired,
  notificationType: PropTypes.oneOf(['success', 'error']).isRequired,
};
