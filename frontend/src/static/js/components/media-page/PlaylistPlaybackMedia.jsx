import React from 'react';
import PropTypes from 'prop-types';
import { PositiveIntegerOrZero } from '../../utils/helpers/';
import { ItemList } from '../item-list/ItemList';

export function PlaylistPlaybackMedia(props) {
  return (
    <ItemList
      className={'items-list-hor'}
      pageItems={9999}
      maxItems={9999}
      items={props.items}
      hideDate={true}
      hideViews={true}
      hidePlaylistOrderNumber={false}
      horizontalItemsOrientation={true}
      inPlaylistView={true}
      singleLinkContent={true}
      playlistActiveItem={props.playlistActiveItem}
    />
  );
}

PlaylistPlaybackMedia.propTypes = {
  items: PropTypes.array.isRequired,
  playlistActiveItem: PositiveIntegerOrZero,
};

PlaylistPlaybackMedia.defaultProps = {
  playlistActiveItem: 1,
};
