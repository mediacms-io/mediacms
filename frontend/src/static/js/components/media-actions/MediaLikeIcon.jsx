import React, { useState, useEffect } from 'react';
import { TextsContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';
import { formatViewsNumber } from '../../utils/helpers/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { CircleIconButton, MaterialIcon } from '../_shared/';

export function MediaLikeIcon() {
  const [likedMedia, setLikedMedia] = useState(MediaPageStore.get('user-liked-media'));
  const [likesCounter, setLikesCounter] = useState(formatViewsNumber(MediaPageStore.get('media-likes'), false));

  function updateStateValues() {
    setLikedMedia(MediaPageStore.get('user-liked-media'));
    setLikesCounter(formatViewsNumber(MediaPageStore.get('media-likes'), false));
  }

  function onCompleteMediaLike() {
    updateStateValues();
    PageActions.addNotification(TextsContext._currentValue.addToLiked, 'likedMedia');
  }

  function onCompleteMediaLikeCancel() {
    updateStateValues();
    PageActions.addNotification(TextsContext._currentValue.removeFromLiked, 'unlikedMedia');
  }

  function onFailMediaLikeRequest() {
    PageActions.addNotification('Action failed', 'likedMediaRequestFail');
  }

  function toggleLike(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    MediaPageActions[likedMedia ? 'unlikeMedia' : 'likeMedia']();
  }

  useEffect(() => {
    MediaPageStore.on('liked_media', onCompleteMediaLike);
    MediaPageStore.on('unliked_media', onCompleteMediaLikeCancel);
    MediaPageStore.on('liked_media_failed_request', onFailMediaLikeRequest);
    return () => {
      MediaPageStore.removeListener('liked_media', onCompleteMediaLike);
      MediaPageStore.removeListener('unliked_media', onCompleteMediaLikeCancel);
      MediaPageStore.removeListener('liked_media_failed_request', onFailMediaLikeRequest);
    };
  }, []);

  return (
    <div className="like">
      <button onClick={toggleLike}>
        <CircleIconButton type="span">
          <MaterialIcon type="thumb_up" />
        </CircleIconButton>
        <span className="likes-counter">{likesCounter}</span>
      </button>
    </div>
  );
}
