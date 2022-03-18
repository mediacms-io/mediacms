import React, { useRef } from 'react'

export default function DawControl({ playerInstance, ee, trimDisabled }) {

    let isLooping = false; // To detect paused or played.

    const btnCursor = useRef(null);
    const btnSelect = useRef(null);
    const btnShift = useRef(null);

    const switchState = (event) => {
        btnCursor.current.classList.remove('active');
        btnSelect.current.classList.remove('active');
        btnShift.current.classList.remove('active');
        event.target.classList.add('active');
    }

    return (
        <div className="controls-groups">
            <div className="controls-group">
                <div className="btn-group">
                    <button type="button" id="btn-record" className="btn btn-outline-primary disabled" title="Record"
                        onClick={() => {
                            ee.emit("record");
                            // Play video.
                            playerInstance.player.play();
                        }}
                    >
                        <i className="fas fa-microphone"></i>
                    </button>
                    <button type="button" id="btn-stop" className="btn btn-outline-danger" title="Stop"
                        onClick={() => {
                            ee.emit("stop");
                            // Pause video.
                            playerInstance.player.pause();
                        }}
                    >
                        <i className="fas fa-stop"></i>
                    </button>
                </div>
                <div className="btn-group">
                    <button type="button" id="btn-play" className="btn btn-outline-success" title="Play/Pause"
                        onClick={() => {
                            if (isLooping) {
                                ee.emit("pause");
                                // Pause video.
                                playerInstance.player.pause();
                            } else {
                                ee.emit("play");
                                // Play video.
                                playerInstance.player.play();
                            }

                            // Toggle play/pause.
                            isLooping = !isLooping
                        }}
                    >
                        <i className="fas fa-play"></i>
                        <i className="fas fa-pause"></i>
                    </button>
                </div>
            </div>
            <div className="controls-group">
                <div className="btn-group">
                    <button type="button" title="Zoom in" id="btn-zoom-in" className="btn btn-outline-dark"
                        onClick={() => {
                            ee.emit("zoomin");
                        }}
                    >
                        <i className="fas fa-search-plus"></i>
                    </button>
                    <button type="button" title="Zoom out" id="btn-zoom-out" className="btn btn-outline-dark"
                        onClick={() => {
                            ee.emit("zoomout");
                        }}
                    >
                        <i className="fas fa-search-minus"></i>
                    </button>
                </div>
                <div className="btn-group btn-playlist-state-group">
                    <button type="button" ref={btnCursor} className="btn btn-outline-dark active" title="Select cursor"
                        onClick={(event) => {
                            ee.emit("statechange", "cursor");
                            switchState(event);
                        }}
                    >
                        <i className="fas fa-headphones"></i>
                    </button>
                    <button type="button" ref={btnSelect} className="btn btn-outline-dark" title="Select audio region"
                        onClick={(event) => {
                            ee.emit("statechange", "select");
                            switchState(event);
                        }}
                    >
                        <i className="fas fa-italic"></i>
                    </button>
                    <button type="button" ref={btnShift} className="btn btn-outline-dark" title="Shift audio in time"
                        onClick={(event) => {
                            ee.emit("statechange", "shift");
                            switchState(event);
                        }}
                    >
                        <i className="fas fa-arrows-alt-h"></i>
                    </button>
                </div>
                <div className="btn-group btn-select-state-group">
                    <button type="button"
                        title="Keep only the selected audio region for a track"
                        className={"btn btn-outline-primary" + (trimDisabled ? " disabled" : "")}
                        onClick={() => {
                            ee.emit("trim");
                        }}>
                        Trim
                    </button>
                </div>
            </div>
            <div className="controls-group">
                <div className="btn-group">
                    <button type="button" title="Clear the playlist's tracks"
                        className="btn btn-clear btn-outline-danger"
                        onClick={() => {
                            ee.emit("clear");
                        }}
                    >
                        Clear
                    </button>
                </div>
                <div className="btn-group">
                    <button type="button" title="Download the current work as Wav file"
                        className="btn btn-download btn-outline-primary"
                        onClick={() => {
                            ee.emit("startaudiorendering", "wav");
                        }}
                    >
                        <i className="fas fa-download"></i>
                    </button>
                </div>
            </div>
        </div>
    )
}