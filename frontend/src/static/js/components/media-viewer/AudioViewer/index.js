import React from 'react';
import PropTypes from 'prop-types';

import MediaPlayer from 'mediacms-player/dist/mediacms-player.js';
import 'mediacms-player/dist/mediacms-player.css';

import { SiteContext } from '../../../utils/contexts/';
import { formatInnerLink } from '../../../utils/helpers/';
import { PageStore, MediaPageStore, VideoViewerStore as AudioPlayerStore } from '../../../utils/stores/';
import { VideoViewerActions as AudioPlayerActions } from '../../../utils/actions/';
import { UpNextLoaderView, MediaDurationInfo, PlayerRecommendedMedia } from '../../../utils/classes/';
import { extractAudioFileFormat } from './functions';

import '../VideoViewer.scss';

export default class AudioViewer extends React.PureComponent {
  constructor(props) {
    super(props);

    let mediaData = MediaPageStore.get('media-data');

    this.AudioPlayerData = {};

    this.audioStartedPlaying = false;

    let audioURL = formatInnerLink(mediaData.original_media_url, SiteContext._currentValue.url);

    this.videoSources = [{ src: audioURL, type: extractAudioFileFormat(audioURL) }];

    this.videoPoster = mediaData.poster_url;
    this.videoPoster = this.videoPoster ? this.videoPoster : mediaData.thumbnail_url;
    this.videoPoster = this.videoPoster ? formatInnerLink(this.videoPoster, SiteContext._currentValue.url) : '';

    this.updatePlayerVolume = this.updatePlayerVolume.bind(this);
    this.onAudioEnd = this.onAudioEnd.bind(this);
    this.onAudioRestart = this.onAudioRestart.bind(this);

    PageStore.on('switched_media_auto_play', this.onUpdateMediaAutoPlay.bind(this));

    this.wrapperClick = this.wrapperClick.bind(this);

    const _MediaDurationInfo = new MediaDurationInfo();

    _MediaDurationInfo.update(MediaPageStore.get('media-data').duration);

    this.durationISO8601 = _MediaDurationInfo.ISO8601();
  }

  componentDidMount() {
    if (!this.videoSources.length) {
      console.warn('Audio DEBUG:', "Audio file doesn't exist");
    }

    this.recommendedMedia = MediaPageStore.get('media-data').related_media.length
      ? new PlayerRecommendedMedia(
          MediaPageStore.get('media-data').related_media,
          this.refs.AudioElem.parentNode,
          this.props.inEmbed
        )
      : null;

    this.upNextLoaderView =
      !this.props.inEmbed && MediaPageStore.get('media-data').related_media.length
        ? new UpNextLoaderView(MediaPageStore.get('media-data').related_media[0])
        : null;

    if (document.hasFocus() || 'visible' === document.visibilityState) {
      this.initPlayerInstance();
    } else {
      this.initPlayerInstance = this.initPlayerInstance.bind(this);
      window.addEventListener('focus', this.initPlayerInstance);
      document.addEventListener('visibilitychange', this.initPlayerInstance);
    }
  }

  componentWillUnmount() {
    if (this.recommendedMedia) {
      this.AudioPlayerData.instance.player.off('fullscreenchange', this.recommendedMedia.onResize);
      PageStore.removeListener('window_resize', this.recommendedMedia.onResize);
      AudioPlayerStore.removeListener('changed_viewer_mode', this.recommendedMedia.onResize);
      this.recommendedMedia.destroy();
    }
    videojs(this.refs.AudioElem).dispose();
    this.AudioPlayerData.instance = null;
    delete this.AudioPlayerData.instance;
  }

  initPlayerInstance() {
    window.removeEventListener('focus', this.initPlayerInstance);
    document.removeEventListener('visibilitychange', this.initPlayerInstance);

    this.refs.AudioElem.focus(); // Focus on player before instance init.

    this.initPlayerInstance = null;

    setTimeout(
      function () {
        if (!this.AudioPlayerData.instance) {
          let titleLink = this.props.inEmbed ? document.createElement('a') : null;
          let userThumbLink = this.props.inEmbed ? document.createElement('a') : null;

          if (titleLink) {
            titleLink.setAttribute('class', 'title-link');
            titleLink.setAttribute('href', MediaPageStore.get('media-data').url);
            titleLink.setAttribute('title', MediaPageStore.get('media-data').title);
            titleLink.setAttribute('target', '_blank');
            titleLink.innerHTML = MediaPageStore.get('media-data').title;
          }

          if (userThumbLink) {
            userThumbLink.setAttribute('class', 'user-thumb-link');
            userThumbLink.setAttribute('href', MediaPageStore.get('media-data').author_profile);
            userThumbLink.setAttribute('title', MediaPageStore.get('media-data').author_name);
            userThumbLink.setAttribute('target', '_blank');
            userThumbLink.innerHTML = '<img src="' + MediaPageStore.get('media-author-thumbnail-url') + '" alt="" />';
          }

          let nextLink = null;
          let previousLink = null;

          const playlistId = this.props.inEmbed ? null : MediaPageStore.get('playlist-id');

          if (playlistId) {
            nextLink = MediaPageStore.get('playlist-next-media-url');
            previousLink = MediaPageStore.get('playlist-previous-media-url');
          } else {
            nextLink =
              MediaPageStore.get('media-data').related_media.length && !this.props.inEmbed
                ? MediaPageStore.get('media-data').related_media[0].url
                : null;
          }

          this.AudioPlayerData.instance = new MediaPlayer(
            this.refs.AudioElem,
            {
              sources: this.videoSources,
              poster: this.videoPoster,
              autoplay: !this.props.inEmbed,
              bigPlayButton: true,
              controlBar: {
                fullscreen: false,
                theaterMode: false,
                next: !!nextLink,
                previous: !!previousLink,
              },
              cornerLayers: {
                topLeft: titleLink,
                topRight: this.upNextLoaderView ? this.upNextLoaderView.html() : null,
                bottomLeft: this.recommendedMedia ? this.recommendedMedia.html() : null,
                bottomRight: userThumbLink,
              },
            },
            {
              volume: AudioPlayerStore.get('player-volume'),
              soundMuted: AudioPlayerStore.get('player-sound-muted'),
            },
            null,
            null,
            this.onAudioPlayerStateUpdate.bind(this),
            this.onClickNextButton.bind(this),
            this.onClickPreviousButton.bind(this)
          );

          if (this.upNextLoaderView) {
            this.upNextLoaderView.setVideoJsPlayerElem(this.AudioPlayerData.instance.player.el_);
            this.onUpdateMediaAutoPlay();
          }

          this.refs.AudioElem.parentNode.focus(); // Focus on player.

          this.AudioPlayerData.instance.player.one(
            'play',
            function () {
              this.audioStartedPlaying = true;
            }.bind(this)
          );

          if (this.recommendedMedia) {
            this.recommendedMedia.initWrappers(this.AudioPlayerData.instance.player.el_);

            this.AudioPlayerData.instance.player.one('pause', this.recommendedMedia.init);
            this.AudioPlayerData.instance.player.on('fullscreenchange', this.recommendedMedia.onResize);

            PageStore.on('window_resize', this.recommendedMedia.onResize);
            AudioPlayerStore.on('changed_viewer_mode', this.recommendedMedia.onResize);
          }

          this.AudioPlayerData.instance.player.one('ended', this.onAudioEnd);
        }
      }.bind(this),
      50
    );
  }

  initialDocumentFocus() {
    if (this.refs.AudioElem.parentNode) {
      this.refs.AudioElem.parentNode.focus();
      setTimeout(
        function () {
          this.AudioPlayerData.instance.player.play();
        }.bind(this),
        50
      );
    }
    window.removeEventListener('focus', this.initialDocumentFocus);
    this.initialDocumentFocus = null;
  }

  onClickNextButton() {
    const playlistId = MediaPageStore.get('playlist-id');

    let nextLink;

    if (playlistId) {
      nextLink = MediaPageStore.get('playlist-next-media-url');

      if (null === nextLink) {
        nextLink = MediaPageStore.get('media-data').related_media[0].url;
      }
    } else if (!this.props.inEmbed) {
      nextLink = MediaPageStore.get('media-data').related_media[0].url;
    }

    window.location.href = nextLink;
  }

  onClickPreviousButton() {
    const playlistId = MediaPageStore.get('playlist-id');

    let previousLink;

    if (playlistId) {
      previousLink = MediaPageStore.get('playlist-previous-media-url');

      if (null === previousLink) {
        previousLink = MediaPageStore.get('media-data').related_media[0].url;
      }
    } else if (!this.props.inEmbed) {
      previousLink = MediaPageStore.get('media-data').related_media[0].url;
    }

    window.location.href = previousLink;
  }

  onUpdateMediaAutoPlay() {
    if (this.upNextLoaderView) {
      if (PageStore.get('media-auto-play')) {
        this.upNextLoaderView.showTimerView(this.AudioPlayerData.instance.isEnded());
      } else {
        this.upNextLoaderView.hideTimerView();
      }
    }
  }

  onAudioPlayerStateUpdate(newState) {
    this.updatePlayerVolume(newState.volume, newState.soundMuted);
  }

  onAudioRestart() {
    if (this.recommendedMedia) {
      this.recommendedMedia.updateDisplayType('inline');
      this.AudioPlayerData.instance.player.one('pause', this.recommendedMedia.init);
      this.AudioPlayerData.instance.player.one('ended', this.onAudioEnd);
    }
  }

  onAudioEnd() {
    if (this.recommendedMedia) {
      this.recommendedMedia.updateDisplayType('full');
      this.AudioPlayerData.instance.player.one('playing', this.onAudioRestart);
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
        this.AudioPlayerData.instance.player.one(
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
        this.upNextLoaderView.showTimerView(this.AudioPlayerData.instance.isEnded());
      } else {
        this.upNextLoaderView.hideTimerView();
      }
    }
  }

  updatePlayerVolume(playerVolume, playerSoundMuted) {
    if (AudioPlayerStore.get('player-volume') !== playerVolume) {
      AudioPlayerActions.set_player_volume(playerVolume);
    }
    if (AudioPlayerStore.get('player-sound-muted') !== playerSoundMuted) {
      AudioPlayerActions.set_player_sound_muted(playerSoundMuted);
    }
  }

  wrapperClick(ev) {
    if (ev.target.parentNode === this.refs.videoPlayerWrap) {
      if (!this.AudioPlayerData.instance.player.ended()) {
        if (!this.AudioPlayerData.instance.player.hasStarted_ || this.AudioPlayerData.instance.player.paused()) {
          this.AudioPlayerData.instance.player.play();
        } else {
          this.AudioPlayerData.instance.player.pause();
        }
      }
    }
  }

  render() {
    return (
      <div className="player-container audio-player-container">
        <div className="player-container-inner">
          <div className="video-player" ref="videoPlayerWrap" onClick={this.wrapperClick}>
            <audio tabIndex="1" ref="AudioElem" className="video-js vjs-mediacms native-dimensions"></audio>
          </div>
        </div>
      </div>
    );
  }
}

AudioViewer.defaultProps = {
  inEmbed: false,
};

AudioViewer.propTypes = {
  inEmbed: PropTypes.bool,
};
