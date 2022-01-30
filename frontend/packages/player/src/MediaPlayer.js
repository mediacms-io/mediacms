import 'mediacms-vjs-plugin/dist/mediacms-vjs-plugin.js';
import 'mediacms-vjs-plugin/dist/mediacms-vjs-plugin.css';

function isString(v) {
	return 'string' === typeof v || v instanceof String;
}

function isArray(v) {
	return !Array.isArray ? '[object Array]' === Object.prototype.toString.call(v) : Array.isArray(v);
}

function isBoolean(v) {
	return 'boolean' === typeof v || v instanceof Boolean;
}

function ifBooleanElse(bol, els) {
	return isBoolean(bol) ? bol : els;
}

const defaults = {
	options: {
		sources: [],
		keyboardControls: !0,
		enabledTouchControls: !0,
		nativeDimensions: !1,
		suppressNotSupportedError: !0,
		poster: '',
		loop: !1,
		controls: !0,
		preload: 'auto',
		autoplay: !1,
		bigPlayButton: !0,
		liveui: !1,
		controlBar: {
			bottomBackground: !0,
			progress: !0,
			play: !0,
			next: !1,
			previous: !1,
			volume: !0,
			pictureInPicture: !0, // @link: https://docs.videojs.com/control-bar_picture-in-picture-toggle.js.html
			fullscreen: !0,
			theaterMode: !0,
			time: !0,
		},
		cornerLayers: {
			topLeft: null,
			topRight: null,
			bottomLeft: null,
			bottomRight: null,
		},
		videoPreviewThumb: {},
		subtitles: {
			on: false,
			default: null,
			languages: [],
		},
	},
};

/**
 * Filter plugin options values.
 * @param  {Object} opt Options object.
 * @return {Object}     Filtered/Validated options object.
 */
function filterPlayerOptions(domPlayer, opt) {
	let k, x, j, i;

	opt.sources = isArray(opt.sources) && opt.sources.length ? opt.sources : [];
	opt.loop = ifBooleanElse(opt.loop, defaults.options.loop);
	opt.controls = ifBooleanElse(opt.controls, defaults.options.controls);

	if (opt.subtitles && opt.subtitles instanceof Object) {
		opt.subtitles.default = void 0 !== opt.subtitles.default ? opt.subtitles.default : defaults.options.subtitles.default;
		opt.subtitles.languages = isArray(opt.subtitles.languages)
			? opt.subtitles.languages
			: defaults.options.subtitles.languages;
		opt.subtitles.on = ifBooleanElse(opt.subtitles.on, defaults.options.subtitles.on);
	} else {
		opt.subtitles.default = defaults.options.subtitles;
	}

	opt.autoplay =
		'any' === opt.autoplay || 'play' === opt.autoplay || 'muted' === opt.autoplay
			? opt.autoplay
			: ifBooleanElse(opt.autoplay, defaults.options.autoplay);

	// console.log(opt.autoplay);

	opt.bigPlayButton = ifBooleanElse(opt.bigPlayButton, defaults.options.bigPlayButton);
	opt.poster = isString(opt.poster) && '' !== opt.poster.trim() ? opt.poster : defaults.options.poster;
	opt.preload =
		isString(opt.preload) && -1 < ['auto', 'metadata', 'none'].indexOf(opt.preload.trim())
			? opt.preload
			: defaults.options.preload;

	// Control bar options.
	if (opt.controlBar && opt.controlBar instanceof Object && Object.keys(opt.controlBar).length) {
		for (k in opt.controlBar) {
			if (opt.controlBar.hasOwnProperty(k)) {
				opt.controlBar[k] = ifBooleanElse(opt.controlBar[k], defaults.options.controlBar[k]);
			}
		}
	}

	// Corner layers.
	if (opt.cornerLayers && opt.cornerLayers instanceof Object && Object.keys(opt.cornerLayers).length) {
		for (k in opt.cornerLayers) {
			if (opt.cornerLayers.hasOwnProperty(k)) {
				if ('string' === typeof opt.cornerLayers[k]) {
					opt.cornerLayers[k] = '' !== opt.cornerLayers[k] ? opt.cornerLayers[k] : defaults.options.cornerLayers[k];
				} else if (Node.prototype.isPrototypeOf(opt.cornerLayers[k]) || !isNaN(opt.cornerLayers[k])) {
					opt.cornerLayers[k] = opt.cornerLayers[k];
				} else {
					opt.cornerLayers[k] = opt.cornerLayers[k] || defaults.options.cornerLayers[k];
				}
			} else {
				opt.cornerLayers[k] = defaults.options.cornerLayers[k];
			}
		}
	}

	opt.previewSprite = 'object' === typeof opt.previewSprite ? opt.previewSprite : {};

	// Include HTML sources.

	let obj;
	let sources_el = domPlayer.querySelectorAll('source');

	i = 0;
	while (i < sources_el.length) {
		if (void 0 !== sources_el[i].attributes.src) {
			obj = {
				src: sources_el[i].src,
			};

			if (void 0 !== sources_el[i].attributes.type) {
				obj.type = sources_el[i].type;
			}

			x = 0;
			while (x < opt.sources.length && obj.src !== opt.sources[x].src) {
				x += 1;
			}

			if (x >= opt.sources.length) {
				opt.sources.push(obj);
			}
		}

		i += 1;
	}

	// Include HTML subtitle tracks.

	let subs_el = domPlayer.querySelectorAll('track[kind="subtitles"]');

	const subtitles_options = {
		on: opt.subtitles.on,
		default: null,
		languages: [],
	};

	const languages = {};

	function addSubtitle(track) {
		track.src = void 0 !== track.src && null !== track.src ? track.src.toString().trim() : '';
		track.srclang = void 0 !== track.srclang && null !== track.srclang ? track.srclang.toString().trim() : '';

		if (track.src.length && track.srclang.length) {
			track.label = void 0 !== track.label && null !== track.label ? track.label.toString().trim() : track.srclang;

			if (void 0 !== languages[track.srclang]) {
				languages[track.srclang].src = track.src;
				languages[track.srclang].label = track.label;
			} else {
				subtitles_options.languages.push({
					label: track.label,
					src: track.src,
					srclang: track.srclang,
				});

				languages[track.srclang] = subtitles_options.languages[subtitles_options.languages.length - 1];
			}

			if (void 0 !== track.default && null !== track.default) {
				track.default = track.default.toString().trim();

				if (!track.default.length || '1' === track.default || 'true' === track.default) {
					subtitles_options.default = track.srclang;
				}
			}
		}
	}

	i = 0;
	while (i < subs_el.length) {
		addSubtitle({
			src: subs_el[i].getAttribute('src'),
			srclang: subs_el[i].getAttribute('srclang'),
			default: subs_el[i].getAttribute('default'),
			label: subs_el[i].getAttribute('label'),
		});

		i += 1;
	}

	if (opt.subtitles.languages.length) {
		i = 0;

		while (i < opt.subtitles.languages.length) {
			addSubtitle({
				src: opt.subtitles.languages[i].src,
				srclang: opt.subtitles.languages[i].srclang,
				default: opt.subtitles.languages[i].default,
				label: opt.subtitles.languages[i].label,
			});

			i += 1;
		}
	}

	if (null !== opt.subtitles.default && void 0 !== languages[opt.subtitles.default]) {
		subtitles_options.default = opt.subtitles.default;
	}

	if (null === subtitles_options.default && opt.subtitles.languages.length) {
		subtitles_options.default = opt.subtitles.languages[0].srclang;
	}

	opt.subtitles = subtitles_options;

	return opt;
}

/**
 * Construct VideoJs options by player options.
 * @param  {Object} opt   Plugin options.
 * @param  {Object} vjopt Initial VideoJs object.
 * @return {Object}       Final VideoJs object.
 */
function constructVideojsOptions(opt, vjopt) {
	// {
	//     /*autoplay: false,
	//     controls: true,
	//     preload: "auto", // preload: "metadata",
	//     loop: false,
	//     bigPlayButton: true,*/
	//     // poster: "",
	//     // width: "",
	//     // height: "",
	//     // children: {}
	//     controlBar: {
	//         children: [],
	//         // children: {
	//         //     bottomGradientComponent: true,
	//         //     progressControl: true, // (hidden during live playback)
	//         //     leftControls: true,
	//         //     // playbackRateMenuButton: true, // (hidden, unless playback tech supports rate changes)
	//         //     // chaptersButton: true, // (hidden, unless there are relevant tracks)
	//         //     // descriptionsButton: true, // (hidden, unless there are relevant tracks)
	//         //     // subtitlesButton: true, // (hidden, unless there are relevant tracks)
	//         //     // captionsButton: true, // (hidden, unless there are relevant tracks)
	//         //     // audioTrackButton: true, // (hidden, unless there are relevant tracks)
	//         // }
	//         // seekBar: false,
	//         // loadProgressBar: false,
	//         // mouseTimeDisplay: false,
	//         // playProgressBar: false,
	//         // liveDisplay: false, // (hidden during VOD playback)
	//         // remainingTimeDisplay: false,
	//         // customControlSpacer: false, // (has no UI)
	//         // playbackRateMenuButton: true, // (hidden, unless playback tech supports rate changes)
	//         // chaptersButton: true, // (hidden, unless there are relevant tracks)
	//         // descriptionsButton: true, // (hidden, unless there are relevant tracks)
	//         // subtitlesButton: true, // (hidden, unless there are relevant tracks)
	//         // captionsButton: true, // (hidden, unless there are relevant tracks)
	//         // audioTrackButton: true, // (hidden, unless there are relevant tracks)
	//     }
	// }

	vjopt.sources = opt.sources;
	vjopt.loop = opt.loop;
	vjopt.controls = opt.controls;
	vjopt.autoplay = opt.autoplay;
	vjopt.bigPlayButton = opt.bigPlayButton;
	vjopt.poster = opt.poster;
	vjopt.preload = opt.preload;
	vjopt.suppressNotSupportedError = opt.suppressNotSupportedError;

	// console.log( vjopt );
	// console.log( opt );

	return vjopt;
}

/**
 * A wrapper/container class of MediaCMS VideoJs player.
 * @param {DOM Node} domPlayer                 The video element in html.
 * @param {Object} pluginOptions             Plugin (genral player's) options.
 * @param {Object} pluginState               Plugin initial state values.
 * @param {Function} pluginStateUpdateCallback The function will be called on plugin's state values update.
 */
export function MediaPlayer(
	domPlayer,
	pluginOptions,
	pluginState,
	videoResolutions,
	videoPlaybackSpeeds,
	pluginStateUpdateCallback,
	onNextButtonClick,
	onPrevButtonClick
) {
	if (!Node.prototype.isPrototypeOf(domPlayer)) {
		console.error('Invalid player DOM element', domPlayer); // TODO: Validate that element is <video> or <audio>.
		return null;
	}

	function sourcesSrcs(urls) {
		const ret = [];
		let i = 0;
		while (i < urls.length) {
			if (!!urls[i]) {
				ret.push(urls[i]); // @todo: Validate url file extension.
			}
			i += 1;
		}
		return ret;
	}

	function sourcesFormats(formats) {
		const ret = [];
		let i = 0;
		while (i < formats.length) {
			if (!!formats[i]) {
				ret.push(formats[i]); // @todo: Validate format.
			}
			i += 1;
		}
		return ret;
	}

	let k,
		i,
		pluginVideoResolutions = {},
		pluginVideoPlaybackSpeeds = {};

	if (!!videoResolutions) {
		for (k in videoResolutions) {
			if (videoResolutions.hasOwnProperty(k)) {
				if (
					isArray(videoResolutions[k].url) &&
					videoResolutions[k].url.length &&
					isArray(videoResolutions[k].format) &&
					videoResolutions[k].format.length
				) {
					pluginVideoResolutions[k] = {
						title: k,
						src: sourcesSrcs(videoResolutions[k].url),
						format: sourcesFormats(videoResolutions[k].format),
					};
				}
			}
		}
	}

	if (!!videoPlaybackSpeeds) {
		k = 0;
		while (k < videoPlaybackSpeeds.length) {
			pluginVideoPlaybackSpeeds[k] = {
				title: 1 === videoPlaybackSpeeds[k] ? 'Normal' : videoPlaybackSpeeds[k],
				speed: videoPlaybackSpeeds[k].toString(),
			};

			k += 1;
		}
	}
	/*
	 * Filter options value.
	 */

	// console.log( '####################' );
	// console.log( domPlayer );
	// console.log( defaults.options );
	// console.log( Object.keys(pluginOptions) );

	pluginOptions = filterPlayerOptions(
		domPlayer,
		videojs.mergeOptions(
			defaults.options,
			pluginOptions && pluginOptions instanceof Object && Object.keys(pluginOptions).length ? pluginOptions : {}
		)
	);

	// console.log( pluginOptions );
	// console.log( '####################' );

	/*
	 * Filter state value.
	 */

	// console.log( '####################' );
	// console.log( pluginState );

	// console.warn( pluginOptions.subtitles );
	// console.log( pluginState );
	if (null !== pluginOptions.subtitles.default && pluginOptions.subtitles.on) {
		pluginState.theSelectedSubtitleOption = pluginOptions.subtitles.default;
	}
	// console.log( pluginState );

	// console.log( pluginState );
	// console.log( '####################' );

	/*
	 * Initialize videojs player.
	 */

	const passOptions = constructVideojsOptions(pluginOptions, {
		controlBar: {
			children: [],
		},
	});

	this.player = videojs(domPlayer, passOptions);

	/*
	 * Call plugin.
	 */

	this.player.mediaCmsVjsPlugin(
		domPlayer,
		pluginOptions,
		pluginState,
		pluginVideoResolutions,
		pluginVideoPlaybackSpeeds,
		pluginStateUpdateCallback,
		onNextButtonClick,
		onPrevButtonClick
	);

	/*
	 * Public methods.
	 */

	this.isEnded = this.player.mediaCmsVjsPlugin().isEnded;
	this.isFullscreen = this.player.mediaCmsVjsPlugin().isFullscreen;
	this.isTheaterMode = this.player.mediaCmsVjsPlugin().isTheaterMode;

	if (void 0 !== typeof window) {
		window.HELP_IMPROVE_VIDEOJS = false;
	}
}
