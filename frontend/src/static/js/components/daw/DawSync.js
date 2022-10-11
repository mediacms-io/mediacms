import React, { useState } from "react";
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';

export default function DawSync({ ee }) {
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

    return (
      <div className="daw-sync-outer">
        <div className="daw-sync" id="daw-sync">
        <a
            href={loginUrl}
            rel="noffolow"
            className="form-textarea-wrap"
            title='Save the current work as a voice file'
        >
          <button
            type="button"
            id="btn-drop"
            className="btn btn-outline-dark"
            title="Save the current work as a voice file"
            onClick={(event) => {
              // TODO: popup to get title.
              MediaPageStore.set('media-voice-recording-title', 'A title');
              // Emit a signal to start creating voice file.
              // On `audiorenderingfinished`, the finished voice file would be saved.
              ee.emit("startaudiorendering", "wav");
            }}
          >
            <i className="fas fa-download"></i>
          </button>
        </a>
        </div>
      </div>
    );
}
