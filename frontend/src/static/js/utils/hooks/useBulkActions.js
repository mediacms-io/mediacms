import { useState } from 'react';
import { translateString } from '../helpers';

/**
 * Custom hook for managing bulk actions on media items
 * Provides state management and handlers for selecting media and executing bulk actions
 */
export function useBulkActions() {
  const [selectedMedia, setSelectedMedia] = useState(new Set());
  const [availableMediaIds, setAvailableMediaIds] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [listKey, setListKey] = useState(0);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionType, setPermissionType] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showChangeOwnerModal, setShowChangeOwnerModal] = useState(false);
  const [showPublishStateModal, setShowPublishStateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  // Get CSRF token from cookies
  const getCsrfToken = () => {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === name + '=') {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  };

  // Show notification
  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setShowNotification(true);
    setNotificationType(type);

    setTimeout(() => {
      setShowNotification(false);
    }, 5000);
  };

  // Handle media selection toggle
  const handleMediaSelection = (mediaId, isSelected) => {
    setSelectedMedia((prevState) => {
      const newSelectedMedia = new Set(prevState);
      if (isSelected) {
        newSelectedMedia.add(mediaId);
      } else {
        newSelectedMedia.delete(mediaId);
      }
      return newSelectedMedia;
    });
  };

  // Handle items update from list
  const handleItemsUpdate = (items) => {
    const mediaIds = items.map((item) => item.friendly_token || item.uid || item.id);
    setAvailableMediaIds(mediaIds);
  };

  // Select all available media
  const handleSelectAll = () => {
    setSelectedMedia(new Set(availableMediaIds));
  };

  // Deselect all media
  const handleDeselectAll = () => {
    setSelectedMedia(new Set());
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedMedia(new Set());
  };

  // Clear selection and refresh list
  const clearSelectionAndRefresh = () => {
    setSelectedMedia(new Set());
    setListKey((prev) => prev + 1);
  };

  // Handle bulk action button clicks
  const handleBulkAction = (action) => {
    const selectedCount = selectedMedia.size;

    if (selectedCount === 0) {
      return;
    }

    if (action === 'delete-media') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to delete') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'enable-comments') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to enable comments to') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'disable-comments') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to disable comments to') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'enable-download') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to enable download for') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'disable-download') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to disable download for') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'copy-media') {
      setShowConfirmModal(true);
      setPendingAction(action);
      setConfirmMessage(translateString('You are going to copy') + ` ${selectedCount} ` + translateString('media, are you sure?'));
    } else if (action === 'add-remove-coviewers') {
      setShowPermissionModal(true);
      setPermissionType('viewer');
    } else if (action === 'add-remove-coeditors') {
      setShowPermissionModal(true);
      setPermissionType('editor');
    } else if (action === 'add-remove-coowners') {
      setShowPermissionModal(true);
      setPermissionType('owner');
    } else if (action === 'add-remove-playlist') {
      setShowPlaylistModal(true);
    } else if (action === 'change-owner') {
      setShowChangeOwnerModal(true);
    } else if (action === 'publish-state') {
      setShowPublishStateModal(true);
    } else if (action === 'add-remove-category') {
      setShowCategoryModal(true);
    } else if (action === 'add-remove-tags') {
      setShowTagModal(true);
    }
  };

  // Cancel confirm modal
  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
    setConfirmMessage('');
  };

  // Proceed with confirmed action
  const handleConfirmProceed = () => {
    const action = pendingAction;
    setShowConfirmModal(false);
    setPendingAction(null);
    setConfirmMessage('');

    if (action === 'delete-media') {
      executeDeleteMedia();
    } else if (action === 'enable-comments') {
      executeEnableComments();
    } else if (action === 'disable-comments') {
      executeDisableComments();
    } else if (action === 'enable-download') {
      executeEnableDownload();
    } else if (action === 'disable-download') {
      executeDisableDownload();
    } else if (action === 'copy-media') {
      executeCopyMedia();
    }
  };

  // Execute delete media
  const executeDeleteMedia = () => {
    const selectedIds = Array.from(selectedMedia);
    const selectedCount = selectedIds.length;

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'delete_media',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to delete media');
        }
        return response.json();
      })
      .then((data) => {
        const message = selectedCount === 1
          ? translateString('The media was deleted successfully.')
          : translateString('Successfully deleted') + ` ${selectedCount} ` + translateString('media.');
        showNotificationMessage(message);
        clearSelectionAndRefresh();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to delete media. Please try again.'), 'error');
        clearSelectionAndRefresh();
      });
  };

  // Execute enable comments
  const executeEnableComments = () => {
    const selectedIds = Array.from(selectedMedia);

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'enable_comments',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to enable comments');
        }
        return response.json();
      })
      .then((data) => {
        showNotificationMessage(translateString('Successfully Enabled comments'));
        clearSelection();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to enable comments.'), 'error');
        clearSelection();
      });
  };

  // Execute disable comments
  const executeDisableComments = () => {
    const selectedIds = Array.from(selectedMedia);

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'disable_comments',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to disable comments');
        }
        return response.json();
      })
      .then((data) => {
        showNotificationMessage(translateString('Successfully Disabled comments'));
        clearSelection();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to disable comments.'), 'error');
        clearSelection();
      });
  };

  // Execute enable download
  const executeEnableDownload = () => {
    const selectedIds = Array.from(selectedMedia);

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'enable_download',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to enable download');
        }
        return response.json();
      })
      .then((data) => {
        showNotificationMessage(translateString('Successfully Enabled Download'));
        clearSelection();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to enable download.'), 'error');
        clearSelection();
      });
  };

  // Execute disable download
  const executeDisableDownload = () => {
    const selectedIds = Array.from(selectedMedia);

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'disable_download',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to disable download');
        }
        return response.json();
      })
      .then((data) => {
        showNotificationMessage(translateString('Successfully Disabled Download'));
        clearSelection();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to disable download.'), 'error');
        clearSelection();
      });
  };

  // Execute copy media
  const executeCopyMedia = () => {
    const selectedIds = Array.from(selectedMedia);

    fetch('/api/v1/media/user/bulk_actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        action: 'copy_media',
        media_ids: selectedIds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to copy media');
        }
        return response.json();
      })
      .then((data) => {
        showNotificationMessage(translateString('Successfully Copied'));
        clearSelectionAndRefresh();
      })
      .catch((error) => {
        showNotificationMessage(translateString('Failed to copy media.'), 'error');
        clearSelection();
      });
  };

  // Permission modal handlers
  const handlePermissionModalCancel = () => {
    setShowPermissionModal(false);
    setPermissionType(null);
  };

  const handlePermissionModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelection();
    setShowPermissionModal(false);
    setPermissionType(null);
  };

  const handlePermissionModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowPermissionModal(false);
    setPermissionType(null);
  };

  // Playlist modal handlers
  const handlePlaylistModalCancel = () => {
    setShowPlaylistModal(false);
  };

  const handlePlaylistModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelection();
    setShowPlaylistModal(false);
  };

  const handlePlaylistModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowPlaylistModal(false);
  };

  // Change owner modal handlers
  const handleChangeOwnerModalCancel = () => {
    setShowChangeOwnerModal(false);
  };

  const handleChangeOwnerModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelectionAndRefresh();
    setShowChangeOwnerModal(false);
  };

  const handleChangeOwnerModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowChangeOwnerModal(false);
  };

  // Publish state modal handlers
  const handlePublishStateModalCancel = () => {
    setShowPublishStateModal(false);
  };

  const handlePublishStateModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelectionAndRefresh();
    setShowPublishStateModal(false);
  };

  const handlePublishStateModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowPublishStateModal(false);
  };

  // Category modal handlers
  const handleCategoryModalCancel = () => {
    setShowCategoryModal(false);
  };

  const handleCategoryModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelection();
    setShowCategoryModal(false);
  };

  const handleCategoryModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowCategoryModal(false);
  };

  // Tag modal handlers
  const handleTagModalCancel = () => {
    setShowTagModal(false);
  };

  const handleTagModalSuccess = (message) => {
    showNotificationMessage(message);
    clearSelection();
    setShowTagModal(false);
  };

  const handleTagModalError = (message) => {
    showNotificationMessage(message, 'error');
    setShowTagModal(false);
  };

  return {
    // State
    selectedMedia,
    availableMediaIds,
    listKey,
    showConfirmModal,
    confirmMessage,
    notificationMessage,
    showNotification,
    notificationType,
    showPermissionModal,
    permissionType,
    showPlaylistModal,
    showChangeOwnerModal,
    showPublishStateModal,
    showCategoryModal,
    showTagModal,

    // Handlers
    handleMediaSelection,
    handleItemsUpdate,
    handleSelectAll,
    handleDeselectAll,
    handleBulkAction,
    handleConfirmCancel,
    handleConfirmProceed,
    handlePermissionModalCancel,
    handlePermissionModalSuccess,
    handlePermissionModalError,
    handlePlaylistModalCancel,
    handlePlaylistModalSuccess,
    handlePlaylistModalError,
    handleChangeOwnerModalCancel,
    handleChangeOwnerModalSuccess,
    handleChangeOwnerModalError,
    handlePublishStateModalCancel,
    handlePublishStateModalSuccess,
    handlePublishStateModalError,
    handleCategoryModalCancel,
    handleCategoryModalSuccess,
    handleCategoryModalError,
    handleTagModalCancel,
    handleTagModalSuccess,
    handleTagModalError,

    // Utility
    getCsrfToken,
    clearSelection,
    clearSelectionAndRefresh,
  };
}
