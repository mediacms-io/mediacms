import React from 'react'

export default function DawTrackDrop({ ee }) {
    return (
        <div className="track-drop-outer">
            <div className="track-drop" id="track-drop"
                onDragEnter={(event) => {
                    event.preventDefault();
                    event.target.classList.add("drag-enter");
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    event.target.classList.remove("drag-enter");
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    event.target.classList.remove("drag-enter");

                    // Fix:
                    // Uncaught TypeError: Cannot read properties of undefined (reading 'dataTransfer')
                    var dropEvent = event //event.originalEvent;

                    for (var i = 0; i < dropEvent.dataTransfer.files.length; i++) {
                        ee.emit("newtrack", dropEvent.dataTransfer.files[i]);
                    }
                }}
            >
                <button type="button" id="btn-drop" className="btn btn-outline-dark" title="Add audio file(s)"
                    onClick={(event) => {
                        // To add audio files on smartphone device.
                        // By click on a button, rather than drop.
                        document.getElementById("input-drop").click()
                    }}
                >
                    <i className="fas fa-plus"></i>
                </button>
                <input type="file" id="input-drop" multiple
                    onChange={(event) => {
                        for (var i = 0; i < event.target.files.length; i++) {
                            ee.emit("newtrack", event.target.files[i]);
                        }
                    }}
                ></input>
            </div>
        </div>
    )
}