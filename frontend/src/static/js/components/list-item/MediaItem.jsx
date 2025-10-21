import React from 'react';
import PropTypes from 'prop-types';
import { useMediaItem } from '../../utils/hooks/';
import { PositiveInteger, PositiveIntegerOrZero } from '../../utils/helpers/';
import { MediaItemThumbnailLink, itemClassname } from './includes/items/';
import { Item } from './Item';

export function MediaItem(props) {
  const type = props.type;

  const [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper, editMediaComponent, metaComponents, viewMediaComponent] =
    useMediaItem({ ...props, type });


  function thumbnailComponent() {
    return <MediaItemThumbnailLink src={thumbnailUrl} title={props.title} link={props.link} />;
  }

  const containerClassname = itemClassname(
    'item ' + type + '-item',
    props.class_name.trim(),
    props.playlistOrder === props.playlistActiveItem
  );

  const finalClassname = containerClassname +
    (props.showSelection ? ' with-selection' : '') +
    (props.isSelected ? ' selected' : '') +
    (props.hasAnySelection ? ' has-any-selection' : '');

  return (
    <div className={finalClassname}>
      <div className="item-content">
        {props.showSelection && (
          <div className="item-selection-checkbox">
            <input
              type="checkbox"
              checked={props.isSelected || false}
              onChange={(e) => { props.onCheckboxChange && props.onCheckboxChange(e); }}
              aria-label="Select media"
            />
          </div>
        )}

        {editMediaComponent()}
        {viewMediaComponent()}

        {thumbnailComponent()}

        <UnderThumbWrapper title={props.title} link={props.link}>
          {titleComponent()}
          {metaComponents()}
          {descriptionComponent()}
        </UnderThumbWrapper>
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
