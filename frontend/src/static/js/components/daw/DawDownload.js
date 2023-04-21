import React from 'react'

import { MediaPageStore } from '../../utils/stores/';

import './DawDownload.css';

export default function DawDownload({ ee, playerInstance }) {

    function encodeVideoWithVoices() {
        const playlist = MediaPageStore.get('waveform-playlist');
        if (playlist) {
            const info = playlist.getInfo();
            console.log('playlist.getInfo()', info);
            const voices = info.tracks;
        }
    }

    return (
        <div className="daw-download-outer">
            <div className="daw-download" id="daw-download">
                <button type="button" className="btn btn-outline-dark" title="Download video + displayed voices"
                    onClick={(event) => {
                        console.log('event: ', event)
                        encodeVideoWithVoices()
                    }}
                >
                    <i className="fas fa-download"></i>
                </button>
            </div>
        </div>
    )
}
