import React from 'react'

import { MediaPageStore } from '../../utils/stores/';

import './DawDownload.css';

export default function DawDownload({ ee, playerInstance }) {
    ee.on("inforesponse", (info)=> {
        console.log('playlist info', info)
    })

    return (
        <div className="daw-download-outer">
            <div className="daw-download" id="daw-download">
                <button type="button" className="btn btn-outline-dark" title="Download video + displayed voices"
                    onClick={(event) => {
                        console.log('event: ', event)
                        ee.emit("inforequest")
                        const playlist = MediaPageStore.get('waveform-playlist');
                        console.log('playlist.getInfo()', playlist.getInfo())
                    }}
                >
                    <i className="fas fa-download"></i>
                </button>
            </div>
        </div>
    )
}
