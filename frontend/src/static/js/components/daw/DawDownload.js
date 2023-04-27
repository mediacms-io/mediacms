import React, { useEffect, useState, useRef } from 'react';

import { MediaPageStore } from '../../utils/stores/';
import { MediaPageActions } from '../../utils/actions/';
import { PageActions } from '../../utils/actions/';

import './DawDownload.css';
import './DawDownload.scss';

export default function DawDownload({ ee, playerInstance }) {
  // We don't need this read-made popup.
  // Because PopupTrigger consumes the click (so, onClick logic is never run) and triggers the popup.
  // Our case is different. We need a custom onClick logic.
  // In our case, the click shouldn't trigger popup, but it should emit signals for HTTP request.
  // Popup is triggered when HTTP response is received.
  // Popup is triggered by a signal/slot handler.
  // const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const downloadLinkRef = useRef(null);

  const [isPopupVisible, setPopupVisibility] = useState(false);

  function show() {
    setPopupVisibility(true);
  }

  function hide() {
    disableListeners();
    setPopupVisibility(false);
  }

  function toggle() {
    if (isPopupVisible) {
      hide();
    } else {
      show();
    }
  }


  function videoWithVoices() {
    // This value is set by a React effect after waveform-playlist is properly initialized.
    // So, we are sure that if it's not null or undefined, it would contain the info properly.
    const playlist = MediaPageStore.get('waveform-playlist');

    if (playlist) {
      const info = playlist.getInfo();
      console.log('playlist.getInfo()', info);
      var voicesUid = [];
      var voicesSrc = [];
      for (let i = 0; i < info.tracks.length; i++) {
        const uid = info.tracks[i].uid;
        const src = info.tracks[i].src;
        voicesUid.push(uid);
        voicesSrc.push(src);
      }
      MediaPageActions.videoWithVoices(voicesUid, voicesSrc);
    }
  }

  function onOK() {
    toggle();
  }

  function onVideoWithVoices(data) {
    downloadLinkRef.current.href = data.result.result_file_url;
    toggle();

    console.log('VIDEO_WITH_VOICES:', 'ok', 'DATA:', data);
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(() => PageActions.addNotification('Video (+ voices) is ready for download', 'videoWithVoices'), 100);
  }

  function onVideoWithVoicesFail(err) {
    console.log('VIDEO_WITH_VOICES:', 'bad', 'ERROR:', err);
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(
      () => PageActions.addNotification('Video could not be combined with voices', 'videoWithVoicesFail'),
      100
    );
  }

  useEffect(() => {
    MediaPageStore.on('video_with_voices', onVideoWithVoices);
    MediaPageStore.on('video_with_voices_fail', onVideoWithVoicesFail);

    return () => {
      MediaPageStore.removeListener('video_with_voices', onVideoWithVoices);
      MediaPageStore.removeListener('video_with_voices_fail', onVideoWithVoicesFail);
    };
  }, []);

  return (
    <div className="daw-download-outer">
      <div className="daw-download" id="daw-download">
        <button
          type="button"
          className="btn btn-outline-dark"
          title="Download video + displayed voices"
          onClick={() => {
            videoWithVoices();
          }}
        >
          <i className="fas fa-download"></i>
        </button>

        {isPopupVisible ? (
          <div className="popup-fullscreen">
              <span className="popup-fullscreen-overlay"></span>
              <div className="popup-dialog">
                {/* Input form is according to: */}
                {/* `frontend/src/static/js/components/playlist-form/PlaylistCreationForm.jsx` */}
                {/* Class names are kept as before just to have the same CSS styles. */}
                <div className="playlist-form-wrap">
                  <div className="playlist-form-field playlist-title">
                    <span className="playlist-form-label">Video + displayed voices</span>
                    <a className="playlist-form-label"></a>
                  </div>

                  <div className="playlist-form-field playlist-description">
                    <span className="playlist-form-label">Download</span>
                    <a ref={downloadLinkRef} href="">
                      Link
                    </a>
                  </div>

                  <div className="playlist-form-actions">
                    <button className="create-btn" onClick={onOK}>
                      GOT IT
                    </button>
                  </div>
                </div>
              </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
