import React from 'react';
import { MediaListRow } from './MediaListRow';
import { BulkActionsDropdown } from './BulkActionsDropdown';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import './MediaListWrapper.scss';

interface MediaListWrapperProps {
  title?: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
  style?: { [key: string]: any };
  children?: any;
  showBulkActions?: boolean;
  selectedCount?: number;
  totalCount?: number;
  onBulkAction?: (action: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

export const MediaListWrapper: React.FC<MediaListWrapperProps> = ({
  title,
  viewAllLink,
  viewAllText,
  className,
  style,
  children,
  showBulkActions = false,
  selectedCount = 0,
  totalCount = 0,
  onBulkAction = () => {},
  onSelectAll = () => {},
  onDeselectAll = () => {},
}) => (
  <div className={(className ? className + ' ' : '') + 'media-list-wrapper'} style={style}>
    <MediaListRow title={title} viewAllLink={viewAllLink} viewAllText={viewAllText}>
      {showBulkActions && (
        <div className="bulk-actions-container">
          <BulkActionsDropdown selectedCount={selectedCount} onActionSelect={onBulkAction} />
          <SelectAllCheckbox
            totalCount={totalCount}
            selectedCount={selectedCount}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
        </div>
      )}
      {children || null}
    </MediaListRow>
  </div>
);
