import React, { useState } from "react";
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';
import { usePopup } from '../../utils/hooks/';
import { PopupMain } from '../_shared';
import { MediaPageActions } from '../../utils/actions/';

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
    // TODO: get voice_id.
    MediaPageActions.deleteVoice(voice_id);
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
        <div className="comment-actions">
        <div className="comment-action remove-comment">
        <PopupTrigger contentRef={popupContentRef}>
          <button
            type="button"
            id="btn-drop"
            className="btn btn-outline-primary"
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
                <span className="popup-message-main">Check voices to remove permanently:</span>
              </div>
              <hr />
              <span className="popup-message-bottom">
                <button className="button-link cancel-comment-removal" onClick={cancelVoiceRemoval}>
                  CANCEL
                </button>
                <button className="button-link proceed-comment-removal" onClick={proceedVoiceRemoval}>
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
