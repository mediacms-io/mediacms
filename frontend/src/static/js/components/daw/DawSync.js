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
                <button type="button" id="btn-drop" className="btn btn-outline-dark" title="Sync voice changes"
                    onClick={(event) => {
                        // Sync voices with database.
                        // Delete removed ones. Add new ones.
                        submitVoice()
                    }}
                >
                    <i className="fas fa-upload"></i>
                </button>
            </div>
        </div>
    );
}
