import React, { useState, useEffect, useRef } from 'react';
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';
import { usePopup } from '../../utils/hooks/';
import { PopupMain } from '../_shared';
import { addClassname, removeClassname } from '../../utils/helpers/';

import './DawSync.scss'

export default function DawSync({ ee }) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const nameRef = useRef(null);
  const nameInputRef = useRef(null);

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

  function onChangeNameInput() {
    removeClassname(nameRef.current, 'invalid');
  }
  function onFocusNameInput() {
    addClassname(nameRef.current, 'focused');
  }
  function onBlurNameInput() {
    removeClassname(nameRef.current, 'focused');
  }

  function onCancelCreation() {
    popupContentRef.current.toggle();
    console.log('Cancel...');
  }

  function onClickCreation() {
    popupContentRef.current.toggle();
    let title = nameInputRef.current.value.trim();

    // https://stackoverflow.com/questions/7463658/how-to-trim-a-string-to-n-chars-in-javascript#comment16678002_7463674
    // And if you want ellipses for strings exceeding the max length (probably more helpful for longer max):
    var length = 8;
    title = title.length > length ? title.substring(0, length - 3) + "..." : title.substring(0, length);

    if ('' !== title) {
      console.log('Voice title:', title);
      MediaPageStore.set('media-voice-recording-title', title);
      // Emit a signal to start creating voice file.
      // On `audiorenderingfinished`, the finished voice file would be saved.
      ee.emit('startaudiorendering', 'wav');
    } else {
      addClassname(nameRef.current, 'invalid');
    }
  }

  useEffect(() => {
    if (nameInputRef.current) {
      // To avoid: Uncaught TypeError: Cannot read properties of null (reading 'focus')
      // TODO: figure out the error cause. It should work, right?
      nameInputRef.current.focus();
    }
  }, []);

  return (
    <div className="daw-sync-outer">
      <div className="daw-sync" id="daw-sync">
        <a href={loginUrl} rel="noffolow" className="form-textarea-wrap" title="Save displayed voices as a file">
          <PopupTrigger contentRef={popupContentRef}>
            <button
              type="button"
              id="btn-drop"
              className="btn btn-outline-dark"
              title="Save displayed voices as a file"
            >
              <i className="fas fa-download"></i>
            </button>
          </PopupTrigger>
        </a>

        <PopupContent contentRef={popupContentRef}>
          <div className="popup-fullscreen">
            <PopupMain>
              <span className="popup-fullscreen-overlay"></span>
              <div className="popup-dialog">
              {/* Input form is according to: */}
              {/* `frontend/src/static/js/components/playlist-form/PlaylistCreationForm.jsx` */}
              {/* Class names are kept as before just to have the same CSS styles. */}
              <div className="playlist-form-wrap">
                <div className="playlist-form-field playlist-title" ref={nameRef}>
                  <span className="playlist-form-label">Voice title</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    placeholder="Enter voice title..."
                    onFocus={onFocusNameInput}
                    onBlur={onBlurNameInput}
                    onClick={onChangeNameInput}
                    maxLength="8"
                  />
                </div>

                <div className="playlist-form-actions">
                  <button className="cancel-btn" onClick={onCancelCreation}>
                    CANCEL
                  </button>
                  <button className="create-btn" onClick={onClickCreation}>
                    CREATE
                  </button>
                </div>
              </div>
              </div>
            </PopupMain>
          </div>
        </PopupContent>
      </div>
    </div>
  );
}
