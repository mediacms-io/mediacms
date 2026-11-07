import React from 'react';
import { ItemList } from '../item-list/ItemList';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function PlaylistPlaybackMedia(rawProps) {
  const props = applyDefaultProps(rawProps, PlaylistPlaybackMedia.defaultPropValues);
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

PlaylistPlaybackMedia.defaultPropValues = {
  playlistActiveItem: 1,
};
