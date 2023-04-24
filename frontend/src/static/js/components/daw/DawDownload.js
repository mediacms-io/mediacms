import React from 'react'

import { MediaPageStore } from '../../utils/stores/';
import { MediaPageActions } from '../../utils/actions/';

import './DawDownload.css';

export default function DawDownload({ ee, playerInstance }) {

    function videoWithVoices() {

        // This value is set by a React effect after waveform-playlist is properly initialized.
        // So, we are sure that if it's not null or undefined, it would contain the info properly.
        const playlist = MediaPageStore.get('waveform-playlist');

        if (playlist) {
            const info = playlist.getInfo();
            console.log('playlist.getInfo()', info);
            var voicesUid = []
            var voicesSrc = []
            for (let i = 0; i < info.tracks.length; i++) {
                const uid = info.tracks[i].uid
                const src = info.tracks[i].src
                voicesUid.push(uid)
                voicesSrc.push(src)
            }
            MediaPageActions.videoWithVoices(voicesUid, voicesSrc);
        }
    }

    function onVideoWithVoices(data) {
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
                <button type="button" className="btn btn-outline-dark" title="Download video + displayed voices"
                    onClick={(event) => {
                        console.log('event: ', event)
                        videoWithVoices()
                    }}
                >
                    <i className="fas fa-download"></i>
                </button>
            </div>
        </div>
    )
}
