import React, { useCallback, useState, useRef } from "react";
import Script from "next/script";
import EventEmitter from "events";
import WaveformPlaylist from "waveform-playlist";
import { saveAs } from "file-saver";

import 'waveform-playlist/styles/playlist.scss';

// For extra buttons.
import 'bootstrap/dist/css/bootstrap.min.css';

window.MNS = {} // Namespace to hold vars.
MNS.time = 0 // Current media time.
MNS.paused = true // Is media paused or playing?

let userMediaStream;
let playlist = {}; // To be filled later.
let constraints = { audio: true };

navigator.getUserMedia = (navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia);

function gotStream(stream) {
  userMediaStream = stream;
  playlist.initRecorder(userMediaStream);
  document.getElementById("btn-record").classList.remove("disabled")
}

function logError(err) {
  console.error(err);
}

function toggleActive(node) {
  var active = node.parentNode.querySelectorAll('.active');
  var i = 0, len = active.length;

  for (; i < len; i++) {
      active[i].classList.remove('active');
  }

  node.classList.toggle('active');
}

export default function Daw() {
  const [ee] = useState(new EventEmitter());
  const [toneCtx, setToneCtx] = useState(null);
  const setUpChain = useRef();

  const container = useCallback(
    (node) => {
      if (node !== null && toneCtx !== null) {
        playlist = WaveformPlaylist(
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
            saveAs(data, "test.wav");
          }
        });

        playlist.load([
          {
            src: "https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_2MG.mp3",
            name: "Example",
            effects: function (graphEnd, masterGainNode, isOffline) {
              const reverb = new Tone.Reverb(1.2);

              if (isOffline) {
                setUpChain.current.push(reverb.ready);
              }

              Tone.connect(graphEnd, reverb);
              Tone.connect(reverb, masterGainNode);

              return function cleanup() {
                reverb.disconnect();
                reverb.dispose();
              };
            },
          },
        ]).then(function () {
          // can do stuff with the playlist.

          // After you create the playlist you have to call this function if you want to use recording:
          //initialize the WAV exporter.
          playlist.initExporter();

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
      <main>
        <div class="controls-groups">
          <div class="controls-group">
            <div class="btn-group">
              <button type="button" id="btn-record" class="btn btn-outline-primary disabled" title="Record"
                onClick={()=>{
                  ee.emit("record");
                  // TODO: play video.
                }}
              >
                <i class="fas fa-microphone"></i>
              </button>
              <button type="button" id="btn-stop" class="btn btn-outline-danger" title="Stop"
                onClick={() => {
                  ee.emit("stop");
                  // TODO: pause video.
                }}
              >
                <i class="fas fa-stop"></i>
              </button>
            </div>
          </div>
          <div class="controls-group">
            <div class="btn-group">
              <button type="button" id="btn-play" class="btn btn-outline-success" title="Play/Pause"
                onClick={() => {
                  if (MNS.paused) {
                    ee.emit("play");
                    // TODO: play video.
                  } else {
                    ee.emit("pause");
                    // TODO: pause video.
                  }

                  // Toggle play/pause.
                  MNS.paused = !MNS.paused
                }}
              >
                <i class="fas fa-play"></i>
                <i class="fas fa-pause"></i>
              </button>
            </div>
            <div class="btn-group">
              <button type="button" title="Zoom in" id="btn-zoom-in" class="btn btn-outline-dark">
                <i class="fas fa-search-plus"></i>
              </button>
              <button type="button" title="Zoom out" id="btn-zoom-out" class="btn btn-outline-dark">
                <i class="fas fa-search-minus"></i>
              </button>
            </div>
            <div class="btn-group btn-playlist-state-group">
              <button type="button" id="btn-cursor" class="btn btn-outline-dark active" title="Select cursor">
                <i class="fas fa-headphones"></i>
              </button>
              <button type="button" id="btn-select" class="btn btn-outline-dark" title="Select audio region">
                <i class="fas fa-italic"></i>
              </button>
              <button type="button" id="btn-shift" class="btn btn-outline-dark" title="Shift audio in time"
                onClick={() => {
                  ee.emit("statechange", "shift");
                  toggleActive(this);
                }}
              >
                <i class="fas fa-arrows-alt-h"></i>
              </button>
            </div>
            <div class="btn-group btn-select-state-group">
              <button type="button" id="btn-trim-audio"
                title="Keep only the selected audio region for a track"
                class="btn btn-outline-primary disabled">
                Trim
              </button>
            </div>
          </div>
          <div class="controls-group">
            <div class="btn-group">
              <button type="button" title="Clear the playlist's tracks"
                class="btn btn-clear btn-outline-danger"
                onClick={() => {
                  ee.emit("clear");
                }}
              >
                Clear
              </button>
            </div>
            <div class="btn-group">
              <button type="button" title="Download the current work as Wav file"
                class="btn btn-download btn-outline-primary"
                onClick={() => {
                  ee.emit("startaudiorendering", "wav");
                }}
              >
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
        </div>
        <div ref={container}></div>
      </main>
    </>
  );
}
