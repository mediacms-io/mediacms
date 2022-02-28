import React, { useCallback, useState, useRef } from "react";
import Script from "next/script";
import EventEmitter from "events";
import WaveformPlaylist from "waveform-playlist";
import { saveAs } from "file-saver";

export default function Daw() {
  const [ee] = useState(new EventEmitter());
  const [toneCtx, setToneCtx] = useState(null);
  const setUpChain = useRef();

  const container = useCallback(
    (node) => {
      if (node !== null && toneCtx !== null) {
        const playlist = WaveformPlaylist(
          {
            ac: toneCtx.rawContext,
            samplesPerPixel: 100,
            mono: true,
            waveHeight: 100,
            container: node,
            state: "cursor",
            colors: {
              waveOutlineColor: "#E0EFF1",
              timeColor: "grey",
              fadeColor: "black",
            },
            controls: {
              show: true,
              width: 150,
            },
            zoomLevels: [100, 300, 500],
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
        ]);

        //initialize the WAV exporter.
        playlist.initExporter();
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
        src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.37/Tone.js"
        onLoad={handleLoad}
      />
      <main>
        <div>
          <button
            onClick={() => {
              ee.emit("play");
            }}
          >
            Play
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              ee.emit("startaudiorendering", "wav");
            }}
          >
            Download
          </button>
        </div>
        <div ref={container}></div>
      </main>
    </>
  );
}
