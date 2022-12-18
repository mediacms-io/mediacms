import React, { useEffect, useRef } from 'react';
import { usePopup } from '../../utils/hooks/';
import { PopupMain } from '../_shared';
import { MediaPageStore } from '../../utils/stores/';
import { MediaPageActions } from '../../utils/actions/';

import './DawDeletePopup.scss';

export default function DawDelete({ ee }) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  useEffect(() => {
    ee.on('removeTrackFromDatabase', function (track) {
      console.log(
        'Track to be removed from database:',
        track.friendly_token,
        track.uid,
        track.author_name,
        track.author_thumbnail_url,
        track.author_profile,
        track.logged_user
      );
      // Store this track's `uid` to identify it on database when deleting it.
      MediaPageStore.set('media-voice-deletion-uid', track.uid);
      
      // Source code of `frontend/src/static/js/components/_shared/popup/PopupTrigger.jsx`
      // indicates that click on button inside `PopupTrigger` only calls the `props.contentRef.current.toggle()`
      // so, we just call `toggle()` here:
      console.log('popupContentRef.current ==', popupContentRef.current);
      popupContentRef.current.toggle();
      console.log('Pop it up...');
    });
  }, []); // Looks like `ee` shouldn't be added to dependency list.

  function cancelVoiceRemoval() {
    popupContentRef.current.toggle();
    console.log('Cancel...');
  }

  function proceedVoiceRemoval() {
    popupContentRef.current.toggle();
    console.log('Trashing the voice...');
    // Delete voice inside server database.
    MediaPageActions.deleteVoice(MediaPageStore.get('media-voice-deletion-uid'));    
  }

  return (
    <div className="daw-delete-popup">
      <PopupTrigger contentRef={popupContentRef}>
        <button style={{ display: 'none' }}></button>
      </PopupTrigger>
      <PopupContent contentRef={popupContentRef}>
        <div className="popup-fullscreen">
          <PopupMain>
            <span className="popup-fullscreen-overlay"></span>
            <div className="popup-dialog">
              <div className="popup-message">
                <span className="popup-message-title">Voice delete</span>
                <span className="popup-message-main">Trash your voice forever?</span>
              </div>
              <hr />
              <span className="popup-message-bottom">
                <button className="button-link cancel-voice-removal" onClick={cancelVoiceRemoval}>
                  NOT SURE
                </button>
                <button className="button-link proceed-voice-removal" onClick={proceedVoiceRemoval}>
                  YES
                </button>
              </span>
            </div>
          </PopupMain>
        </div>
      </PopupContent>
    </div>
  );
}
