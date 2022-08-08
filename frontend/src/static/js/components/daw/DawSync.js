import React from "react";

export default function DawSync({ ee }) {
    return (
      <div className="daw-sync-outer">
        <div className="daw-sync" id="daw-sync">
          <button
            type="button"
            id="btn-drop"
            className="btn btn-outline-primary"
            title="Save the current work as a voice file"
            onClick={(event) => {
              // Emit a signal to start creating voice file.
              // On `audiorenderingfinished`, the finished voice file would be saved.
              ee.emit("startaudiorendering", "wav");
            }}
          >
            <i className="fas fa-download"></i>
          </button>
        </div>
      </div>
    );
}
