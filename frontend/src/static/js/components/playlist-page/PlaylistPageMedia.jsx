import React from 'react';
import { ItemList } from '../item-list/ItemList';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function PlaylistPageMedia(rawProps) {
  const props = applyDefaultProps(rawProps, PlaylistPageMedia.defaultPropValues);
  return (
    <ItemList
      items={props.media}
      playlistId={props.playlistId}
      hidePlaylistOptions={props.hidePlaylistOptions}
      singleLinkContent={true}
      hideDate={true}
      hideViews={true}
      hidePlaylistOrderNumber={false}
      horizontalItemsOrientation={true}
      itemsCountCallback={props.itemsCountCallback}
      itemsLoadCallback={props.itemsLoadCallback}
      pageItems={99999}
      inPlaylistPage={true}
    />
  );
}

PlaylistPageMedia.defaultPropValues = {
  hidePlaylistOptions: true,
};
