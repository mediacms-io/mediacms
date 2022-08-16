import React, { useCallback, useState, useRef, useEffect } from 'react';
import Script from 'next/script';
import WaveformPlaylist from 'waveform-playlist';
import { saveAs } from 'file-saver';
import { MediaPageActions } from '../../utils/actions/';
import Wav2opus from './wav2opus';

// See source code of this example:
// https://naomiaro.github.io/waveform-playlist/web-audio-editor.html
// See this exmample:
// https://github.com/naomiaro/waveform-playlist/blob/main/examples/basic-nextjs/pages/index.js
export default function DawTracks({ ee, voices, onRecordDisabledChange, onTrimDisabledChange }) {

  const playlist = useRef({});
  const [toneCtx, setToneCtx] = useState(null);
  const setUpChain = useRef();

  // The useRef Hook will preserve a variable for the lifetime of the component.
  // So that whenever there is a re-render, it will NOT recalculate the variable.
  const audioPos = useRef(0);
  function updateTime(time) {
    audioPos.current = time;
  }

  const constraints = { audio: true };

  function updateSelect(start, end) {
    if (start < end) {
      onTrimDisabledChange(false); // This callback updates the state of the parent component.
    } else {
      onTrimDisabledChange(true); // This callback updates the state of the parent component.
    }
  }

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
            state: 'cursor',
            colors: {
              waveOutlineColor: '#E0EFF1',
              timeColor: 'grey',
              fadeColor: 'black',
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

        ee.on('audiorenderingstarting', function (offlineCtx, a) {
          // Set Tone offline to render effects properly.
          const offlineContext = new Tone.OfflineContext(offlineCtx);
          Tone.setContext(offlineContext);
          setUpChain.current = a;
        });

        ee.on('audiorenderingfinished', function (type, data) {
          //restore original ctx for further use.
          Tone.setContext(toneCtx);
          if (type === 'wav') {
            // Download:
            saveAs(data, 'voice.wav');
            // Upload:
            var dataOpus = Wav2opus(data); // To reduce data size.
            MediaPageActions.submitVoice(dataOpus);
          }
        });

        ee.on('select', updateSelect);
        ee.on('timeupdate', updateTime);
      }
    },
    [ee, toneCtx] // The callback is run only when these dependencies change.
  );

  useEffect(() => {
    // If playlist is not ready yet, return.
    if (playlist.current &&
      Object.keys(playlist.current).length === 0 &&
      Object.getPrototypeOf(playlist.current) === Object.prototype) {
        return;
      }

    var gotStream = function (stream) {
      let userMediaStream = stream;
      playlist.current.initRecorder(userMediaStream);
      onRecordDisabledChange(false); // This callback updates the state of the parent component.
    };

    var logError = function (err) {
      console.error(err);
    };

    playlist.current
      .load(
        // Voices of the current media would be loaded here.
        // They would be fetched from the database table.
        voices.map((voice) => {
          return {
            src: voice.original_voice_url,
            name: voice.title,
            start: isNaN(parseFloat(voice.start)) ? 0.0 : voice.start,
          };
        })
      )
      .then(function () {
        // can do stuff with the playlist.

        // After you create the playlist you have to call this function if you want to use recording:
        //initialize the WAV exporter.
        playlist.current.initExporter();

        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(logError);
        } else if (navigator.getUserMedia && 'MediaRecorder' in window) {
          navigator.getUserMedia(constraints, gotStream, logError);
        }
      });
  }, [voices]); // The effect only runs when `voices` change.

  function handleLoad() {
    setToneCtx(Tone.getContext());
  }

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.37/Tone.js" onLoad={handleLoad} />
      <div ref={container}></div>
    </>
  );
}
