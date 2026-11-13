import React from 'react';
import { useMediaItem } from '../../utils/hooks/';
import { inSelectMediaEmbedMode } from '../../utils/helpers/';
import { MediaDurationInfo } from '../../utils/classes/';
import { MediaPlaylistOptions } from '../media-playlist-options/MediaPlaylistOptions.jsx';
import { MediaItemVideoPlayer, MediaItemDuration, MediaItemVideoPreviewer, MediaItemPlaylistIndex, itemClassname } from './includes/items/';
import { MediaItem } from './MediaItem';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function MediaItemVideo(rawProps) {
  const props = applyDefaultProps(rawProps, MediaItemVideo.defaultPropValues);
  const type = props.type;
  const isSelectMediaMode = inSelectMediaEmbedMode();

  const [titleComponentOrig, descriptionComponent, thumbnailUrl, UnderThumbWrapperOrig, editMediaComponent, metaComponents, viewMediaComponent] =
    useMediaItem({ ...props, type });
  const [portraitThumbnailUrl, setPortraitThumbnailUrl] = React.useState(null);

  // In embed mode, override components to remove links
  const ItemTitle = ({ title }) => (
    <h3>
      <span>{title}</span>
    </h3>
  );

  const ItemMain = ({ children }) => <div className="item-main">{children}</div>;

  const titleComponent = isSelectMediaMode
    ? () => <ItemTitle title={props.title} />
    : titleComponentOrig;

  const UnderThumbWrapper = isSelectMediaMode ? ItemMain : UnderThumbWrapperOrig;

  const _MediaDurationInfo = new MediaDurationInfo();

  _MediaDurationInfo.update(props.duration);

  const duration = _MediaDurationInfo.ariaLabel();
  const durationStr = _MediaDurationInfo.toString();
  const durationISO8601 = _MediaDurationInfo.ISO8601();

  function videoViewerComponent() {
    return <MediaItemVideoPlayer mediaPageLink={props.link} />;
  }

  function thumbnailComponent() {
    const className = 'item-thumb' + (!thumbnailUrl ? ' no-thumb' : '');
    const children = (
      <>
        {thumbnailUrl ? (
          <img
            key={thumbnailUrl}
            className={'item-video-thumb' + (portraitThumbnailUrl === thumbnailUrl ? ' is-portrait' : '')}
            src={thumbnailUrl}
            alt=""
            onLoad={({ currentTarget }) => {
              setPortraitThumbnailUrl(currentTarget.naturalHeight > currentTarget.naturalWidth ? thumbnailUrl : null);
            }}
          />
        ) : null}
        {props.inPlaylistView ? null : (
          <MediaItemDuration ariaLabel={duration} time={durationISO8601} text={durationStr} />
        )}
        {props.inPlaylistView || props.inPlaylistPage ? null : (
          <MediaItemVideoPreviewer url={props.preview_thumbnail} />
        )}
      </>
    );

    if (isSelectMediaMode) {
      return <div key="item-thumb" className={className}>{children}</div>;
    }

    return (
      <a key="item-thumb" href={props.link} title={props.title} tabIndex={-1} aria-hidden="true" className={className}>
        {children}
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
    (props.hasAnySelection || isSelectMediaMode ? ' has-any-selection' : '');

  const handleItemClick = (e) => {
    // In select media mode or if there's any selection active, clicking the item should toggle selection
    if ((isSelectMediaMode || props.hasAnySelection) && props.onCheckboxChange) {
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

        {!isSelectMediaMode && editMediaComponent()}
        {!isSelectMediaMode && viewMediaComponent()}

        {props.hasMediaViewer ? videoViewerComponent() : thumbnailComponent()}

        {isSelectMediaMode ? (
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

MediaItemVideo.defaultPropValues = {
  ...MediaItem.defaultPropValues,
  type: 'video',
  duration: 0,
  hidePlaylistOptions: true,
  hasMediaViewer: false,
  hasMediaViewerDescr: false,
};
