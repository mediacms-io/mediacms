import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { ItemList } from '../item-list/ItemList';

export function RelatedMedia(props) {
  const [items, setItems] = useState(updateMediaItems());
  const [mediaType, setMediaType] = useState(null);

  function onMediaDataLoad() {
    setMediaType(MediaPageStore.get('media-type'));
    setItems(updateMediaItems());
  }

  function updateMediaItems() {
    const md = MediaPageStore.get('media-data');
    return void 0 !== md && null !== md && void 0 !== md.related_media && md.related_media.length
      ? md.related_media
      : null;
  }

  useEffect(() => {
    MediaPageStore.on('loaded_media_data', onMediaDataLoad);
    return () => MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
  }, []);

  return !items || !items.length ? null : (
    <ItemList
      className="items-list-hor"
      items={props.hideFirst && ('video' === mediaType || 'audio' === mediaType) ? items.slice(1) : items}
      pageItems={PageStore.get('config-options').pages.media.related.initialSize}
      singleLinkContent={true}
      horizontalItemsOrientation={true}
      hideDate={true}
      hideViews={!PageStore.get('config-media-item').displayViews}
      hideAuthor={!PageStore.get('config-media-item').displayAuthor}
    />
  );
}

RelatedMedia.propTypes = {
  hideFirst: PropTypes.bool,
};

RelatedMedia.defaultProps = {
  hideFirst: true,
};
