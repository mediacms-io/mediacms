import { MediaPageActions } from '../../utils/actions/';
import { MediaPageStore } from '../../utils/stores/';
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js';
import WavHeader from './WavHeader';

export default function Wav2opus(wavData) {
  var wavFile = new File([wavData], 'voice.wav', { type: 'audio/wav' });

  var fileReader = new FileReader();

  fileReader.onload = function() {
    encodeOgg(this.result);
  };

  fileReader.readAsArrayBuffer( wavFile );

  return;
}

function concatUint8Arrays(a, b) {
  var c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

// This function assumes the bit depth is 16.
// Bit depth is the data resolution per sample.
function chunkBuffers(arrayBuffer, chunkLength, channelCount) {
  var chunkedBuffers = [];

  // According to this line:
  // https://github.com/zhuker/lamejs/blob/582bbba6a12f981b984d8fb9e1874499fed85675/example.html#L45
  // Looks like WAV bit depth is always assumed to be 16.

  // Also, according to this line:
  // https://github.com/naomiaro/waveform-playlist/blob/526d62a8313c8ae04d70d24c64b8b6e4cbd69764/src/utils/exportWavWorker.js#L55
  // Waveform-playlist always encodes WAV with 16 bits per sample.

  var totalFile = new Int16Array(arrayBuffer);
  // Skip wave header; 44 bytes
  for (var i = 22; i < totalFile.length; i += chunkLength) {
    // Convert 16 bit signed int to 32bit float
    var bufferChunk = new Float32Array(chunkLength / channelCount); // Just keep 1st channel. So, divide length.
    var idx = 0; // To skip 2nd channel.
    for (var j = 0; j < chunkLength; j += channelCount) { // Just keep 1st channel by `j+=`.
      // https://github.com/chris-rudmin/opus-recorder/issues/265#issuecomment-1218059017
      // Shifting the 0 crossing and keeping the two halves of the waveform symmetric,
      // by `+-0.5` statements:
      bufferChunk[idx] = (totalFile[i + j]+ 0.5) / 32767.5; // 32767.5 == 2^16/2-0.5
      idx++;
    }

    chunkedBuffers.push([bufferChunk]);
  }

  return chunkedBuffers;
}

function encodeOgg(arrayBuffer) {
    // Reference to read WAV header:
    // https://github.com/zhuker/lamejs/blob/582bbba6a12f981b984d8fb9e1874499fed85675/example.html#L43
    var wavHeader = WavHeader.readHeader(new DataView(arrayBuffer));
    console.debug('wav header:'.toUpperCase(), wavHeader);

    if (wavHeader.channels == 0 || wavHeader.sampleRate == 0 || wavHeader.dataOffset != 44) {
        console.warn('Input file does not have a valid WAV header'.toUpperCase());
        return;
    }

  // Reference:
  // https://github.com/chris-rudmin/opus-recorder/blob/fdfdadeeb9bc9d045c59dc75ebefed390e4ad6dc/example/fileEncoder.html#L71
  var completeOggData = new Uint8Array(0);

  var encoderWorker = new Worker(encoderPath);
  var bufferLength = 4096; // Is passed to chunk function too.

  encoderWorker.postMessage({
    command: 'init',
    //encoderSampleRate: 48000, // Of output OPUS. Let's use default.
    bufferLength: bufferLength,
    originalSampleRate: wavHeader.sampleRate, // Of input WAV.
    encoderApplication: 2048, // 2048 - Voice
    encoderComplexity: 5, // 0 is fastest with lowest complexity. 10 is slowest with highest complexity.
    resampleQuality: 3, // 0 is fastest with lowest quality. 10 is slowest with highest quality.
    numberOfChannels: 1, // Of output OPUS. Only `1` works. Test for `2` throws error.
    //encoderBitRate: 96000, // Let it be according to other configs.
    //originalSampleRateOverride: 16000, // Google Speech API requires this field to be 16000.
  });

  encoderWorker.postMessage({
    command: 'getHeaderPages',
  });

  chunkBuffers(arrayBuffer, bufferLength, wavHeader.channels).forEach((bufferChunk) =>
    encoderWorker.postMessage({
      command: 'encode',
      buffers: bufferChunk,
    })
  );

  encoderWorker.postMessage({
    command: 'done',
  });

  encoderWorker.onmessage = ({ data }) => {
    if (data.message === 'done') {
      //finished encoding - save to audio tag
      var dataBlob = new Blob([completeOggData], { type: 'audio/ogg' });
      // Save voice inside server database.
      MediaPageActions.submitVoice(dataBlob, MediaPageStore.get('media-voice-recording-start'));
    } else if (data.message === 'page') {
      completeOggData = concatUint8Arrays(completeOggData, data.page);
    }
  };
}