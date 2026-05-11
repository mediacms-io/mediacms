import React, { useState, useEffect } from 'react';
import './BulkActionPublishStateModal.scss';
import { translateString } from '../utils/helpers/';

interface BulkActionPublishStateModalProps {
  isOpen: boolean;
  selectedMediaIds: string[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  csrfToken: string;
}

const PUBLISH_STATES = [
  { value: 'public', label: translateString('Public') },
  { value: 'unlisted', label: translateString('Unlisted') },
  { value: 'private', label: translateString('Private') },
];

export const BulkActionPublishStateModal: React.FC<BulkActionPublishStateModalProps> = ({
  isOpen,
  selectedMediaIds,
  onCancel,
  onSuccess,
  onError,
  csrfToken,
}) => {
  const isLmsEmbedMode =
    sessionStorage.getItem('lms_embed_mode') === 'true' ||
    new URLSearchParams(window.location.search).get('mode') === 'lms_embed_mode';
  const availableStates = isLmsEmbedMode ? PUBLISH_STATES.filter((s) => s.value !== 'public') : PUBLISH_STATES;

  const [selectedState, setSelectedState] = useState('');
  const [removeSharing, setRemoveSharing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedState('');
      setRemoveSharing(false);
      setAcknowledged(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedState) {
      onError(translateString('Please select a publish state'));
      return;
    }
    if (removeSharing && !acknowledged) {
      onError(translateString('Please acknowledge the sharing removal'));
      return;
    }

    setIsProcessing(true);

    try {
      const body: Record<string, unknown> = {
        action: 'set_state',
        media_ids: selectedMediaIds,
        state: selectedState,
      };
      if (removeSharing) {
        body.remove_sharing = true;
      }

      const response = await fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(translateString('Failed to set publish state'));
      }

      const data = await response.json();
      onSuccess(data.detail || translateString('Successfully updated publish state'));
      onCancel();
    } catch (error) {
      console.error('Error setting publish state:', error);
      onError(translateString('Failed to set publish state. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="publish-state-modal-overlay">
      <div className="publish-state-modal">
        <div className="publish-state-modal-header">
          <h2>{translateString('Publish State')}</h2>
          <button className="publish-state-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="publish-state-modal-content">
          <div className="state-selector">
            <label htmlFor="publish-state-select">{translateString('Select publish state:')}</label>
            <select
              id="publish-state-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              disabled={isProcessing}
            >
              <option value="" disabled>
                {translateString('— select —')}
              </option>
              {availableStates.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>

          <div className="shared-selector">
              <label className="shared-selector-label">
                <input
                  type="checkbox"
                  checked={removeSharing}
                  onChange={(e) => {
                    setRemoveSharing(e.target.checked);
                    if (!e.target.checked) setAcknowledged(false);
                  }}
                  disabled={isProcessing}
                />
                {translateString('Remove Sharing')}
              </label>
              <p className="shared-selector-note shared-selector-note--warn">
                {translateString('Sharing will be removed from all selected media.')}
              </p>
              {removeSharing && (
                <label className="shared-selector-label shared-selector-acknowledge">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    disabled={isProcessing}
                  />
                  {translateString('I understand that this will remove all existing sharing for this media.')}
                </label>
              )}
            </div>
        </div>

        <div className="publish-state-modal-footer">
          <button className="publish-state-btn publish-state-btn-cancel" onClick={onCancel} disabled={isProcessing}>
            {translateString('Cancel')}
          </button>
          <button
            className="publish-state-btn publish-state-btn-submit"
            onClick={handleSubmit}
            disabled={isProcessing || !selectedState || (removeSharing && !acknowledged)}
          >
            {isProcessing ? translateString('Processing...') : translateString('Submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
