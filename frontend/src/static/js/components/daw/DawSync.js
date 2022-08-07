import React, { useState } from "react";
import { PageActions, MediaPageActions } from '../../utils/actions/';

export default function DawSync({ ee }) {

    const [madeChanges, setMadeChanges] = useState(false);

    function onVoiceSubmit() {
        setMadeChanges(false);
    }

    function onVoiceSubmitFail() {
        setMadeChanges(false);
    }

    function submitVoice() {
        if (!madeChanges) {
            return;
        }
        MediaPageActions.submitVoice(val);
    }

    return (
      <div className="daw-sync-outer">
        <div className="daw-sync" id="daw-sync">
          <button
            type="button"
            id="btn-drop"
            className="btn btn-outline-dark"
            title="Submit or upload the current work as a voice file"
            onClick={(event) => {
              // Sync voices with database.
              // Delete removed ones. Add new ones.
              submitVoice();
            }}
          >
            <svg
              width="96"
              height="96"
              version="1.1"
              viewBox="0 0 96 96"
            >
              <g fill="none" stroke="#422ca6" stroke-linecap="round" stroke-linejoin="round" stroke-width="4.5">
                <path d="m33.286 14.25 7.1558 12.11 14.587 6.0549-7.431 11.009 0.55044 4.6788-17.889 5.5045" />
                <path d="m19.25 31.589c6.6053 5.2292 12.66-3.5779 12.66-3.5779" />
                <path d="m46.222 69.019c-17.064-3.5779-15.688-15.963-15.688-15.963" />
                <path d="m55.579 53.607c9.6328 10.183 0.82567 15.963 0.82567 15.963" />
                <path d="m61.359 47.827c15.688 19.816 0.82567 29.999 0.82567 29.999" />
                <path d="m68.24 41.497c19.541 26.146 0.27522 41.559 0.27522 41.559" />
              </g>
            </svg>
          </button>
        </div>
      </div>
    );
}
