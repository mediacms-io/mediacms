import React from 'react';
import { MediaListRow } from './MediaListRow';
import { BulkActionsDropdown } from './BulkActionsDropdown';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { CircleIconButton, MaterialIcon } from './_shared';
import { LinksConsumer } from '../utils/contexts';
import { translateString } from '../utils/helpers/';
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
  showAddMediaButton?: boolean;
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
  showAddMediaButton = false,
}) => (
  <div className={(className ? className + ' ' : '') + 'media-list-wrapper'} style={style}>
    <MediaListRow title={title} viewAllLink={viewAllLink} viewAllText={viewAllText}>
      {showBulkActions && (
        <LinksConsumer>
          {(links) => (
            <div className="bulk-actions-container">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BulkActionsDropdown selectedCount={selectedCount} onActionSelect={onBulkAction} />
                <SelectAllCheckbox
                  totalCount={totalCount}
                  selectedCount={selectedCount}
                  onSelectAll={onSelectAll}
                  onDeselectAll={onDeselectAll}
                />
              </div>
              {showAddMediaButton && (
                <div className="add-media-button">
                  <a href={links.user.addMedia} title={translateString('Add media')}>
                    <CircleIconButton>
                      <MaterialIcon type="video_call" />
                    </CircleIconButton>
                  </a>
                </div>
              )}
            </div>
          )}
        </LinksConsumer>
      )}
      {children || null}
    </MediaListRow>
  </div>
);
