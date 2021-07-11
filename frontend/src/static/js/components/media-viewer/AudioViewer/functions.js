export function extractAudioFileFormat(filename) {
	let ret = null;
	let ext = filename.split('.');
	if (ext.length) {
		ext = ext[ext.length - 1];
		switch (ext) {
			case 'webm':
				ret = 'audio/webm';
				break;
			case 'flac':
				ret = 'audio/flac';
				break;
			case 'wave':
				ret = 'audio/wave';
				break;
			case 'wav':
				ret = 'audio/wav';
				break;
			case 'ogg':
				ret = 'audio/ogg';
				break;
			case 'ogg':
				ret = 'audio/ogg';
				break;
			case 'mp3':
			case 'mpeg':
				ret = 'audio/mpeg';
				break;
		}
	}
	return ret;
}

// NOTE: Valid but not get used.
/*export function orderedSupportedAudioFormats( includeAll ){

	let order = [];
	let supports = {};
	let aud = document.createElement('audio');

	if(!!aud.canPlayType){

		if( 'probably' === aud.canPlayType('audio/webm') || 'maybe' === aud.canPlayType('audio/webm') ){
			supports.webm = !0;
			order.push( 'webm' );
		}

		if( 'probably' === aud.canPlayType('audio/flac') || 'maybe' === aud.canPlayType('audio/flac') ){
			supports.flac = !0;
			order.push( 'flac' );
		}

		if( 'probably' === aud.canPlayType('audio/wave') || 'maybe' === aud.canPlayType('audio/wave') ){
			supports.wave = !0;
			order.push( 'wave' );
		}

		if( 'probably' === aud.canPlayType('audio/wav') || 'maybe' === aud.canPlayType('audio/wav') ){
			supports.wav = !0;
			order.push( 'wav' );
		}

		if( 'probably' === aud.canPlayType('audio/ogg') || 'maybe' === aud.canPlayType('audio/ogg') ){
			supports.ogg = !0;
			order.push( 'ogg' );
		}

		if( 'probably' === aud.canPlayType('audio/ogg; codecs="opus"') || 'maybe' === aud.canPlayType('audio/ogg; codecs="opus"') ){
			supports.oggOpus = !0;
			order.push( 'oggOpus' );
		}

		if( 'probably' === aud.canPlayType('audio/mpeg') || 'maybe' === aud.canPlayType('audio/mpeg') ){
			supports.mp3 = !0;
			order.push( 'mp3' );
		}
	}

	return {
		order: order,
		support: supports
	};
}*/
