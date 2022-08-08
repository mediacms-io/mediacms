import React, { useCallback, useState, useRef, useEffect } from "react";
import Script from "next/script";
import EventEmitter from "events";
import WaveformPlaylist from "waveform-playlist";
import { saveAs } from "file-saver";
import { MediaPageStore } from '../../utils/stores/';
import { MediaPageActions } from '../../utils/actions/';

import 'waveform-playlist/styles/playlist.scss';

import '../daw/style.css'
import '../daw/responsive.css'

// For extra buttons.
import 'bootstrap/dist/css/bootstrap.min.css';

import DawVideoPreview from './DawVideoPreview'
import DawTrackDrop from "./DawTrackDrop";
import DawControl from "./DawControl";
import DawSync from "./DawSync";

// See source code of this example:
// https://naomiaro.github.io/waveform-playlist/web-audio-editor.html

// See this exmample:
// https://github.com/naomiaro/waveform-playlist/blob/main/examples/basic-nextjs/pages/index.js
export default function Daw({ playerInstance }) {
  const [ee] = useState(new EventEmitter());
  const [toneCtx, setToneCtx] = useState(null);
  const setUpChain = useRef();
  const [mediaId, setMediaId] = useState(MediaPageStore.get('media-id'));

  // Disable & enable the trim button.
  const [trimDisabled, setTrimDisabled] = useState(true);
  function updateSelect(start, end) {
    if (start < end) {
      setTrimDisabled(false);
    }
    else {
      setTrimDisabled(true);
    }
  }

  // The useRef Hook will preserve a variable for the lifetime of the component.
  // So that whenever there is a re-render, it will NOT recalculate the variable.
  const audioPos = useRef(0);
  function updateTime(time) {
    audioPos.current = time;
  }

  // Disable & enable the record button.
  const [recordDisabled, setRecordDisabled] = useState(true);

  // The useRef Hook will preserve a variable for the lifetime of the component.
  // So that whenever there is a re-render, it will NOT recalculate the variable.
  const playlist = useRef({}); // To be filled later.

  const constraints = { audio: true };

  function gotStream(stream) {
    let userMediaStream = stream;
    playlist.current.initRecorder(userMediaStream);
    setRecordDisabled(false);
  }

  function logError(err) {
    console.error(err);
  }

  useEffect(() => {
    navigator.getUserMedia = (navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia);
  }, []);

  const container = useCallback(
    (node) => {
      if (node !== null && toneCtx !== null) {
        playlist.current = WaveformPlaylist(
          {
            ac: toneCtx.rawContext,
            samplesPerPixel: 3000,
            mono: true,
            waveHeight: 138,
            container: node,
            state: "cursor",
            colors: {
              waveOutlineColor: "#E0EFF1",
              timeColor: "grey",
              fadeColor: "black",
            },
            timescale: true,
            controls: {
              show: true,
              width: 150,
            },
            barWidth: 3, // width in pixels of waveform bars.
            barGap: 1, // spacing in pixels between waveform bars.
            seekStyle: 'line',
            zoomLevels: [500, 1000, 3000, 5000],
          },
          ee
        );

        ee.on("audiorenderingstarting", function (offlineCtx, a) {
          // Set Tone offline to render effects properly.
          const offlineContext = new Tone.OfflineContext(offlineCtx);
          Tone.setContext(offlineContext);
          setUpChain.current = a;
        });

        ee.on("audiorenderingfinished", function (type, data) {
          //restore original ctx for further use.
          Tone.setContext(toneCtx);
          if (type === "wav") {
            // Download:
            saveAs(data, "voice.wav");
            // Upload:
            let title = MediaPageStore.get('media-data').author_name;
            console.log("MediaPageStore.get('media-data')", MediaPageStore.get('media-data'));
            MediaPageActions.submitVoice(title, data, 0, mediaId);
          }
        });

        ee.on("select", updateSelect);
        ee.on("timeupdate", updateTime);

        playlist.current.load([
          // Empty. Don't load any audio for now.
          // TODO: Voices of the current media would be loaded here.
          // TODO: They would be fetched from the database table.
        ]).then(function () {
          // can do stuff with the playlist.

          // After you create the playlist you have to call this function if you want to use recording:
          //initialize the WAV exporter.
          playlist.current.initExporter();

          if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia(constraints)
              .then(gotStream)
              .catch(logError);
          } else if (navigator.getUserMedia && 'MediaRecorder' in window) {
            navigator.getUserMedia(
              constraints,
              gotStream,
              logError
            );
          }
        });

      }
    },
    [ee, toneCtx]
  );

  function handleLoad() {
    setToneCtx(Tone.getContext());
  }

  return (
    <>
      <Script
        src="https://kit.fontawesome.com/ef69927139.js"
        crossorigin="anonymous"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.37/Tone.js"
        onLoad={handleLoad}
      />
      <main className="daw-container-inner">
        <div className="daw-top-row">
          <DawControl playerInstance={playerInstance} ee={ee}
            trimDisabled={trimDisabled}
            recordDisabled={recordDisabled}
          ></DawControl>
          <div className="video-preview-outer">
            <DawVideoPreview playerInstance={playerInstance}></DawVideoPreview>
          </div>
        </div>
        <div ref={container}></div>
        <div className="daw-bottom-row">
          <DawTrackDrop ee={ee}></DawTrackDrop>
          <DawSync ee={ee}></DawSync>
        </div>
      </main>
    </>
  );
}
