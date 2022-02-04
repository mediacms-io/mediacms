import React, { useState, useEffect } from 'react';
import { TextsContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';
import { formatViewsNumber } from '../../utils/helpers/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { CircleIconButton, MaterialIcon } from '../_shared/';

export function MediaDislikeIcon() {
  const [dislikedMedia, setDislikedMedia] = useState(MediaPageStore.get('user-disliked-media'));
  const [dislikesCounter, setDislikesCounter] = useState(formatViewsNumber(MediaPageStore.get('media-dislikes'), false));

  function updateStateValues() {
    setDislikedMedia(MediaPageStore.get('user-disliked-media'));
    setDislikesCounter(formatViewsNumber(MediaPageStore.get('media-dislikes'), false));
  }

  function onCompleteMediaDislike() {
    updateStateValues();
    PageActions.addNotification(TextsContext._currentValue.messages.addToDisliked, 'mediaDislike');
  }

  function onCompleteMediaDislikeCancel() {
    updateStateValues();
    PageActions.addNotification(TextsContext._currentValue.messages.removeFromDisliked, 'cancelMediaDislike');
  }

  function onFailMediaDislikeRequest() {
    PageActions.addNotification('Action failed', 'mediaDislikeRequestFail');
  }

  function toggleDislike(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    MediaPageActions[dislikedMedia ? 'undislikeMedia' : 'dislikeMedia']();
  }

  useEffect(() => {
    MediaPageStore.on('disliked_media', onCompleteMediaDislike);
    MediaPageStore.on('undisliked_media', onCompleteMediaDislikeCancel);
    MediaPageStore.on('disliked_media_failed_request', onFailMediaDislikeRequest);
    return () => {
      MediaPageStore.removeListener('disliked_media', onCompleteMediaDislike);
      MediaPageStore.removeListener('undisliked_media', onCompleteMediaDislikeCancel);
      MediaPageStore.removeListener('disliked_media_failed_request', onFailMediaDislikeRequest);
    };
  }, []);

  return (
    <div className="like">
      <button onClick={toggleDislike}>
        <CircleIconButton type="span">
          <MaterialIcon type="thumb_down" />
        </CircleIconButton>
        <span className="dislikes-counter">{dislikesCounter}</span>
      </button>
    </div>
  );
}
