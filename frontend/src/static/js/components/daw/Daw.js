import React, { useState, useEffect } from "react";
import Script from "next/script";
import EventEmitter from "events";
import { MediaPageStore } from '../../utils/stores/';
import { MemberContext } from '../../utils/contexts/';
import { PageActions } from '../../utils/actions/';

import 'waveform-playlist/styles/playlist.css'
import 'waveform-playlist/styles/playlist.scss';

import './daw.css';
import './daw-responsive.css';

// For extra buttons.
import 'bootstrap/dist/css/bootstrap.min.css';

import DawVideoPreview from './DawVideoPreview';
import DawTrackDrop from "./DawTrackDrop";
import DawControl from "./DawControl";
import DawSync from "./DawSync";
import DawTracks from "./DawTracks";
import DawDelete from "./DawDelete";
import DawDeletePopup from "./DawDeletePopup";

const voicesText = {
  single: 'voice',
  uppercaseSingle: 'VOICE',
  ucfirstSingle: 'Voice',
  ucfirstPlural: 'Voices',
  submitCommentText: 'SUBMIT',
  disabledCommentsMsg: 'Voices are disabled',
};

// See source code of this example:
// https://naomiaro.github.io/waveform-playlist/web-audio-editor.html

// See this exmample:
// https://github.com/naomiaro/waveform-playlist/blob/main/examples/basic-nextjs/pages/index.js
export default function Daw({ playerInstance }) {
  const [ee] = useState(new EventEmitter());
  
  // Disable & enable the trim button.
  const [trimDisabled, setTrimDisabled] = useState(true);
  
  // Disable & enable the record button.
  const [recordDisabled, setRecordDisabled] = useState(true);

  function onTrimDisabledChange(disabled) { // This callback is passed down to child component.
    setTrimDisabled(disabled);
  }
  
  function onRecordDisabledChange(disabled) { // This callback is passed down to child component.
    setRecordDisabled(disabled);
  }

  function triggerVoiceLike(voiceUid) { // This callback is passed down to child component.
    console.log('Voice heart: UID:', voiceUid);
    MediaPageActions.likeVoice(voiceUid);
  }

  const [voices, setVoices] = useState(
    MemberContext._currentValue.can.hearVoice ? MediaPageStore.get('media-voices') : []
  );

  function onVoicesLoad() {
    // Clear tracks/voices before re-loading them.
    // This avoids the newly-submitted voice being displayed twice.
    ee.emit("clear");
    const retrievedVoices = [...MediaPageStore.get('media-voices')];
    setVoices(retrievedVoices);
  }

  function onVoiceSubmit(uid) {
    console.log('SUBMIT_VOICE:', 'ok', 'UID:', uid);
    setTimeout(
      // TODO: Add notificationId of voiceSubmit
      () => PageActions.addNotification(voicesText.ucfirstSingle + ' added', 'voiceSubmit'),
      100
      );
  }

  function onVoiceSubmitFail(err) {
    console.warn('SUBMIT_VOICE:', 'bad', 'ERROR:', err);
    setTimeout(
      // TODO: Add notificationId of voiceSubmitFail
      () => PageActions.addNotification(voicesText.ucfirstSingle + ' submition failed', 'voiceSubmitFail'),
      100
    );
  }

  function onVoiceDelete() {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(() => PageActions.addNotification(voicesText.ucfirstSingle + ' removed', 'voiceDelete'), 100);
  }

  function onVoiceDeleteFail() {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(
      () => PageActions.addNotification(voicesText.ucfirstSingle + ' removal failed', 'voiceDeleteFail'),
      100
    );
  }

  function onVoicesDelete() {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(() => PageActions.addNotification(voicesText.ucfirstPlural + ' removed', 'voicesDelete'), 100);
  }

  function onVoicesDeleteFail() {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(
      () => PageActions.addNotification(voicesText.ucfirstPlural + ' removal failed', 'voicesDeleteFail'),
      100
    );
  }

  useEffect(() => {
    navigator.getUserMedia = (navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia);

    MediaPageStore.on('voices_load', onVoicesLoad);
    MediaPageStore.on('voice_submit', onVoiceSubmit);
    MediaPageStore.on('voice_submit_fail', onVoiceSubmitFail);
    MediaPageStore.on('voice_delete', onVoiceDelete);
    MediaPageStore.on('voice_delete_fail', onVoiceDeleteFail);
    MediaPageStore.on('voices_delete', onVoicesDelete);
    MediaPageStore.on('voices_delete_fail', onVoicesDeleteFail);

    return () => {
      MediaPageStore.removeListener('voices_load', onVoicesLoad);
      MediaPageStore.removeListener('voice_submit', onVoiceSubmit);
      MediaPageStore.removeListener('voice_submit_fail', onVoiceSubmitFail);
      MediaPageStore.removeListener('voice_delete', onVoiceDelete);
      MediaPageStore.removeListener('voice_delete_fail', onVoiceDeleteFail);
      MediaPageStore.removeListener('voices_delete', onVoicesDelete);
      MediaPageStore.removeListener('voices_delete_fail', onVoicesDeleteFail);
    };
  }, []);

  return (
    <>
      <Script
        src="https://kit.fontawesome.com/ef69927139.js"
        crossorigin="anonymous"
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
        <DawTracks ee={ee} voices={voices}
          onRecordDisabledChange={onRecordDisabledChange}
          onTrimDisabledChange={onTrimDisabledChange}
          triggerVoiceLike={triggerVoiceLike}
        ></DawTracks>
        <div className="daw-bottom-row">
          <DawTrackDrop ee={ee}></DawTrackDrop>
          {/* This one deletes all owned voices, not needed now: <DawDelete></DawDelete> */}
          <DawSync ee={ee}></DawSync>
          <DawDeletePopup ee={ee}></DawDeletePopup>
        </div>
      </main>
    </>
  );
}
