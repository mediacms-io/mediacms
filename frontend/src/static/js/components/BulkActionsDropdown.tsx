import React from 'react';
import './BulkActionsDropdown.scss';
import { translateString } from '../utils/helpers/';

interface BulkActionsDropdownProps {
  selectedCount: number;
  onActionSelect: (action: string) => void;
}

const BULK_ACTIONS = [
  { value: 'add-remove-coviewers', label: translateString('Add / Remove Co-Viewers'), enabled: true },
  { value: 'add-remove-coeditors', label: translateString('Add / Remove Co-Editors'), enabled: true },
  { value: 'add-remove-coowners', label: translateString('Add / Remove Co-Owners'), enabled: true },
  { value: 'add-remove-playlist', label: translateString('Add to / Remove from Playlist'), enabled: true },
  { value: 'add-remove-category', label: translateString('Add to / Remove from Category'), enabled: true },
  { value: 'add-remove-tags', label: translateString('Add / Remove Tags'), enabled: true },
  { value: 'enable-comments', label: translateString('Enable Comments'), enabled: true },
  { value: 'disable-comments', label: translateString('Disable Comments'), enabled: true },
  { value: 'enable-download', label: translateString('Enable Download'), enabled: true },
  { value: 'disable-download', label: translateString('Disable Download'), enabled: true },
  { value: 'publish-state', label: translateString('Publish State'), enabled: true },
  { value: 'change-owner', label: translateString('Change Owner'), enabled: true },
  { value: 'copy-media', label: translateString('Copy Media'), enabled: true },
  { value: 'delete-media', label: translateString('Delete Media'), enabled: true },
];

export const BulkActionsDropdown: React.FC<BulkActionsDropdownProps> = ({ selectedCount, onActionSelect }) => {
  const noSelection = selectedCount === 0;


  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;

    if (!value) return;

    if (noSelection) {
      event.target.value = '';
      return;
    }

    onActionSelect(value);
    // Reset dropdown after selection
    event.target.value = '';
  };

  const displayText = noSelection
    ? translateString('Bulk Actions')
    : `${translateString('Bulk Actions')} (${selectedCount} ${translateString('selected')})`;

  return (
    <div className="bulk-actions-dropdown">
      <select
        className={'bulk-actions-select' + (noSelection ? ' no-selection' : '')}
        onChange={handleChange}
        value=""
        aria-label={translateString('Bulk Actions')}
      >
        <option value="" disabled>
          {displayText}
        </option>
        {BULK_ACTIONS.map((action) => (
          <option key={action.value} value={action.value} disabled={noSelection || !action.enabled}>
            {action.label}
          </option>
        ))}
      </select>
    </div>
  );
};
