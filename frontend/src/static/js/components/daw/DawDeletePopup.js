import React, { useEffect, useRef } from 'react';
import { usePopup } from '../../utils/hooks/';
import { PopupMain } from '../_shared';

import './DawDeletePopup.scss'

export default function DawDelete({ ee }) {
  const hiddenButtonEl = useRef(null);
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  useEffect(() => {
    ee.on('removeTrackFromDatabase', function (track) {
      console.debug(
        'Track to be removed from database:',
        track.friendly_token,
        track.author_name,
        track.author_thumbnail_url,
        track.author_profile,
        track.logged_user
      );
      // Simulate a click on a hidden button, to trigger pop up.
      hiddenButtonEl.current.click();
    });
  }, []); // Looks like `ee` shouldn't be added to dependency list.

  function cancelVoiceRemoval() {
    popupContentRef.current.toggle();
  }

  function proceedVoiceRemoval() {
    popupContentRef.current.toggle();
    //MediaPageActions.deleteVoices();
    console.debug('Trashing the voice...');
  }

  return (
    <div>
      <PopupTrigger contentRef={popupContentRef}>
        <button
          ref={hiddenButtonEl}
          style={{ display: 'none' }}
          onClick={(event) => {
            // Looks like the logic here has no effect:
            event.preventDefault();
            console.debug('Poping up a popup...');
          }}
        >
          <i className="fas fa-trash"></i>
        </button>
      </PopupTrigger>
      <PopupContent contentRef={popupContentRef}>
      <div className="popup-fullscreen">
        <PopupMain>
        <span className="popup-fullscreen-overlay"></span>
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
        </PopupMain>
        </div>
      </PopupContent>
    </div>
  );
}
