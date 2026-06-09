import React from 'react';
import { MediaListRow } from './MediaListRow';
import { BulkActionsDropdown } from './BulkActionsDropdown';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { CircleIconButton, MaterialIcon, PopupMain, NavigationMenuList } from './_shared';
import { LinksConsumer } from '../utils/contexts';
import { usePopup } from '../utils/hooks';
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
  hasContributorCourses?: boolean;
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
  hasContributorCourses = false,
}) => {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup() as [any, any, any];

  return (
    <div className={(className ? className + ' ' : '') + 'media-list-wrapper'} style={style}>
      <MediaListRow title={title} viewAllLink={viewAllLink} viewAllText={viewAllText}>
        {showBulkActions && (
          <LinksConsumer>
            {(links) => {
              const uploadMenuItems = [
                {
                  link: links.user.addMedia,
                  icon: 'upload',
                  text: translateString('Upload'),
                },
                {
                  link: '/record_screen',
                  icon: 'videocam',
                  text: translateString('Record'),
                },
              ];

              return (
                <div className="bulk-actions-container">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BulkActionsDropdown selectedCount={selectedCount} onActionSelect={onBulkAction} hasContributorCourses={hasContributorCourses} />
                    <SelectAllCheckbox
                      totalCount={totalCount}
                      selectedCount={selectedCount}
                      onSelectAll={onSelectAll}
                      onDeselectAll={onDeselectAll}
                    />
                  </div>
                  {showAddMediaButton && (
                    <div className="add-media-button">
                      <PopupTrigger contentRef={popupContentRef}>
                        <CircleIconButton title={translateString('Add media')}>
                          <MaterialIcon type="video_call" />
                        </CircleIconButton>
                      </PopupTrigger>
                      <PopupContent contentRef={popupContentRef}>
                        <PopupMain>
                          <NavigationMenuList items={uploadMenuItems} />
                        </PopupMain>
                      </PopupContent>
                    </div>
                  )}
                </div>
              );
            }}
          </LinksConsumer>
        )}
        {children || null}
      </MediaListRow>
    </div>
  );
};
