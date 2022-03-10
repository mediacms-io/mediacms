import React, { useCallback, useState, useRef } from "react";
import Script from "next/script";
import EventEmitter from "events";
import WaveformPlaylist from "waveform-playlist";
import { saveAs } from "file-saver";

import 'waveform-playlist/styles/playlist.scss';

import '../daw/style.css'
import '../daw/responsive.css'

// For extra buttons.
import 'bootstrap/dist/css/bootstrap.min.css';

// See source code of this example:
// https://naomiaro.github.io/waveform-playlist/web-audio-editor.html
let startTime = 0;
let endTime = 0;
let audioPos = 0;
let isLooping = false; // To detect paused or played.

function updateSelect(start, end) {
  if (start < end) {
    document.getElementById('btn-trim-audio').classList.remove('disabled');
  }
  else {
    document.getElementById('btn-trim-audio').classList.add('disabled');
  }

  startTime = start;
  endTime = end;
}

function updateTime(time) {
  audioPos = time;
}

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

// See this exmample:
// https://github.com/naomiaro/waveform-playlist/blob/main/examples/basic-nextjs/pages/index.js
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

        ee.on("select", updateSelect);
        ee.on("timeupdate", updateTime);

        playlist.load([
          // Empty. Don't load any audio for now.
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
      <main className="daw-container-inner">
        <div className="controls-groups">
          <div className="controls-group">
            <div className="btn-group">
              <button type="button" id="btn-record" className="btn btn-outline-primary disabled" title="Record"
                onClick={()=>{
                  ee.emit("record");
                  // TODO: play video.
                }}
              >
                <i className="fas fa-microphone"></i>
              </button>
              <button type="button" id="btn-stop" className="btn btn-outline-danger" title="Stop"
                onClick={() => {
                  ee.emit("stop");
                  // TODO: pause video.
                }}
              >
                <i className="fas fa-stop"></i>
              </button>
            </div>
          </div>
          <div className="controls-group">
            <div className="btn-group">
              <button type="button" id="btn-play" className="btn btn-outline-success" title="Play/Pause"
                onClick={() => {
                  if (isLooping) {
                    ee.emit("pause");
                    // TODO: pause video.
                  } else {
                    ee.emit("play");
                    // TODO: play video.
                  }

                  // Toggle play/pause.
                  isLooping = !isLooping
                }}
              >
                <i className="fas fa-play"></i>
                <i className="fas fa-pause"></i>
              </button>
            </div>
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
              <button type="button" id="btn-cursor" className="btn btn-outline-dark active" title="Select cursor"
                onClick={(event) => {
                  ee.emit("statechange", "cursor");
                  document.getElementById('btn-cursor').classList.remove('active');
                  document.getElementById('btn-select').classList.remove('active');
                  document.getElementById('btn-shift').classList.remove('active');
                  event.target.classList.add('active');
                }}
              >
                <i className="fas fa-headphones"></i>
              </button>
              <button type="button" id="btn-select" className="btn btn-outline-dark" title="Select audio region"
                onClick={(event) => {
                  ee.emit("statechange", "select");
                  document.getElementById('btn-cursor').classList.remove('active');
                  document.getElementById('btn-select').classList.remove('active');
                  document.getElementById('btn-shift').classList.remove('active');
                  event.target.classList.add('active');
                }}
              >
                <i className="fas fa-italic"></i>
              </button>
              <button type="button" id="btn-shift" className="btn btn-outline-dark" title="Shift audio in time"
                onClick={(event) => {
                  ee.emit("statechange", "shift");
                  document.getElementById('btn-cursor').classList.remove('active');
                  document.getElementById('btn-select').classList.remove('active');
                  document.getElementById('btn-shift').classList.remove('active');
                  event.target.classList.add('active');
                }}
              >
                <i className="fas fa-arrows-alt-h"></i>
              </button>
            </div>
            <div className="btn-group btn-select-state-group">
              <button type="button" id="btn-trim-audio"
                title="Keep only the selected audio region for a track"
                className="btn btn-outline-primary disabled"
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
        <div ref={container}></div>
        <div className="track-drop" id="track-drop"
          onDragEnter={(event) => {
            event.preventDefault();
            event.target.classList.add("drag-enter");
          }}
          onDragOver={(event)=>{
            event.preventDefault();
          }}
          onDragLeave={(event)=>{
            event.preventDefault();
            event.target.classList.remove("drag-enter");
          }}
          onDrop={(event)=>{
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
      </main>
    </>
  );
}
