import React from 'react';
import PropTypes from 'prop-types';
import { useMediaItem } from '../../utils/hooks/';
import { PositiveIntegerOrZero, inEmbeddedApp } from '../../utils/helpers/';
import { MediaDurationInfo } from '../../utils/classes/';
import { MediaPlaylistOptions } from '../media-playlist-options/MediaPlaylistOptions';
import { MediaItemDuration, MediaItemPlaylistIndex, itemClassname } from './includes/items/';
import { MediaItem } from './MediaItem';

export function MediaItemAudio(props) {
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

  const _MediaDurationInfo = new MediaDurationInfo();

  _MediaDurationInfo.update(props.duration);

  const duration = _MediaDurationInfo.ariaLabel();
  const durationStr = _MediaDurationInfo.toString();
  const durationISO8601 = _MediaDurationInfo.ISO8601();

  function thumbnailComponent() {
    if (isEmbedMode) {
      // In embed mode, render thumbnail without link
      return (
        <div
          key="item-thumb"
          className={'item-thumb' + (!thumbnailUrl ? ' no-thumb' : '')}
          style={!thumbnailUrl ? null : { backgroundImage: "url('" + thumbnailUrl + "')" }}
        >
          {props.inPlaylistView ? null : (
            <MediaItemDuration ariaLabel={duration} time={durationISO8601} text={durationStr} />
          )}
        </div>
      );
    }

    const attr = {
      key: 'item-thumb',
      href: props.link,
      title: props.title,
      tabIndex: '-1',
      'aria-hidden': true,
      className: 'item-thumb' + (!thumbnailUrl ? ' no-thumb' : ''),
      style: !thumbnailUrl ? null : { backgroundImage: "url('" + thumbnailUrl + "')" },
    };

    return (
      <a {...attr}>
        {props.inPlaylistView ? null : (
          <MediaItemDuration ariaLabel={duration} time={durationISO8601} text={durationStr} />
        )}
      </a>
    );
  }

  function playlistOrderNumberComponent() {
    return props.hidePlaylistOrderNumber ? null : (
      <MediaItemPlaylistIndex
        index={props.playlistOrder}
        inPlayback={props.inPlaylistView}
        activeIndex={props.playlistActiveItem}
      />
    );
  }

  function playlistOptionsComponent() {
    let mediaId = props.link.split('=')[1];
    mediaId = mediaId.split('&')[0];
    return props.hidePlaylistOptions ? null : (
      <MediaPlaylistOptions key="options" media_id={mediaId} playlist_id={props.playlist_id} />
    );
  }

  const containerClassname = itemClassname(
    'item ' + type + '-item',
    props.class_name.trim(),
    props.playlistOrder === props.playlistActiveItem
  );

  const finalClassname = containerClassname +
    (props.showSelection ? ' with-selection' : '') +
    (props.isSelected ? ' selected' : '') +
    (props.hasAnySelection || isEmbedMode ? ' has-any-selection' : '');

  const handleItemClick = (e) => {
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
      {playlistOrderNumberComponent()}

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

        {playlistOptionsComponent()}
      </div>
    </div>
  );
}

MediaItemAudio.propTypes = {
  ...MediaItem.propTypes,
  type: PropTypes.string.isRequired,
  duration: PositiveIntegerOrZero,
  hidePlaylistOptions: PropTypes.bool,
  hasMediaViewer: PropTypes.bool,
  hasMediaViewerDescr: PropTypes.bool,
  playlist_id: PropTypes.string,
};

MediaItemAudio.defaultProps = {
  ...MediaItem.defaultProps,
  type: 'audio',
  duration: 0,
  hidePlaylistOptions: true,
  hasMediaViewer: false,
  hasMediaViewerDescr: false,
};
