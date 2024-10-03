import React, { useState } from 'react';
import { usePopup } from '../../utils/hooks/';
import { CircleIconButton, MaterialIcon, NavigationContentApp, PopupMain } from '../_shared/';
import { MediaShareEmbed } from './MediaShareEmbed';
import { MediaShareOptions } from './MediaShareOptions';
import { translateString } from '../../utils/helpers/';

function mediaSharePopupPages() {
  return {
    shareOptions: (
      <div className="popup-fullscreen">
        <PopupMain>
          <span className="popup-fullscreen-overlay"></span>
          <MediaShareOptions />
        </PopupMain>
      </div>
    ),
  };
}

function videoSharePopupPages(onTriggerPopupClose) {
  return {
    ...mediaSharePopupPages(),
    shareEmbed: (
      <div className="popup-fullscreen share-embed-popup">
        <PopupMain>
          <span className="popup-fullscreen-overlay"></span>
          <MediaShareEmbed triggerPopupClose={onTriggerPopupClose} />
        </PopupMain>
      </div>
    ),
  };
}

export function MediaShareButton(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [popupCurrentPage, setPopupCurrentPage] = useState('shareOptions');

  function triggerPopupClose() {
    popupContentRef.current.toggle();
  }

  function onPopupPageChange(newPage) {
    setPopupCurrentPage(newPage);
  }
  function onPopupHide() {
    setPopupCurrentPage('shareOptions');
  }

  return (
    <div className="share">
      <PopupTrigger contentRef={popupContentRef}>
        <button>
          <CircleIconButton type="span">
            <MaterialIcon type="share" />
          </CircleIconButton>
          <span>{translateString("SHARE")}</span>
        </button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef} hideCallback={onPopupHide}>
        <NavigationContentApp
          initPage={popupCurrentPage}
          pageChangeSelector={'.change-page'}
          pageIdSelectorAttr={'data-page-id'}
          pages={props.isVideo ? videoSharePopupPages(triggerPopupClose) : mediaSharePopupPages()}
          focusFirstItemOnPageChange={false}
          pageChangeCallback={onPopupPageChange}
        />
      </PopupContent>
    </div>
  );
}
