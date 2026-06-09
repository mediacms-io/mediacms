import React, { useState, useEffect } from 'react';
import { PageActions } from '../../utils/actions/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { ItemList } from '../item-list/ItemList';
import { translateString } from '../../utils/helpers/';

function autoPlayMedia() {
  const dt = MediaPageStore.get('media-data');
  return dt && dt.related_media && dt.related_media.length ? dt.related_media[0] : null;
}

export function AutoPlay(props) {
  const [media, setMedia] = useState(autoPlayMedia());
  const [enabledAutoPlay, setEnabledAutoPlay] = useState(PageStore.get('media-auto-play'));

  function onKeyPress(ev) {
    if (0 === ev.keyCode) {
      PageActions.toggleMediaAutoPlay();
    }
  }

  function onUpdateMediaAutoPlay() {
    setEnabledAutoPlay(PageStore.get('media-auto-play'));
  }

  function onMediaDataLoad() {
    setMedia(autoPlayMedia());
  }

  useEffect(() => {
    MediaPageStore.on('loaded_media_data', onMediaDataLoad);
    PageStore.on('switched_media_auto_play', onUpdateMediaAutoPlay);
    return () => {
      MediaPageStore.removeListener('loaded_media_data', onMediaDataLoad);
      PageStore.removeListener('switched_media_auto_play', onUpdateMediaAutoPlay);
    };
  }, []);

  return !media ? null : (
    <div className="auto-play">
      <div className="auto-play-header">
        <div className="next-label">{translateString("Up next")}</div>
      {/*   <div className="auto-play-option">
          <label className="checkbox-label right-selectbox" tabIndex={0} onKeyPress={onKeyPress}>
          {translateString("AUTOPLAY")}
            <span className="checkbox-switcher-wrap">
              <span className="checkbox-switcher">
                <input
                  type="checkbox"
                  tabIndex={-1}
                  checked={enabledAutoPlay}
                  onChange={PageActions.toggleMediaAutoPlay}
                />
              </span>
            </span>
          </label>
        </div> */}
      </div>
      <ItemList
        className="items-list-hor"
        items={[media]}
        pageItems={1}
        maxItems={1}
        singleLinkContent={true}
        horizontalItemsOrientation={true}
        hideDate={true}
        hideViews={!PageStore.get('config-media-item').displayViews}
        hideAuthor={!PageStore.get('config-media-item').displayAuthor}
      />
    </div>
  );
}
