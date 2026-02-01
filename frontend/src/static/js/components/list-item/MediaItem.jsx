import React from 'react';
import PropTypes from 'prop-types';
import { useMediaItem } from '../../utils/hooks/';
import { PositiveInteger, PositiveIntegerOrZero, inEmbeddedApp } from '../../utils/helpers/';
import { MediaItemThumbnailLink, itemClassname } from './includes/items/';
import { Item } from './Item';

export function MediaItem(props) {
  const type = props.type;
  const isEmbedMode = inEmbeddedApp();

  const [titleComponentOrig, descriptionComponent, thumbnailUrl, UnderThumbWrapperOrig, editMediaComponent, metaComponents, viewMediaComponent] =
    useMediaItem({ ...props, type });

  // In embed mode, override components to remove links
  const ItemTitle = ({ title }) => (
    <h3>
      <span>{title}</span>
    </h3>
  );

  const ItemMain = ({ children }) => <div className="item-main">{children}</div>;

  const titleComponent = isEmbedMode
    ? () => <ItemTitle title={props.title} />
    : titleComponentOrig;

  const UnderThumbWrapper = isEmbedMode ? ItemMain : UnderThumbWrapperOrig;

  function thumbnailComponent() {
    if (isEmbedMode) {
      // In embed mode, render thumbnail without link
      const thumbStyle = thumbnailUrl ? { backgroundImage: "url('" + thumbnailUrl + "')" } : null;
      return (
        <div
          key="item-thumb"
          className={'item-thumb' + (!thumbnailUrl ? ' no-thumb' : '')}
          style={thumbStyle}
        >
          {thumbnailUrl ? (
            <div key="item-type-icon" className="item-type-icon">
              <div></div>
            </div>
          ) : null}
        </div>
      );
    }
    return <MediaItemThumbnailLink src={thumbnailUrl} title={props.title} link={props.link} />;
  }

  const containerClassname = itemClassname(
    'item ' + type + '-item',
    props.class_name.trim(),
    props.playlistOrder === props.playlistActiveItem
  );

  const finalClassname = containerClassname +
    (props.showSelection && !isEmbedMode ? ' with-selection' : '') +
    (props.isSelected ? ' selected' : '') +
    (props.hasAnySelection || isEmbedMode ? ' has-any-selection' : '');

  const handleItemClick = (e) => {
    const isEmbedMode = inEmbeddedApp();

    // In embed mode or if there's any selection active, clicking the item should toggle selection
    if ((isEmbedMode || props.hasAnySelection) && props.onCheckboxChange) {
      // Check if clicking on the checkbox itself, edit icon, or view icon
      if (e.target.closest('.item-selection-checkbox') ||
          e.target.closest('.item-edit-icon') ||
          e.target.closest('.item-view-icon')) {
        return; // Let these elements handle their own clicks
      }

      // Prevent all other clicks and toggle selection
      e.preventDefault();
      e.stopPropagation();
      props.onCheckboxChange({ target: { checked: !props.isSelected } });
    }
  };

  return (
    <div className={finalClassname} onClick={handleItemClick}>
      <div className="item-content">
        {props.showSelection && (
          <div className="item-selection-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={props.isSelected || false}
              onChange={(e) => { props.onCheckboxChange && props.onCheckboxChange(e); }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select media"
            />
          </div>
        )}

        {!isEmbedMode && editMediaComponent()}
        {!isEmbedMode && viewMediaComponent()}

        {thumbnailComponent()}

        {isEmbedMode ? (
          <UnderThumbWrapper>
            {titleComponent()}
            {metaComponents()}
            {descriptionComponent()}
          </UnderThumbWrapper>
        ) : (
          <UnderThumbWrapper title={props.title} link={props.link}>
            {titleComponent()}
            {metaComponents()}
            {descriptionComponent()}
          </UnderThumbWrapper>
        )}
      </div>
    </div>
  );
}

MediaItem.propTypes = {
  ...Item.propTypes,
  type: PropTypes.string.isRequired,
  class_name: PropTypes.string,
  views: PositiveIntegerOrZero,
  hideViews: PropTypes.bool,
  hideDate: PropTypes.bool,
  hideAuthor: PropTypes.bool,
  author_name: PropTypes.string,
  author_link: PropTypes.string,
  playlistOrder: PositiveInteger,
  playlistActiveItem: PositiveIntegerOrZero,
  inPlaylistView: PropTypes.bool,
  hidePlaylistOrderNumber: PropTypes.bool,
};

MediaItem.defaultProps = {
  ...Item.defaultProps,
  class_name: '',
  views: 0,
  hideViews: false,
  hideDate: false,
  hideAuthor: false,
  author_name: '',
  author_link: '#',
  playlistOrder: 1,
  playlistActiveItem: 1,
  inPlaylistView: false,
  hidePlaylistOrderNumber: true,
};
