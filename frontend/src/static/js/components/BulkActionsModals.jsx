import React from 'react';
import { BulkActionConfirmModal } from './BulkActionConfirmModal';
import { BulkActionPermissionModal } from './BulkActionPermissionModal';
import { BulkActionPlaylistModal } from './BulkActionPlaylistModal';
import { BulkActionChangeOwnerModal } from './BulkActionChangeOwnerModal';
import { BulkActionPublishStateModal } from './BulkActionPublishStateModal';
import { BulkActionCategoryModal } from './BulkActionCategoryModal';
import { BulkActionTagModal } from './BulkActionTagModal';
import { BulkActionCourseCleanupModal } from './BulkActionCourseCleanupModal';

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

  // Course cleanup modal props
  showCourseCleanupModal,
  onCourseCleanupModalCancel,
  onCourseCleanupModalSuccess,
  onCourseCleanupModalError,

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

      <BulkActionCourseCleanupModal
        isOpen={showCourseCleanupModal}
        selectedMediaIds={selectedMediaIds}
        onCancel={onCourseCleanupModalCancel}
        onSuccess={onCourseCleanupModalSuccess}
        onError={onCourseCleanupModalError}
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
