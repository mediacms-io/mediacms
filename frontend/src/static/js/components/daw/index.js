import React from 'react';

import WaveformPlaylist from "waveform-playlist";

import 'waveform-playlist/styles/playlist.scss';

export default class Daw extends React.PureComponent {
    constructor(props) {
        super(props);
    }

    componentDidMount() {

        var playlist = WaveformPlaylist({
            samplesPerPixel: 3000,
            waveHeight: 100,
            container: document.getElementById("playlist"),
            state: 'cursor',
            colors: {
                waveOutlineColor: '#E0EFF1',
                timeColor: 'grey',
                fadeColor: 'black'
            },
            timescale: true,
            controls: {
                show: true, //whether or not to include the track controls
                width: 150 //width of controls in pixels
            },
            barWidth: 3, // width in pixels of waveform bars.
            barGap: 1, // spacing in pixels between waveform bars.
            seekStyle: 'line',
            zoomLevels: [500, 1000, 3000, 5000]
        });

        playlist.load([
            {
                src: "https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_2MG.mp3",
                name: "example",
                start: 0,
            },
        ]).then(function () {
            // can do stuff with the playlist.
        });
    }

    render() {
        return (
            <div className="daw-container" key="daw-container">
                <span>DAW:</span>
                <div id="playlist"></div>
            </div>
        );
    }
}