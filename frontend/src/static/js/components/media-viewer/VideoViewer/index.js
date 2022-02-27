import React from 'react';
import PropTypes from 'prop-types';
import { VideoViewerActions } from '../../../utils/actions/';
import { SiteContext, SiteConsumer } from '../../../utils/contexts/';
import { PageStore, MediaPageStore, VideoViewerStore } from '../../../utils/stores/';
import { addClassname, removeClassname, formatInnerLink } from '../../../utils/helpers/';
import { BrowserCache, UpNextLoaderView, MediaDurationInfo, PlayerRecommendedMedia } from '../../../utils/classes/';
import {
  orderedSupportedVideoFormats,
  videoAvailableCodecsAndResolutions,
  extractDefaultVideoResolution,
} from './functions';
import { VideoPlayer, VideoPlayerError } from '../../video-player/VideoPlayer';

import '../VideoViewer.scss';

function filterVideoEncoding(encoding_status) {
  switch (encoding_status) {
    case 'running':
      MediaPageStore.set('media-load-error-type', 'encodingRunning');
      MediaPageStore.set('media-load-error-message', 'Media encoding is currently running. Try again in few minutes.');
      break;
    case 'pending':
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
          this.videoSources.push({ src: this.videoInfo[defaultVideoResolution].url[k] });
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

    this.onVideoEnd = this.onVideoEnd.bind(this);
    this.onVideoRestart = this.onVideoRestart.bind(this);
  }

  componentDidMount() {
    if (this.videoSources.length) {
      this.recommendedMedia = this.props.data.related_media.length
        ? new PlayerRecommendedMedia(
            this.props.data.related_media,
            this.props.inEmbed,
            !PageStore.get('config-media-item').displayViews
          )
        : null;

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
          userThumbLink.setAttribute('href', formatInnerLink(this.props.data.author_profile, this.props.siteUrl));
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
        '" title=""><span><i class="material-icons">email</i></span><span>Email</span></a>\
											</div>\
											<div class="sh-option share-fb">\
												<a href="https://www.facebook.com/sharer.php?u=' +
        mediaUrl +
        '" title="" target="_blank"><span></span><span>Facebook</span></a>\
											</div>\
											<div class="sh-option share-tw">\
												<a href="https://twitter.com/intent/tweet?url=' +
        mediaUrl +
        '" title="" target="_blank"><span></span><span>Twitter</span></a>\
											</div>\
											<div class="sh-option share-whatsapp">\
												<a href="whatsapp://send?text=' +
        mediaUrl +
        '" title="" target="_blank" data-action="share/whatsapp/share"><span></span><span>WhatsApp</span></a>\
											</div>\
											<div class="sh-option share-telegram">\
												<a href="https://t.me/share/url?url=' +
        mediaUrl +
        '&amp;text=' +
        this.props.data.title +
        '" title="" target="_blank"><span></span><span>Telegram</span></a>\
											</div>\
											<div class="sh-option share-linkedin">\
													<a href="https://www.linkedin.com/shareArticle?mini=true&amp;url=' +
        mediaUrl +
        '" title="" target="_blank"><span></span><span>LinkedIn</span></a>\
											</div>\
											<div class="sh-option share-reddit">\
												<a href="https://reddit.com/submit?url=' +
        mediaUrl +
        '&amp;title=' +
        this.props.data.title +
        '" title="" target="_blank"><span></span><span>reddit</span></a>\
											</div>\
											<div class="sh-option share-tumblr">\
												<a href="https://www.tumblr.com/widgets/share/tool?canonicalUrl=' +
        mediaUrl +
        '&amp;title=' +
        this.props.data.title +
        '" title="" target="_blank"><span></span><span>Tumblr</span></a>\
											</div>\
											<div class="sh-option share-pinterest">\
												<a href="http://pinterest.com/pin/create/link/?url=' +
        mediaUrl +
        '" title="" target="_blank"><span></span><span>Pinterest</span></a>\
											</div>\
											<div class="sh-option share-more">\
												<a href="' +
        mediaUrl +
        '" title="More" target="_blank"><span><i class="material-icons">more_horiz</i></span><span></span></a>\
											</div>\
										</div>\
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
                addClassname(document.querySelector('.video-js.vjs-mediacms'), 'vjs-visible-share-options');
              });
            }
            if (shareWrap) {
              shareWrap.addEventListener('click', function (ev) {
                if (ev.target === shareInner || ev.target === shareWrap) {
                  removeClassname(document.querySelector('.video-js.vjs-mediacms'), 'vjs-visible-share-options');
                }
              });
            }
          }, 1000);
        }
      );
    }
  }

  componentWillUnmount() {
    this.unsetRecommendedMedia();
  }

  initRecommendedMedia() {
    if (null === this.recommendedMedia) {
      return;
    }

    if (!this.props.inEmbed) {
      this.recommendedMedia.init();
    }

    this.playerInstance.player.on('fullscreenchange', this.recommendedMedia.onResize);

    PageStore.on('window_resize', this.recommendedMedia.onResize);

    VideoViewerStore.on('changed_viewer_mode', this.recommendedMedia.onResize);
  }

  unsetRecommendedMedia() {
    if (null === this.recommendedMedia) {
      return;
    }
    this.playerInstance.player.off('fullscreenchange', this.recommendedMedia.onResize);
    PageStore.removeListener('window_resize', this.recommendedMedia.onResize);
    VideoViewerStore.removeListener('changed_viewer_mode', this.recommendedMedia.onResize);
    this.recommendedMedia.destroy();
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

    if (null !== this.recommendedMedia) {
      this.recommendedMedia.initWrappers(this.playerElem.parentNode);

      if (this.props.inEmbed) {
        this.playerInstance.player.one('pause', this.recommendedMedia.init);
        this.initRecommendedMedia();
      }
    }

    this.playerInstance.player.one('ended', this.onVideoEnd);
  }

  onVideoRestart() {
    if (null !== this.recommendedMedia) {
      this.recommendedMedia.updateDisplayType('inline');

      if (this.props.inEmbed) {
        this.playerInstance.player.one('pause', this.recommendedMedia.init);
      }

      this.playerInstance.player.one('ended', this.onVideoEnd);
    }
  }

  onVideoEnd() {
    if (null !== this.recommendedMedia) {
      if (!this.props.inEmbed) {
        this.initRecommendedMedia();
      }

      this.recommendedMedia.updateDisplayType('full');
      this.playerInstance.player.one('playing', this.onVideoRestart);
    }

    const playlistId = this.props.inEmbed ? null : MediaPageStore.get('playlist-id');

    if (playlistId) {
      const moreMediaEl = document.querySelector('.video-player .more-media');
      const actionsAnimEl = document.querySelector('.video-player .vjs-actions-anim');

      this.upNextLoaderView.cancelTimer();

      const nextMediaUrl = MediaPageStore.get('playlist-next-media-url');

      if (nextMediaUrl) {
        if (moreMediaEl) {
          moreMediaEl.style.display = 'none';
        }

        if (actionsAnimEl) {
          actionsAnimEl.style.display = 'none';
        }

        window.location.href = nextMediaUrl;
      }

      this.upNextLoaderView.hideTimerView();

      return;
    }

    if (this.upNextLoaderView) {
      if (PageStore.get('media-auto-play')) {
        this.upNextLoaderView.startTimer();
        this.playerInstance.player.one(
          'play',
          function () {
            this.upNextLoaderView.cancelTimer();
          }.bind(this)
        );
      } else {
        this.upNextLoaderView.cancelTimer();
      }
    }
  }

  onUpdateMediaAutoPlay() {
    if (this.upNextLoaderView) {
      if (PageStore.get('media-auto-play')) {
        this.upNextLoaderView.showTimerView(this.playerInstance.isEnded());
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
        this.props.data.related_media.length && !this.props.inEmbed ? this.props.data.related_media[0].url : null;
    }

    const previewSprite = !!this.props.data.sprites_url
      ? {
          url: this.props.siteUrl + '/' + this.props.data.sprites_url.replace(/^\//g, ''),
          frame: { width: 160, height: 90, seconds: 10 },
        }
      : null;

    return (
      <div
        key={(this.props.inEmbed ? 'embed-' : '') + 'player-container'}
        className={'player-container' + (this.videoSources.length ? '' : ' player-container-error')}
        style={this.props.containerStyles}
        ref="playerContainer"
      >
        <div className="player-container-inner" ref="playerContainerInner" style={this.props.containerStyles}>
          {this.state.displayPlayer && null !== MediaPageStore.get('media-load-error-type') ? (
            <VideoPlayerError errorMessage={MediaPageStore.get('media-load-error-message')} />
          ) : null}

          {this.state.displayPlayer && null == MediaPageStore.get('media-load-error-type') ? (
            <div className="video-player" ref="videoPlayerWrapper" key="videoPlayerWrapper">
              <SiteConsumer>
                {(site) => (
                  <VideoPlayer
                    playerVolume={this.browserCache.get('player-volume')}
                    playerSoundMuted={this.browserCache.get('player-sound-muted')}
                    videoQuality={this.browserCache.get('video-quality')}
                    videoPlaybackSpeed={parseInt(this.browserCache.get('video-playback-speed'), 10)}
                    inTheaterMode={this.browserCache.get('in-theater-mode')}
                    siteId={site.id}
                    siteUrl={site.url}
                    info={this.videoInfo}
                    cornerLayers={this.cornerLayers}
                    sources={this.videoSources}
                    poster={this.videoPoster}
                    previewSprite={previewSprite}
                    subtitlesInfo={this.props.data.subtitles_info}
                    enableAutoplay={!this.props.inEmbed}
                    inEmbed={this.props.inEmbed}
                    hasTheaterMode={!this.props.inEmbed}
                    hasNextLink={!!nextLink}
                    hasPreviousLink={!!previousLink}
                    errorMessage={MediaPageStore.get('media-load-error-message')}
                    onClickNextCallback={this.onClickNext}
                    onClickPreviousCallback={this.onClickPrevious}
                    onStateUpdateCallback={this.onStateUpdate}
                    onPlayerInitCallback={this.onPlayerInit}
                  />
                )}
              </SiteConsumer>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

VideoViewer.defaultProps = {
  inEmbed: !0,
  siteUrl: PropTypes.string.isRequired,
};

VideoViewer.propTypes = {
  inEmbed: PropTypes.bool,
};

function findGetParameter(parameterName) {
  let result = null;
  let tmp = [];
  var items = location.search.substr(1).split('&');
  for (let i = 0; i < items.length; i++) {
    tmp = items[i].split('=');
    if (tmp[0] === parameterName) {
      result = decodeURIComponent(tmp[1]);
    }
  }
  return result;
}

function handleCanvas(canvasElem) {
  const Player = videojs(canvasElem);
  Player.playsinline(true);
  // TODO: Make them work only in embedded player...?
  if (findGetParameter('muted') == 1) {
    Player.muted(true);
  }
  if (findGetParameter('time') >= 0) {
    Player.currentTime(findGetParameter('time'));
  }
  if (findGetParameter('autoplay') == 1) {
    Player.play();
  }
}

const observer = new MutationObserver(function (mutations, me) {
  const canvas = document.querySelector('.video-js.vjs-mediacms video');
  if (canvas) {
    handleCanvas(canvas);
    me.disconnect();
    return;
  }
});

observer.observe(document, {
  childList: true,
  subtree: true,
});
