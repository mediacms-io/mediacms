import React, { useState, useRef, useEffect } from 'react';
import './BulkActionsDropdown.scss';
import { translateString } from '../utils/helpers/';
import { inEmbeddedApp } from '../utils/helpers/embeddedApp';

interface BulkActionsDropdownProps {
  selectedCount: number;
  onActionSelect: (action: string) => void;
  hasContributorCourses?: boolean;
}

interface BulkAction {
  value: string;
  label: string;
  enabled: boolean;
  allowsNoSelection?: boolean;
}

interface BulkActionGroup {
  label: string;
  actions: BulkAction[];
}

export const BulkActionsDropdown: React.FC<BulkActionsDropdownProps> = ({ selectedCount, onActionSelect, hasContributorCourses = false }) => {
  const isLmsMode = inEmbeddedApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const BULK_ACTION_GROUPS: BulkActionGroup[] = [
    {
      label: translateString('Sharing'),
      actions: [
        { value: 'add-remove-coviewers', label: translateString('Share with Co-Viewers'), enabled: true },
        { value: 'add-remove-coeditors', label: translateString('Share with Co-Editors'), enabled: true },
        { value: 'add-remove-coowners', label: translateString('Share with Co-Owners'), enabled: true },
        { value: 'add-remove-category', label: isLmsMode ? translateString('Share with Course Members') : translateString('Add / Remove from Categories'), enabled: true },
      ],
    },
    {
      label: translateString('Organization'),
      actions: [
        { value: 'add-remove-playlist', label: translateString('Add to / Remove from Playlist'), enabled: true },
        { value: 'add-remove-tags', label: translateString('Add / Remove Tags'), enabled: true },
      ],
    },
    {
      label: translateString('Settings'),
      actions: [
        { value: 'enable-comments', label: translateString('Enable Comments'), enabled: true },
        { value: 'disable-comments', label: translateString('Disable Comments'), enabled: true },
        { value: 'delete-comments', label: translateString('Delete Comments'), enabled: true },
        { value: 'enable-download', label: translateString('Enable Download'), enabled: true },
        { value: 'disable-download', label: translateString('Disable Download'), enabled: true },
      ],
    },
    {
      label: translateString('Management'),
      actions: [
        { value: 'publish-state', label: translateString('Publish State'), enabled: true },
        { value: 'change-owner', label: translateString('Change Owner'), enabled: true },
        { value: 'copy-media', label: translateString('Copy Media'), enabled: true },
        { value: 'delete-media', label: translateString('Delete Media'), enabled: true },
        ...(isLmsMode && hasContributorCourses
          ? [{ value: 'course-cleanup', label: translateString('Course Cleanup'), enabled: true, allowsNoSelection: true }]
          : []),
      ],
    },
  ];

  const noSelection = selectedCount === 0;

  const displayText = noSelection
    ? translateString('Bulk Actions')
    : `${translateString('Bulk Actions')} (${selectedCount} ${translateString('selected')})`;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen]);

  const handleSelect = (action: BulkAction) => {
    const isDisabled = (!action.allowsNoSelection && noSelection) || !action.enabled;
    if (isDisabled) return;
    onActionSelect(action.value);
    setIsOpen(false);
  };

  return (
    <div className="bulk-actions-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={'bulk-actions-trigger' + (noSelection ? ' no-selection' : '') + (isOpen ? ' is-open' : '')}
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {displayText}
        <svg
          className="bulk-actions-chevron"
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="bulk-actions-menu" role="listbox">
          {BULK_ACTION_GROUPS.map((group) => (
            <div key={group.label} className="bulk-actions-group">
              <div className="bulk-actions-group-label">{group.label}</div>
              {group.actions.map((action) => {
                const isDisabled = (!action.allowsNoSelection && noSelection) || !action.enabled;
                return (
                  <button
                    key={action.value}
                    type="button"
                    className={'bulk-actions-item' + (isDisabled ? ' is-disabled' : '')}
                    onClick={() => handleSelect(action)}
                    disabled={isDisabled}
                    role="option"
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
