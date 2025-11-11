import React, { useState, useEffect } from 'react';
import './BulkActionChangeOwnerModal.scss';
import { translateString } from '../utils/helpers/';

interface User {
  name: string;
  username: string;
  email?: string;
}

interface BulkActionChangeOwnerModalProps {
  isOpen: boolean;
  selectedMediaIds: string[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  csrfToken: string;
}

export const BulkActionChangeOwnerModal: React.FC<BulkActionChangeOwnerModalProps> = ({
  isOpen,
  selectedMediaIds,
  onCancel,
  onSuccess,
  onError,
  csrfToken,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSearchTerm('');
      setSearchResults([]);
      setSelectedUser(null);
    }
  }, [isOpen]);

  const searchUsers = async (name: string) => {
    if (!name.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/v1/users?name=${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(translateString('Failed to search users'));
      }

      const data = await response.json();
      setSearchResults(data.results || data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchUsers(value);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchTerm(user.name + ' - ' + (user.email || user.username));
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      onError(translateString('Please select a user'));
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          action: 'change_owner',
          media_ids: selectedMediaIds,
          owner: selectedUser.username,
        }),
      });

      if (!response.ok) {
        throw new Error(translateString('Failed to change owner'));
      }

      const data = await response.json();
      onSuccess(data.detail || translateString('Successfully changed owner'));
      onCancel();
    } catch (error) {
      console.error('Error changing owner:', error);
      onError(translateString('Failed to change owner. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="change-owner-modal-overlay">
      <div className="change-owner-modal">
        <div className="change-owner-modal-header">
          <h2>{translateString('Select Owner')}</h2>
          <button className="change-owner-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="change-owner-modal-content">
          <div className="search-box-wrapper">
            <div className="search-box">
              <input
                type="text"
                placeholder={translateString('Search for user...')}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.slice(0, 10).map((user) => (
                  <div
                    key={user.username}
                    className="search-result-item"
                    onClick={() => handleUserSelect(user)}
                  >
                    {user.name} - {user.email || user.username}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="selected-user">
              <span>{translateString('Selected')}: {selectedUser.name} - {selectedUser.email || selectedUser.username}</span>
            </div>
          )}
        </div>

        <div className="change-owner-modal-footer">
          <button className="change-owner-btn change-owner-btn-cancel" onClick={onCancel} disabled={isProcessing}>
            {translateString('Cancel')}
          </button>
          <button
            className="change-owner-btn change-owner-btn-submit"
            onClick={handleSubmit}
            disabled={isProcessing || !selectedUser}
          >
            {isProcessing ? translateString('Processing...') : translateString('Submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
