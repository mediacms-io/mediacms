import React from 'react';
import PropTypes from 'prop-types';
import { VideoViewerActions } from '../../../utils/actions/';
import { SiteContext, SiteConsumer } from '../../../utils/contexts/';
import { PageStore, MediaPageStore, VideoViewerStore } from '../../../utils/stores/';
import { addClassname, removeClassname, formatInnerLink } from '../../../utils/helpers/';
import { BrowserCache, UpNextLoaderView, MediaDurationInfo } from '../../../utils/classes/';
import {
    orderedSupportedVideoFormats,
    videoAvailableCodecsAndResolutions,
    extractDefaultVideoResolution,
} from './functions';
// import { VideoPlayer, VideoPlayerError } from '../../video-player/VideoPlayer';
import VideoJSEmbed from '../../VideoJS/VideoJSEmbed';

function filterVideoEncoding(encoding_status) {
    switch (encoding_status) {
        case 'running_X':
            MediaPageStore.set('media-load-error-type', 'encodingRunning');
            MediaPageStore.set(
                'media-load-error-message',
                'Media encoding is currently running. Try again in few minutes.'
            );
            break;
        case 'pending_X':
            MediaPageStore.set('media-load-error-type', 'encodingPending');
            MediaPageStore.set('media-load-error-message', 'Media encoding is pending');
            break;
        case 'fail':
            MediaPageStore.set('media-load-error-type', 'encodingFailed');
            MediaPageStore.set('media-load-error-message', 'Media encoding failed');
            break;
    }
}

export default class VideoViewer extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            displayPlayer: false,
        };

        this.videoSources = [];

        filterVideoEncoding(this.props.data.encoding_status);

        if (null !== MediaPageStore.get('media-load-error-type')) {
            this.state.displayPlayer = true;
            return;
        }

        if ('string' === typeof this.props.data.poster_url) {
            this.videoPoster = formatInnerLink(this.props.data.poster_url, this.props.siteUrl);
        } else if ('string' === typeof this.props.data.thumbnail_url) {
            this.videoPoster = formatInnerLink(this.props.data.thumbnail_url, this.props.siteUrl);
        }

        this.videoInfo = videoAvailableCodecsAndResolutions(this.props.data.encodings_info, this.props.data.hls_info);

        const resolutionsKeys = Object.keys(this.videoInfo);

        if (!resolutionsKeys.length) {
            this.videoInfo = null;
        } else {
            let defaultResolution = VideoViewerStore.get('video-quality');

            if (null === defaultResolution || ('Auto' === defaultResolution && void 0 === this.videoInfo['Auto'])) {
                defaultResolution = 720; // Default resolution.
            }

            let defaultVideoResolution = extractDefaultVideoResolution(defaultResolution, this.videoInfo);

            if ('Auto' === defaultResolution && void 0 !== this.videoInfo['Auto']) {
                this.videoSources.push({ src: this.videoInfo['Auto'].url[0] });
            }

            const supportedFormats = orderedSupportedVideoFormats();

            let srcUrl, k;

            k = 0;
            while (k < this.videoInfo[defaultVideoResolution].format.length) {
                if ('hls' === this.videoInfo[defaultVideoResolution].format[k]) {
                    this.videoSources.push({
                        src: this.videoInfo[defaultVideoResolution].url[k],
                    });
                    break;
                }
                k += 1;
            }

            for (k in this.props.data.encodings_info[defaultVideoResolution]) {
                if (this.props.data.encodings_info[defaultVideoResolution].hasOwnProperty(k)) {
                    if (supportedFormats.support[k]) {
                        srcUrl = this.props.data.encodings_info[defaultVideoResolution][k].url;

                        if (!!srcUrl) {
                            srcUrl = formatInnerLink(srcUrl, this.props.siteUrl);

                            this.videoSources.push({
                                src: srcUrl /*.replace("http://", "//").replace("https://", "//")*/,
                                encodings_status: this.props.data.encodings_info[defaultVideoResolution][k].status,
                            });
                        }
                    }
                }
            }

            // console.log( supportedFormats );
            // console.log( this.videoInfo );
            // console.log( defaultVideoResolution );
            // console.log( this.videoSources );
        }

        if (this.videoSources.length) {
            if (
                !this.props.inEmbed &&
                1 === this.videoSources.length &&
                'running' === this.videoSources[0].encodings_status
            ) {
                MediaPageStore.set('media-load-error-type', 'encodingRunning');
                MediaPageStore.set(
                    'media-load-error-message',
                    'Media encoding is currently running. Try again in few minutes.'
                );
                return;
            }
        } else {
            switch (MediaPageStore.get('media-load-error-type')) {
                case 'encodingRunning':
                case 'encodingPending':
                case 'encodingFailed':
                    break;
                default:
                    console.warn('VIDEO DEBUG:', "Video files don't exist");
            }
        }

        PageStore.on('switched_media_auto_play', this.onUpdateMediaAutoPlay.bind(this));

        this.browserCache = new BrowserCache(SiteContext._currentValue.id, 86400); // Keep cache data "fresh" for one day.

        const _MediaDurationInfo = new MediaDurationInfo();

        _MediaDurationInfo.update(this.props.data.duration);

        this.durationISO8601 = _MediaDurationInfo.ISO8601();

        this.playerElem = null;

        this.playerInstance = null;

        this.onPlayerInit = this.onPlayerInit.bind(this);

        this.onClickNext = this.onClickNext.bind(this);
        this.onClickPrevious = this.onClickPrevious.bind(this);
        this.onStateUpdate = this.onStateUpdate.bind(this);

    }

    componentDidMount() {
        if (this.videoSources.length) {

            this.upNextLoaderView =
                !this.props.inEmbed && this.props.data.related_media.length
                    ? new UpNextLoaderView(this.props.data.related_media[0])
                    : null;

            let topLeftHtml = null;

            if (this.props.inEmbed) {
                let titleLink = document.createElement('a');
                let userThumbLink = document.createElement('a');

                topLeftHtml = document.createElement('div');
                topLeftHtml.setAttribute('class', 'media-links-top-left');

                if (titleLink) {
                    titleLink.setAttribute('class', 'title-link');
                    titleLink.setAttribute('href', this.props.data.url);
                    titleLink.setAttribute('title', this.props.data.title);
                    titleLink.setAttribute('target', '_blank');
                    titleLink.innerHTML = this.props.data.title;
                }

                if (userThumbLink) {
                    userThumbLink.setAttribute('class', 'user-thumb-link');
                    userThumbLink.setAttribute(
                        'href',
                        formatInnerLink(this.props.data.author_profile, this.props.siteUrl)
                    );
                    userThumbLink.setAttribute('title', this.props.data.author_name);
                    userThumbLink.setAttribute('target', '_blank');
                    userThumbLink.setAttribute(
                        'style',
                        'background-image:url(' +
                            formatInnerLink(MediaPageStore.get('media-author-thumbnail-url'), this.props.siteUrl) +
                            ')'
                    );
                }

                topLeftHtml.appendChild(userThumbLink);
                topLeftHtml.appendChild(titleLink);
            }

            const mediaUrl = MediaPageStore.get('media-url');

            let bottomRightHTML =
                '<button class="share-video-btn"><i class="material-icons">share</i><span>Share</span></button>';
            bottomRightHTML +=
                '<div class="share-options-wrapper">\
									<div class="share-options">\
										<div class="share-options-inner">\
											<div class="sh-option share-email">\
												<a href="mailto:?body=' +
                mediaUrl +
                '" title=""><span><i class="material-icons">email</i></span><span>Email1</span></a>\
											</div></div>\
									</div>\
								</div>';

            this.cornerLayers = {
                topLeft: topLeftHtml,
                topRight: this.upNextLoaderView ? this.upNextLoaderView.html() : null,
                bottomLeft: this.recommendedMedia ? this.recommendedMedia.html() : null,
                bottomRight: this.props.inEmbed ? bottomRightHTML : null,
            };

            this.setState(
                {
                    displayPlayer: true,
                },
                function () {
                    setTimeout(function () {
                        const shareBtn = document.querySelector('.share-video-btn');
                        const shareWrap = document.querySelector('.share-options-wrapper');
                        const shareInner = document.querySelector('.share-options-inner');
                        if (shareBtn) {
                            shareBtn.addEventListener('click', function (ev) {
                                addClassname(
                                    document.querySelector('.video-js.vjs-mediacms'),
                                    'vjs-visible-share-options'
                                );
                            });
                        }
                        if (shareWrap) {
                            shareWrap.addEventListener('click', function (ev) {
                                if (ev.target === shareInner || ev.target === shareWrap) {
                                    removeClassname(
                                        document.querySelector('.video-js.vjs-mediacms'),
                                        'vjs-visible-share-options'
                                    );
                                }
                            });
                        }
                    }, 1000);
                }
            );
        }
    }

    onClickNext() {
        const playlistId = MediaPageStore.get('playlist-id');

        let nextLink;

        if (playlistId) {
            nextLink = MediaPageStore.get('playlist-next-media-url');

            if (null === nextLink) {
                nextLink = this.props.data.related_media[0].url;
            }
        } else if (!this.props.inEmbed) {
            nextLink = this.props.data.related_media[0].url;
        }

        window.location.href = nextLink;
    }

    onClickPrevious() {
        const playlistId = MediaPageStore.get('playlist-id');

        let previousLink;

        if (playlistId) {
            previousLink = MediaPageStore.get('playlist-previous-media-url');

            if (null === previousLink) {
                previousLink = this.props.data.related_media[0].url;
            }
        } else if (!this.props.inEmbed) {
            previousLink = this.props.data.related_media[0].url;
        }

        window.location.href = previousLink;
    }

    onStateUpdate(newState) {
        if (VideoViewerStore.get('in-theater-mode') !== newState.theaterMode) {
            VideoViewerActions.set_viewer_mode(newState.theaterMode);
        }

        if (VideoViewerStore.get('player-volume') !== newState.volume) {
            VideoViewerActions.set_player_volume(newState.volume);
        }

        if (VideoViewerStore.get('player-sound-muted') !== newState.soundMuted) {
            VideoViewerActions.set_player_sound_muted(newState.soundMuted);
        }

        if (VideoViewerStore.get('video-quality') !== newState.quality) {
            VideoViewerActions.set_video_quality(newState.quality);
        }

        if (VideoViewerStore.get('video-playback-speed') !== newState.playbackSpeed) {
            VideoViewerActions.set_video_playback_speed(newState.playbackSpeed);
        }
    }

    onPlayerInit(instance, elem) {
        this.playerElem = elem;
        this.playerInstance = instance;

        if (this.upNextLoaderView) {
            this.upNextLoaderView.setVideoJsPlayerElem(this.playerInstance.player.el_);
            this.onUpdateMediaAutoPlay();
        }

        if (!this.props.inEmbed) {
            this.playerElem.parentNode.focus(); // Focus on player.
        }
    }

    onUpdateMediaAutoPlay() {
        if (this.upNextLoaderView) {
            if (PageStore.get('media-auto-play')) {
                // non compatible with videojs 8
                // this.upNextLoaderView.showTimerView(this.playerInstance.isEnded());
            } else {
                this.upNextLoaderView.hideTimerView();
            }
        }
    }

    render() {
        let nextLink = null;
        let previousLink = null;

        const playlistId = this.props.inEmbed ? null : MediaPageStore.get('playlist-id');

        if (playlistId) {
            nextLink = MediaPageStore.get('playlist-next-media-url');
            previousLink = MediaPageStore.get('playlist-previous-media-url');
        } else {
            nextLink =
                this.props.data.related_media.length && !this.props.inEmbed
                    ? this.props.data.related_media[0].url
                    : null;
        }

        const previewSprite = !!this.props.data.sprites_url
            ? {
                  url: this.props.siteUrl + '/' + this.props.data.sprites_url.replace(/^\//g, ''),
                  frame: { width: 160, height: 90, seconds: 10 },
              }
            : null;

        return (
            <>
                {/*  {React.createElement(VideoJSEmbed, {
                    data: this.props.data,
                    siteUrl: window.MediaCMS.site.url,
                    onLoad: () => console.log('Video js loaded in VideoViewer'),
                    onError: (error) => console.error('Video js error in VideoViewer:', error),
                })} */}
                <div
                    key={(this.props.inEmbed ? 'embed-' : '') + 'player-container'}
                    className={'player-container' + (this.videoSources.length ? '' : ' player-container-error')}
                    style={this.props.containerStyles}
                    ref="playerContainer"
                >
                    <div
                        className="player-container-inner"
                        ref="playerContainerInner"
                        style={this.props.containerStyles}
                    >
                        {/* this.state.displayPlayer && */ null == MediaPageStore.get('media-load-error-type') ? (
                            <div className="video-player" ref="videoJSPlayerWrapper" key="videoJSPlayerWrapper">
                                <SiteConsumer>
                                    {(site) => {
                                        return React.createElement(VideoJSEmbed, {
                                            data: this.props.data,
                                            useRoundedCorners: site.useRoundedCorners,
                                            version: site.version,
                                            isPlayList: !!MediaPageStore.get('playlist-id'),
                                            playerVolume: this.browserCache.get('player-volume'),
                                            playerSoundMuted: this.browserCache.get('player-sound-muted'),
                                            videoQuality: this.browserCache.get('video-quality'),
                                            videoPlaybackSpeed: parseInt(
                                                this.browserCache.get('video-playback-speed'),
                                                10
                                            ),
                                            inTheaterMode: this.browserCache.get('in-theater-mode'),
                                            siteId: site.id,
                                            siteUrl: site.url,
                                            info: this.videoInfo,
                                            cornerLayers: this.cornerLayers,
                                            sources: this.videoSources,
                                            poster: this.videoPoster,
                                            previewSprite: previewSprite,
                                            subtitlesInfo: this.props.data.subtitles_info,
                                            inEmbed: this.props.inEmbed,
                                            showTitle: this.props.showTitle,
                                            showRelated: this.props.showRelated,
                                            showUserAvatar: this.props.showUserAvatar,
                                            linkTitle: this.props.linkTitle,
                                            urlTimestamp: this.props.timestamp,
                                            hasTheaterMode: !this.props.inEmbed,
                                            hasNextLink: !!nextLink,
                                            nextLink: nextLink,
                                            hasPreviousLink: !!previousLink,
                                            errorMessage: MediaPageStore.get('media-load-error-message'),
                                            onClickNextCallback: this.onClickNext,
                                            onClickPreviousCallback: this.onClickPrevious,
                                            onStateUpdateCallback: this.onStateUpdate,
                                            onPlayerInitCallback: this.onPlayerInit,
                                        });
                                    }}
                                </SiteConsumer>
                            </div>
                        ) : null}
                    </div>
                </div>
            </>
        );
    }
}

VideoViewer.defaultProps = {
    inEmbed: !0,
    showTitle: !0,
    showRelated: !0,
    showUserAvatar: !0,
    linkTitle: !0,
    timestamp: null,
    siteUrl: PropTypes.string.isRequired,
};

VideoViewer.propTypes = {
    inEmbed: PropTypes.bool,
    showTitle: PropTypes.bool,
    showRelated: PropTypes.bool,
    showUserAvatar: PropTypes.bool,
    linkTitle: PropTypes.bool,
    timestamp: PropTypes.number,
};