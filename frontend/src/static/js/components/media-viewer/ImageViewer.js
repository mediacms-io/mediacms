import React, { useContext, useEffect, useState } from 'react';
import { SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';

export default function ImageViewer(props) {
  const site = useContext(SiteContext);

  let initialImage = getImageUrl();

  initialImage = initialImage ? initialImage : MediaPageStore.get('media-data').thumbnail_url;
  initialImage = initialImage ? initialImage : '';

  const [image, setImage] = useState(initialImage);

  function onImageLoad() {
    setImage(getImageUrl());
  }

  function getImageUrl() {
    const media_data = MediaPageStore.get('media-data');

    let imgUrl = 'string' === typeof media_data.poster_url ? media_data.poster_url.trim() : '';

    if ('' === imgUrl) {
      imgUrl = 'string' === typeof media_data.thumbnail_url ? media_data.thumbnail_url.trim() : '';
    }

    if ('' === imgUrl) {
      imgUrl =
        'string' === typeof MediaPageStore.get('media-original-url')
          ? MediaPageStore.get('media-original-url').trim()
          : '';
    }

    if ('' === imgUrl) {
      return '#';
    }

    return site.url + '/' + imgUrl.replace(/^\//g, '');
  }

  useEffect(() => {
    MediaPageStore.on('loaded_image_data', onImageLoad);
    return () => MediaPageStore.removeListener('loaded_image_data', onImageLoad);
  }, []);

  return !image ? null : (
    <div className="viewer-image-container">
      <img src={image} alt={MediaPageStore.get('media-data').title || null} />
    </div>
  );
}
