import React, { useState, useEffect } from 'react';
import './BulkActionPermissionModal.scss';
import { translateString } from '../utils/helpers/';

interface User {
  name: string;
  username: string;
  email?: string;
}

interface BulkActionPermissionModalProps {
  isOpen: boolean;
  permissionType: 'viewer' | 'editor' | 'owner' | null;
  selectedMediaIds: string[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  csrfToken: string;
}

export const BulkActionPermissionModal: React.FC<BulkActionPermissionModalProps> = ({
  isOpen,
  permissionType,
  selectedMediaIds,
  onCancel,
  onSuccess,
  onError,
  csrfToken,
}) => {
  const [existingUsers, setExistingUsers] = useState<string[]>([]);
  const [existingSearchTerm, setExistingSearchTerm] = useState('');
  const [usersToAdd, setUsersToAdd] = useState<Array<{ username: string; display: string }>>([]);
  const [usersToRemove, setUsersToRemove] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && permissionType && selectedMediaIds.length > 0) {
      fetchExistingUsers();
    } else {
      // Reset state when modal closes
      setExistingUsers([]);
      setExistingSearchTerm('');
      setUsersToAdd([]);
      setUsersToRemove([]);
      setSearchResults([]);
      setAddSearchTerm('');
    }
  }, [isOpen, permissionType, selectedMediaIds]);

  const fetchExistingUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          action: 'get_ownership',
          media_ids: selectedMediaIds,
          ownership_type: permissionType,
        }),
      });

      if (!response.ok) {
        throw new Error(translateString('Failed to fetch existing users'));
      }

      const data = await response.json();
      setExistingUsers(data.results || []);
    } catch (error) {
      console.error('Error fetching existing users:', error);
      onError(translateString('Failed to load existing permissions'));
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (name: string) => {
    if (!name.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/v1/users?name=${encodeURIComponent(name)}&exclude_self=True`);
      if (!response.ok) {
        throw new Error(translateString('Failed to search users'));
      }

      const data = await response.json();
      // API returns paginated response with results array
      const users = data.results || [];
      setSearchResults(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    }
  };

  const handleAddSearchChange = (value: string) => {
    setAddSearchTerm(value);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Only search if 3 or more characters
    if (value.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchUsers(value);
    }, 300);

    setSearchTimeout(timeout);
  };

  const addUserToList = (username: string, name: string, email?: string) => {
    const userDisplay = `${name} - ${email || username}`;
    if (!usersToAdd.some(u => u.username === username) && !existingUsers.includes(userDisplay)) {
      setUsersToAdd([...usersToAdd, { username, display: userDisplay }]);
      setAddSearchTerm('');
      setSearchResults([]);
    }
  };

  const removeUserFromAddList = (username: string) => {
    setUsersToAdd(usersToAdd.filter((u) => u.username !== username));
  };

  const markUserForRemoval = (user: string) => {
    if (!usersToRemove.includes(user)) {
      setUsersToRemove([...usersToRemove, user]);
    }
  };

  const unmarkUserForRemoval = (user: string) => {
    setUsersToRemove(usersToRemove.filter((u) => u !== user));
  };

  const extractUsername = (userDisplay: string): string => {
    // For existing users from API, extract username from "Name - username/email" format
    // Note: This assumes the username is after the last ' - ' separator
    const parts = userDisplay.split(' - ');
    return parts.length > 1 ? parts[parts.length - 1] : userDisplay;
  };

  const handleProceed = async () => {
    setIsProcessing(true);

    try {
      // First, add users if any
      if (usersToAdd.length > 0) {
        const usernamesToAdd = usersToAdd.map(u => u.username);
        const addResponse = await fetch('/api/v1/media/user/bulk_actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({
            action: 'set_ownership',
            media_ids: selectedMediaIds,
            ownership_type: permissionType,
            users: usernamesToAdd,
          }),
        });

        if (!addResponse.ok) {
          throw new Error(translateString('Failed to add users'));
        }
      }

      // Then, remove users if any
      if (usersToRemove.length > 0) {
        const usernamesToRemove = usersToRemove.map(extractUsername);
        const removeResponse = await fetch('/api/v1/media/user/bulk_actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({
            action: 'remove_ownership',
            media_ids: selectedMediaIds,
            ownership_type: permissionType,
            users: usernamesToRemove,
          }),
        });

        if (!removeResponse.ok) {
          throw new Error(translateString('Failed to remove users'));
        }
      }

      const permissionLabel = permissionType === 'viewer' ? translateString('Co-Viewers') : permissionType === 'editor' ? translateString('Co-Editors') : translateString('Co-Owners');
      onSuccess(`${translateString('Successfully updated')} ${permissionLabel}`);
      onCancel();
    } catch (error) {
      console.error('Error processing permissions:', error);
      onError(translateString('Failed to update permissions. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredExistingUsers = existingUsers.filter((user) =>
    user.toLowerCase().includes(existingSearchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  const permissionLabel = permissionType === 'viewer' ? translateString('Co-Viewers') : permissionType === 'editor' ? translateString('Co-Editors') : translateString('Co-Owners');

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal">
        <div className="permission-modal-header">
          <h2>{translateString('Manage')} {permissionLabel}</h2>
          <button className="permission-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="permission-modal-content">
          <div className="permission-panel">
            <h3>{translateString('Users')}</h3>
            <div className="search-box-wrapper">
              <div className="search-box">
                <input
                  type="text"
                  placeholder={translateString('Search users to add (min 3 characters)...')}
                  value={addSearchTerm}
                  onChange={(e) => handleAddSearchChange(e.target.value)}
                />
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.slice(0, 10).map((user) => (
                    <div
                      key={user.username}
                      className="search-result-item"
                      onClick={() => addUserToList(user.username, user.name, user.email)}
                    >
                      {user.name} - {user.email || user.username}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="user-list">
              {usersToAdd.length === 0 ? (
                <div className="empty-message">{translateString('No users to add')}</div>
              ) : (
                usersToAdd.map((user) => (
                  <div key={user.username} className="user-item">
                    <span>{user.display}</span>
                    <button className="remove-btn" onClick={() => removeUserFromAddList(user.username)}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="permission-panel">
            <h3>
              {permissionType === 'viewer' ? translateString('Existing co-viewers') : permissionType === 'editor' ? translateString('Existing co-editors') : translateString('Existing co-owners')}
              {selectedMediaIds.length > 1 && (
                <span className="info-tooltip" title={translateString('The intersection of users in the selected media is shown')}>
                  ?
                </span>
              )}
            </h3>
            <div className="search-box">
              <input
                type="text"
                placeholder={translateString('Filter existing users...')}
                value={existingSearchTerm}
                onChange={(e) => setExistingSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="loading-message">{translateString('Loading existing users...')}</div>
            ) : (
              <div className="user-list">
                {filteredExistingUsers.length === 0 ? (
                  <div className="empty-message">{translateString('No existing')} {permissionLabel.toLowerCase()}</div>
                ) : (
                  filteredExistingUsers.map((user) => {
                    const isMarkedForRemoval = usersToRemove.includes(user);
                    return (
                      <div key={user} className={`user-item ${isMarkedForRemoval ? 'marked-for-removal' : ''}`}>
                        <span>{user}</span>
                        <button
                          className="remove-btn"
                          onClick={() => (isMarkedForRemoval ? unmarkUserForRemoval(user) : markUserForRemoval(user))}
                          title={isMarkedForRemoval ? translateString('Undo removal') : translateString('Remove user')}
                        >
                          {isMarkedForRemoval ? '↺' : '×'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="permission-modal-footer">
          <button className="permission-btn permission-btn-cancel" onClick={onCancel} disabled={isProcessing}>
            {translateString('Cancel')}
          </button>
          <button
            className="permission-btn permission-btn-proceed"
            onClick={handleProceed}
            disabled={isProcessing || (usersToAdd.length === 0 && usersToRemove.length === 0)}
          >
            {isProcessing ? translateString('Processing...') : translateString('Proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
