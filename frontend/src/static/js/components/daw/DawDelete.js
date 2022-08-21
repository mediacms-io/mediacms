import React, { useState } from "react";
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';

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

    return (
      <div className="daw-delete-outer">
        <div className="daw-delete" id="daw-delete">
        <a
            href={loginUrl}
            rel="noffolow"
            className="form-textarea-wrap"
            title='Delete voices permanently'
        >
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
        </a>
        </div>
      </div>
    );
}
