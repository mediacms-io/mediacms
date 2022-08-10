import React, { useCallback, useState, useRef } from 'react';
import Script from 'next/script';
import WaveformPlaylist from 'waveform-playlist';
import { saveAs } from 'file-saver';
import { MediaPageStore } from '../../utils/stores/';

// See source code of this example:
// https://naomiaro.github.io/waveform-playlist/web-audio-editor.html
// See this exmample:
// https://github.com/naomiaro/waveform-playlist/blob/main/examples/basic-nextjs/pages/index.js
export default function DawTracks({ ee, voices, onRecordDisabledChange, onTrimDisabledChange }) {
  const [toneCtx, setToneCtx] = useState(null);
  const setUpChain = useRef();

  // The useRef Hook will preserve a variable for the lifetime of the component.
  // So that whenever there is a re-render, it will NOT recalculate the variable.
  const audioPos = useRef(0);
  function updateTime(time) {
    audioPos.current = time;
  }

  const constraints = { audio: true };

  function gotStream(stream) {
    let userMediaStream = stream;
    playlist.initRecorder(userMediaStream);
    onRecordDisabledChange(false); // This callback updates the state of the parent component.
  }

  function logError(err) {
    console.error(err);
  }

  function updateSelect(start, end) {
    if (start < end) {
      onTrimDisabledChange(false); // This callback updates the state of the parent component.
    } else {
      onTrimDisabledChange(true); // This callback updates the state of the parent component.
    }
  }

  // We need `playlist` to re-render whenever `voices` state changes,
  // to fetch and set the voices of the DAW.
  let playlist = {}; // To be filled later.

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
            const title = MediaPageStore.get('media-data').author_name;
            const mediaId = MediaPageStore.get('media-id');
            console.log("MediaPageStore.get('media-data')", MediaPageStore.get('media-data'));
            MediaPageActions.submitVoice(title, data, 0, mediaId);
          }
        });

        ee.on('select', updateSelect);
        ee.on('timeupdate', updateTime);

        playlist
          .load(
            // Voices of the current media would be loaded here.
            // They would be fetched from the database table.
            voices.map((voice) => {
              return {
                src: voice.voice_file,
                name: voice.title,
                start: isNaN(parseFloat(voice.start)) ? 0.0 : voice.start,
              };
            })
          )
          .then(function () {
            // can do stuff with the playlist.

            // After you create the playlist you have to call this function if you want to use recording:
            //initialize the WAV exporter.
            playlist.initExporter();

            if (navigator.mediaDevices) {
              navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(logError);
            } else if (navigator.getUserMedia && 'MediaRecorder' in window) {
              navigator.getUserMedia(constraints, gotStream, logError);
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
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.37/Tone.js" onLoad={handleLoad} />
      <div ref={container}></div>
    </>
  );
}
