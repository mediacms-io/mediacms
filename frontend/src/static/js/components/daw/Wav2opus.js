import { MediaPageActions } from '../../utils/actions/';

export default function Wav2opus(wavData) {
    MediaPageActions.submitVoice(wavData);
}