import { saveAs } from 'file-saver';
import { MediaPageActions } from '../../utils/actions/';

// Inspired by:
// https://github.com/Rillke/opusenc.js/blob/3c2fc71a80633a06613320310597746d293f86f3/iframe.html#L39
export default function Wav2opus(wavData) {
  var worker = new Worker('static/worker-opus/EmsWorkerProxy.js');

  const inName = 'voice.wav';
  const outName = 'voice.opus';
  var args = [
    // Input file *name*
    inName,
    // Output file *name*
    outName,
  ];

  // https://stackoverflow.com/questions/27159179/how-to-convert-blob-to-file-in-javascript#comment90422918_31663645
  var wavFile = new File([wavData], inName, 'audio/wav');

  // Input file data
  // Object literal mapping
  // file names to Uint8Array
  var inData = {};
  // Remember: We set map `key` as input file name
  inData[inName] = new Uint8Array(wavFile);

  // Meta-information about the files
  // that are being created during encoding
  // Currently MIME type only
  var outData = {
    // Name of the file that is being created
    // Remenber: We previously set 'encoded.opus'
    // as output file name in the command line
    // arguments array args
    outName: {
      // Its MIME type
      MIME: 'audio/ogg',
    },
  };

  // Finally post all the data to the
  // worker together with the "encode"
  // command.
  worker.postMessage({
    command: 'encode',
    args: args,
    outData: outData,
    fileData: inData,
  });

  // Listen for messages by the worker
  worker.onmessage = function (e) {
    // If the message is a progress message
    if (e.data && e.data.reply === 'progress') {
      var vals = e.data.values;
      if (vals[1]) {
        // ... push the progress bar forward
        console.log('ENCODE PROGRESS %', (vals[0] / vals[1]) * 100);
      }
      // If the worker is ready
    } else if (e.data && e.data.reply === 'done') {
      console.log('ENCODE PROGRESS %', 100);
      for (var fileName in e.data.values) {
        // ... offer all files the worker returned
        // In this case it's only one because we didn't
        // use a command line argument that would force
        // opusenc.js to create another file
        var dataOpus = e.data.values[fileName].blob;
        saveAs(dataOpus, outName);
        MediaPageActions.submitVoice(dataOpus);
      }
    }
  };
}
