import React, { useState } from "react";
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';
import { usePopup } from '../../utils/hooks/';
import { PopupMain } from '../_shared';
import { MediaPageActions } from '../../utils/actions/';

import './DawDelete.scss';

export default function DawDelete({  }) {
  // Login link is just like:
  // `frontend/src/static/js/components/comments/Comments.jsx`
  // If user is not logged in, link to login page.
  const [loginUrl] = useState(
    !MemberContext._currentValue.is.anonymous
      ? null
      : LinksContext._currentValue.signin +
          '?next=/' +
          window.location.href.replace(SiteContext._currentValue.url, '').replace(/^\//g, '')
  );

  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  function cancelVoiceRemoval() {
    popupContentRef.current.toggle();
  }

  function proceedVoiceRemoval() {
    popupContentRef.current.toggle();
    MediaPageActions.deleteVoices();
  }

    return (
      <div className="daw-delete-outer">
        <div className="daw-delete" id="daw-delete">
        {MemberContext._currentValue.can.deleteVoice ? (
        <a
            href={loginUrl}
            rel="noffolow"
            className="form-textarea-wrap"
            title='Delete voices permanently'
        >
        <div className="voice-actions">
        <div className="voice-action remove-voice">
        <PopupTrigger contentRef={popupContentRef}>
          <button
            type="button"
            id="btn-delete"
            className="btn btn-outline-dark"
            title="Delete voices permanently"
            onClick={(event) => {
              // TODO.
            }}
          >
            <i className="fas fa-trash"></i>
          </button>
         </PopupTrigger>
         <PopupContent contentRef={popupContentRef}>
            <PopupMain>
              <div className="popup-message">
                <span className="popup-message-title">Voice delete</span>
                <span className="popup-message-main">Delete all your voices permanently?</span>
              </div>
              <hr />
              <span className="popup-message-bottom">
                <button className="button-link cancel-voice-removal" onClick={cancelVoiceRemoval}>
                  CANCEL
                </button>
                <button className="button-link proceed-voice-removal" onClick={proceedVoiceRemoval}>
                  PROCEED
                </button>
              </span>
            </PopupMain>
         </PopupContent>
         </div>
         </div>
        </a>
        ) : null}
        </div>
      </div>
    );
}
