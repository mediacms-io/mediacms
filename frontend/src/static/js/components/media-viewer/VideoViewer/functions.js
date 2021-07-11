import { SiteContext } from '../../../utils/contexts/';
import { formatInnerLink } from '../../../utils/helpers/';

const validVideoFormats = ['hls', 'h265', 'vp9', 'h264', 'vp8', 'mp4', 'theora']; // NOTE: Keep array items order.

function browserSupports_videoCodec(what, debugLog) {
  let ret = null,
    vid = document.createElement('video');

  if (!!vid.canPlayType) {
    try {
      switch (what) {
        case 'hls':
          // ret = 'probably' === vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"');
          ret = true; // NOTE: Return always 'true' and allow player to decide...
          break;
        case 'h265':
          ret =
            'probably' === vid.canPlayType('video/mp4; codecs="hvc1.1.L0.0"') ||
            'probably' === vid.canPlayType('video/mp4; codecs="hev1.1.L0.0"');
          break;
        case 'h264':
          ret =
            'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"') ||
            'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
          break;
        case 'vp9':
          ret = 'probably' === vid.canPlayType('video/webm; codecs="vp9"');
          break;
        case 'vp8':
          ret = 'probably' === vid.canPlayType('video/webm; codecs="vp8, vorbis"');
          break;
        case 'theora':
          ret = 'probably' === vid.canPlayType('video/ogg; codecs="theora"');
          break;
        case 'mp4':
          // ret = 'probably' === vid.canPlayType('video/mp4; codecs="mp4v.20.8"');
          ret = true; // NOTE: Return always 'true', as the default video format.
          break;
      }

      // Log BUGGY states.

      debugLog = debugLog instanceof Boolean || 0 === debugLog || 1 == debugLog ? debugLog : false;

      if (debugLog) {
        if ('no' === vid.canPlayType('video/nonsense')) {
          console.warn(
            'BUGGY: Codec detection bug in Firefox 3.5.0 - 3.5.1 and Safari 4.0.0 - 4.0.4 that answer "no" to unknown codecs instead of an empty string'
          );
        }

        if ('probably' === vid.canPlayType('video/webm')) {
          console.warn(
            'BUGGY: Codec detection bug that Firefox 27 and earlier always says "probably" when asked about WebM, even when the codecs string is not present'
          );
        }

        if ('maybe' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
          switch (vid.canPlayType('video/mp4')) {
            case 'probably':
              console.warn(
                'BUGGY: Codec detection bug in iOS 4.1 and earlier that switches "maybe" and "probably" around'
              );
              break;
            case 'maybe':
              console.warn('BUGGY: Codec detection bug in Android where no better answer than "maybe" is given');
              break;
          }
        }

        if (
          'probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') &&
          'probably' !== vid.canPlayType('video/mp4; codecs="avc1.42E01E"')
        ) {
          console.warn(
            'BUGGY: Codec detection bug in Internet Explorer 9 that requires both audio and video codec on test'
          );
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }

  return ret;
}

/*
 * LINK: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/video.js
 */
export function orderedSupportedVideoFormats(includeAll) {
  let order = [];
  let supports = {};
  let vid = document.createElement('video');

  if (!!vid.canPlayType) {
    /*if( '' === vid.canPlayType('application/x-mpegURL; codecs="avc1.42E01E"') ){ */
    supports.hls = !0; // NOTE: Return always 'true' and allow player to decide...
    order.push('hls');
    /*}*/

    if (
      vid.canPlayType('video/mp4; codecs="hvc1.1.L0.0"') ||
      'probably' === vid.canPlayType('video/mp4; codecs="hev1.1.L0.0"')
    ) {
      supports.h265 = !0;
      order.push('h265');
    }

    if ('probably' === vid.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
      supports.h264 = !0;
      order.push('h264');
    }

    if ('probably' === vid.canPlayType('video/webm; codecs="vp9"')) {
      supports.vp9 = !0;
      order.push('vp9');
    }

    if (includeAll) {
      if ('probably' === vid.canPlayType('video/webm; codecs="vp8, vorbis"')) {
        supports.vp8 = !0;
        order.push('vp8');
      }

      if ('probably' === vid.canPlayType('video/ogg; codecs="theora"')) {
        supports.theora = !0;
        order.push('theora');
      }
    }

    if ('probably' === vid.canPlayType('video/mp4; codecs="mp4v.20.8"')) {
      supports.mp4 = !0;
      order.push('mp4');
    }
  }

  return {
    order: order,
    support: supports,
  };
}

export function videoAvailableCodecsAndResolutions(data, hlsData, supportedFormats) {
  const ret = {};
  let i, k, fileExt;

  supportedFormats = void 0 === supportedFormats ? orderedSupportedVideoFormats() : supportedFormats;

  const supportedFormatsExtensions = {
    hls: ['m3u8'],
    h265: ['mp4', 'webm'],
    h264: ['mp4', 'webm'],
    vp9: ['mp4', 'webm'],
    vp8: ['mp4', 'webm'],
    theora: ['ogg'],
    mp4: ['mp4'],
  };

  for (i in hlsData) {
    if (hlsData.hasOwnProperty(i)) {
      k = null;

      if ('master_file' === i) {
        k = 'Auto';
      } else {
        k = i.split('_playlist');
        k = 2 === k.length ? k[0] : null;
      }

      if (null !== k) {
        ret[k] = void 0 === ret[k] ? { format: [], url: [] } : ret[k];
        ret[k].format.push('hls');
        ret[k].url.push(formatInnerLink(hlsData[i], SiteContext._currentValue.url));
      }
    }
  }

  for (k in data) {
    if (data.hasOwnProperty(k) && Object.keys(data[k]).length) {
      // TODO: With HLS doesn't matter the height of screen?
      if (1080 >= parseInt(k, 10) || (1080 < window.screen.width && 1080 < window.screen.height)) {
        i = 0;
        while (i < validVideoFormats.length) {
          if (void 0 !== data[k][validVideoFormats[i]]) {
            if (
              browserSupports_videoCodec(validVideoFormats[i], !1) &&
              data[k][validVideoFormats[i]] &&
              data[k][validVideoFormats[i]].url
            ) {
              if (100 !== data[k][validVideoFormats[i]].progress) {
                console.warn('VIDEO DEBUG:', 'PROGRESS value is', data[k][validVideoFormats[i]].progress);
              }

              if ('success' !== data[k][validVideoFormats[i]].status) {
                console.warn('VIDEO DEBUG:', 'STATUS value is', data[k][validVideoFormats[i]].status);
              }

              fileExt = data[k][validVideoFormats[i]].url.split('.');

              if (
                fileExt.length &&
                0 <= supportedFormatsExtensions[validVideoFormats[i]].indexOf(fileExt[fileExt.length - 1])
              ) {
                ret[k] = void 0 === ret[k] ? { format: [], url: [] } : ret[k];
                ret[k].format.push(validVideoFormats[i]);
                ret[k].url.push(formatInnerLink(data[k][validVideoFormats[i]].url, SiteContext._currentValue.url));
              }
            }
          }

          i += 1;
        }
      }
    }
  }

  return ret;
}

export function extractDefaultVideoResolution(def, data) {
  let i,
    keys = Object.keys(data);

  if (void 0 !== data[def]) {
    return def;
  }

  if (parseInt(def, 10) >= parseInt(keys[keys.length - 1], 10)) {
    return keys[keys.length - 1];
  }

  if (parseInt(def, 10) <= parseInt(keys[0], 10)) {
    return keys[0];
  }

  i = keys.length - 1;
  while (i >= 0) {
    if (parseInt(def, 10) >= parseInt(keys[i], 10)) {
      return keys[i + 1];
    }
    i -= 1;
  }
}
