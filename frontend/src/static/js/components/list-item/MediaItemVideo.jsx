import React from 'react';
import PropTypes from 'prop-types';
import { useMediaItem } from '../../utils/hooks/';
import { PositiveIntegerOrZero } from '../../utils/helpers/';
import { MediaDurationInfo } from '../../utils/classes/';
import { MediaPlaylistOptions } from '../media-playlist-options/MediaPlaylistOptions.jsx';
import { MediaItemVideoPlayer, MediaItemDuration, MediaItemVideoPreviewer, MediaItemPlaylistIndex, itemClassname } from './includes/items/';
import { MediaItem } from './MediaItem';

export function MediaItemVideo(props) {
  const type = props.type;

  const [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper, editMediaComponent, metaComponents] =
    useMediaItem({ ...props, type });

  const _MediaDurationInfo = new MediaDurationInfo();

  _MediaDurationInfo.update(props.duration);

  const duration = _MediaDurationInfo.ariaLabel();
  const durationStr = _MediaDurationInfo.toString();
  const durationISO8601 = _MediaDurationInfo.ISO8601();

  function videoViewerComponent() {
    return <MediaItemVideoPlayer mediaPageLink={props.link} />;
  }

  function thumbnailComponent() {
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
        {props.inPlaylistView || props.inPlaylistPage ? null : (
          <MediaItemVideoPreviewer url={props.preview_thumbnail} />
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

  return (
    <div className={containerClassname}>
      {playlistOrderNumberComponent()}

      <div className="item-content">
        {editMediaComponent()}

        {props.hasMediaViewer ? videoViewerComponent() : thumbnailComponent()}

        <UnderThumbWrapper title={props.title} link={props.link}>
          {titleComponent()}
          {metaComponents()}
          {descriptionComponent()}
        </UnderThumbWrapper>
      </div>

      {playlistOptionsComponent()}
    </div>
  );
}

MediaItemVideo.propTypes = {
  ...MediaItem.propTypes,
  type: PropTypes.string.isRequired,
  duration: PositiveIntegerOrZero,
  hidePlaylistOptions: PropTypes.bool,
  hasMediaViewer: PropTypes.bool,
  hasMediaViewerDescr: PropTypes.bool,
  playlist_id: PropTypes.string,
};

MediaItemVideo.defaultProps = {
  ...MediaItem.defaultProps,
  type: 'video',
  duration: 0,
  hidePlaylistOptions: true,
  hasMediaViewer: false,
  hasMediaViewerDescr: false,
};
