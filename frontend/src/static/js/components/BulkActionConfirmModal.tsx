import React from 'react';
import './BulkActionConfirmModal.scss';
import { translateString } from '../utils/helpers/';

interface BulkActionConfirmModalProps {
  isOpen: boolean;
  message: string;
  onCancel: () => void;
  onProceed: () => void;
}

export const BulkActionConfirmModal: React.FC<BulkActionConfirmModalProps> = ({
  isOpen,
  message,
  onCancel,
  onProceed,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bulk-action-modal-overlay" onClick={onCancel}>
      <div className="bulk-action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bulk-action-modal-content">
          <h3>{translateString('Confirm Action')}</h3>
          <p>{message}</p>
          <div className="bulk-action-modal-buttons">
            <button className="bulk-action-btn bulk-action-btn-cancel" onClick={onCancel}>
              {translateString('Cancel')}
            </button>
            <button className="bulk-action-btn bulk-action-btn-proceed" onClick={onProceed}>
              {translateString('Confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
