import EventEmitter from 'events';
import { exportStore, getRequest, postRequest, putRequest, deleteRequest, csrfToken } from '../helpers';
import { config as mediacmsConfig } from '../settings/config.js';

import UrlParse from 'url-parse';

import PageStore from './PageStore.js';

function extractPlaylistId() {
  let playlistId = null;

  const getParamsString = window.location.search;

  if ('' !== getParamsString) {
    let tmp = getParamsString.split('?');

    if (2 === tmp.length) {
      tmp = tmp[1].split('&');

      let x;

      let i = 0;
      while (i < tmp.length) {
        x = tmp[i].split('=');

        if ('pl' === x[0]) {
          if (2 === x.length) {
            playlistId = x[1];
          }

          break;
        }

        i += 1;
      }
    }
  }

  return playlistId;
}

const MediaPageStoreData = {};

class MediaPageStore extends EventEmitter {
  constructor() {
    super();

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    this._MEDIA = null;

    this.pagePlaylistId = null;
    this.pagePlaylistData = null;
    this.userList = null;

    MediaPageStoreData[
      Object.defineProperty(this, 'id', { value: 'MediaPageStoreData_' + Object.keys(MediaPageStoreData).length }).id
    ] = {
      likedMedia: false,
      dislikedMedia: false,
      reported_times: 0,
      while: {
        deleteMedia: false,
        submitComment: false,
        deleteCommentId: null,
      },
    };

    this.removeMediaResponse = this.removeMediaResponse.bind(this);
    this.removeMediaFail = this.removeMediaFail.bind(this);

    this.submitCommentFail = this.submitCommentFail.bind(this);
    this.submitCommentResponse = this.submitCommentResponse.bind(this);

    this.removeCommentFail = this.removeCommentFail.bind(this);
    this.removeCommentResponse = this.removeCommentResponse.bind(this);
  }

  loadData() {
    if (!MediaPageStoreData[this.id].mediaId) {
      let urlParams = (function () {
        let ret = new UrlParse(window.location.href).query;
        if (!ret) {
          ret = [];
        } else {
          ret = ret.substring(1);
          ret.split('&');
          ret = ret.length ? ret.split('=') : [];
        }
        return ret;
      })();

      if (urlParams.length) {
        let i = 0;
        while (i < urlParams.length) {
          if ('m' === urlParams[i]) {
            // NOTE: "m" => media id/token.
            MediaPageStoreData[this.id].mediaId = urlParams[i + 1];
          }
          i += 2;
        }
      }
    }

    if (!MediaPageStoreData[this.id].mediaId) {
      console.warn('Invalid media id:', MediaPageStoreData[this.id].mediaId);
      return false;
    }

    this.mediaAPIUrl = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId;
    this.dataResponse = this.dataResponse.bind(this);
    this.dataErrorResponse = this.dataErrorResponse.bind(this);
    getRequest(this.mediaAPIUrl, !1, this.dataResponse, this.dataErrorResponse);
  }

  loadPlaylistData() {
    const playlistApiUrl = this.mediacms_config.api.playlists + '/' + this.pagePlaylistId;
    this.playlistDataResponse = this.playlistDataResponse.bind(this);
    this.playlistDataErrorResponse = this.playlistDataErrorResponse.bind(this);
    getRequest(playlistApiUrl, !1, this.playlistDataResponse, this.playlistDataErrorResponse);
  }

  playlistDataResponse(response) {
    if (response && response.data) {
      let validPlaylistMedia = false;

      let i = 0;
      while (i < response.data.playlist_media.length) {
        if (MediaPageStoreData[this.id].mediaId === response.data.playlist_media[i].friendly_token) {
          validPlaylistMedia = true;
          break;
        }

        i += 1;
      }

      if (validPlaylistMedia) {
        this.pagePlaylistData = response.data;
      } else {
        this.pagePlaylistId = null;
      }

      this.emit('loaded_viewer_playlist_data');
    } else {
      this.pagePlaylistId = null;
    }

    this.emit('loaded_page_playlist_data');
  }

  playlistDataErrorResponse(response) {
    this.emit('loaded_viewer_playlist_error');
    this.emit('loaded_page_playlist_data');
  }

  loadComments() {
    this.commentsAPIUrl = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/comments';
    this.commentsResponse = this.commentsResponse.bind(this);
    getRequest(this.commentsAPIUrl, !1, this.commentsResponse);
  }

  loadUsers() {
    this.usersAPIUrl = this.mediacms_config.api.users;
    this.usersResponse = this.usersResponse.bind(this);
    getRequest(this.usersAPIUrl, !1, this.usersResponse);
  }

  loadPlaylists() {
    if (!this.mediacms_config.member.can.saveMedia) {
      return;
    }

    this.playlistsAPIUrl = this.mediacms_config.api.user.playlists + this.mediacms_config.member.username;

    this.playlistsResponse = this.playlistsResponse.bind(this);

    getRequest(this.playlistsAPIUrl, !1, this.playlistsResponse);
  }

  dataResponse(response) {
    if (response && response.data) {
      MediaPageStoreData[this.id].data = response.data;
      MediaPageStoreData[this.id].reported_times = !!MediaPageStoreData[this.id].data.reported_times;

      switch (this.get('media-type')) {
        case 'video':
        case 'audio':
          this.emit('loaded_video_data');
          break;
        case 'image':
          this.emit('loaded_' + this.get('media-type') + '_data');
          break;
      }

      this.emit('loaded_media_data');
    }

    this.loadPlaylists();
    if (MediaCMS.features.media.actions.comment_mention === true) {
      this.loadUsers();
    }

    if (this.mediacms_config.member.can.readComment) {
      this.loadComments();
    }
  }

  dataErrorResponse(response) {
    if (void 0 !== response.type) {
      switch (response.type) {
        case 'network':
        case 'private':
        case 'unavailable':
          MediaPageStoreData[this.id].loadErrorType = response.type;
          MediaPageStoreData[this.id].loadErrorMessage =
            void 0 !== response.message ? response.message : "Αn error occurred while loading the media's data";
          this.emit('loaded_media_error');
          break;
      }
    }
  }

  commentsResponse(response) {
    if (response && response.data) {
      MediaPageStoreData[this.id].comments = response.data.count ? response.data.results : [];
      this.emit('comments_load');
    }
  }

  usersResponse(response) {
    if (response && response.data) {
      MediaPageStoreData.userList = response.data.count ? response.data.results : [];
      this.emit('users_load');
    }
  }

  playlistsResponse(response) {
    if (response && response.data) {
      let tmp_playlists = response.data.count ? response.data.results : [];

      MediaPageStoreData[this.id].playlists = [];

      let i = 0;
      let cntr = 0;

      while (i < tmp_playlists.length) {
        (function (pos) {
          let _this = this;

          if (tmp_playlists[pos].user === this.mediacms_config.member.username) {
            let playlistsIndex = MediaPageStoreData[_this.id].playlists.length;

            MediaPageStoreData[_this.id].playlists[playlistsIndex] = {
              playlist_id: (function (_url_) {
                let ret = _url_.split('/');
                return 1 < ret.length ? ret[ret.length - 1] : null;
              })(tmp_playlists[pos].url),
              title: tmp_playlists[pos].title,
              description: tmp_playlists[pos].description,
              add_date: tmp_playlists[pos].add_date,
            };

            getRequest(
              this.mediacms_config.site.url + '/' + tmp_playlists[pos].api_url.replace(/^\//g, ''),
              !1,
              function (resp) {
                if (!!resp && !!resp.data) {
                  MediaPageStoreData[_this.id].playlists[playlistsIndex].media_list = [];

                  let f = 0;
                  let arr;

                  while (f < resp.data.playlist_media.length) {
                    arr = resp.data.playlist_media[f].url.split('m=');
                    if (2 === arr.length) {
                      MediaPageStoreData[_this.id].playlists[playlistsIndex].media_list.push(arr[1]);
                    }
                    f += 1;
                  }
                }

                cntr += 1;

                if (cntr === tmp_playlists.length) {
                  this.emit('playlists_load');
                }
              }
            );
          }
        }.bind(this)(i));

        i += 1;
      }
    }
  }

  requestMediaLike() {
    if (!MediaPageStoreData[this.id].mediaId) {
      console.warn('Invalid media id:', MediaPageStoreData[this.id].mediaId);
      return false;
    }

    const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';

    this.likeActionResponse = this.likeActionResponse.bind(this);

    postRequest(
      url,
      {
        type: 'like',
        // `headers` are custom headers to be sent
      },
      {
        headers: {
          'X-CSRFToken': csrfToken(),
        },
      },
      false,
      this.likeActionResponse,
      function () {
        this.emit('liked_media_failed_request');
      }.bind(this)
    );
  }

  likeActionResponse(response) {
    if (response) {
      if (response instanceof Error) {
      } else if (response.data) {
        MediaPageStoreData[this.id].likedMedia = true;
        this.emit('liked_media');
      }
    }
  }

  requestMediaDislike() {
    if (!MediaPageStoreData[this.id].mediaId) {
      console.warn('Invalid media id:', MediaPageStoreData[this.id].mediaId);
      return false;
    }

    const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';
    this.dislikeActionResponse = this.dislikeActionResponse.bind(this);
    postRequest(
      url,
      {
        type: 'dislike',
      },
      {
        headers: {
          'X-CSRFToken': csrfToken(),
        },
      },
      false,
      this.dislikeActionResponse,
      function () {
        this.emit('disliked_media_failed_request');
      }.bind(this)
    );
  }

  dislikeActionResponse(response) {
    if (response) {
      if (response instanceof Error) {
      } else if (response.data) {
        MediaPageStoreData[this.id].dislikedMedia = true;
        this.emit('disliked_media');
      }
    }
  }

  requestMediaReport(descr) {
    if (!MediaPageStoreData[this.id].mediaId) {
      console.warn('Invalid media id:', MediaPageStoreData[this.id].mediaId);
      return false;
    }

    const url = this.mediacms_config.api.media + '/' + MediaPageStoreData[this.id].mediaId + '/actions';
    this.reportActionResponse = this.reportActionResponse.bind(this);
    postRequest(
      url,
      {
        type: 'report',
        extra_info: descr,
      },
      {
        headers: {
          'X-CSRFToken': csrfToken(),
        },
      },
      false,
      this.reportActionResponse,
      this.reportActionResponse
    );
  }

  reportActionResponse(response) {
    if (response) {
      if (response instanceof Error) {
      } else if (response.data) {
        MediaPageStoreData[this.id].reported_times += 1;
        this.emit('reported_media');
      }
    }
  }

  set(type, value) {
    switch (type) {
      case 'media-load-error-type':
        MediaPageStoreData[this.id].loadErrorType = value;
        break;
      case 'media-load-error-message':
        MediaPageStoreData[this.id].loadErrorMessage = value;
        break;
    }
  }

  get(type) {
    let tmp,
      activeItem,
      browserCache,
      i,
      r = null;
    switch (type) {
      case 'users':
        r = MediaPageStoreData.userList || [];
      break;
      case 'playlists':
        r = MediaPageStoreData[this.id].playlists || [];
        break;
      case 'media-load-error-type':
        r = void 0 !== MediaPageStoreData[this.id].loadErrorType ? MediaPageStoreData[this.id].loadErrorType : null;
        break;
      case 'media-load-error-message':
        r =
          void 0 !== MediaPageStoreData[this.id].loadErrorMessage ? MediaPageStoreData[this.id].loadErrorMessage : null;
        break;
      case 'media-comments':
        r = MediaPageStoreData[this.id].comments || [];
        break;
      case 'media-data':
        r = MediaPageStoreData[this.id].data || null;
        break;
      case 'media-id':
        r = MediaPageStoreData[this.id].mediaId;
        break;
      case 'media-url':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.url
            ? MediaPageStoreData[this.id].data.url
            : 'N/A';
        break;
      case 'media-edit-subtitle-url':
        r =
          void 0 !== MediaPageStoreData[this.id].data &&
          'string' === typeof MediaPageStoreData[this.id].data.add_subtitle_url
            ? MediaPageStoreData[this.id].data.add_subtitle_url
            : null;
        break;
      case 'media-likes':
        tmp = MediaPageStoreData[this.id].likedMedia ? 1 : 0;
        if (tmp) {
          r =
            void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.likes
              ? MediaPageStoreData[this.id].data.likes + tmp
              : tmp;
        } else {
          r =
            void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.likes
              ? MediaPageStoreData[this.id].data.likes
              : 'N/A';
        }
        break;
      case 'media-dislikes':
        tmp = MediaPageStoreData[this.id].dislikedMedia ? 1 : 0;
        if (tmp) {
          r =
            void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.dislikes
              ? MediaPageStoreData[this.id].data.dislikes + tmp
              : tmp;
        } else {
          r =
            void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.dislikes
              ? MediaPageStoreData[this.id].data.dislikes
              : 'N/A';
        }
        break;
      case 'media-summary':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.summary
            ? MediaPageStoreData[this.id].data.summary
            : null;
        break;
      case 'media-categories':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.categories_info
            ? MediaPageStoreData[this.id].data.categories_info
            : [];
        break;
      case 'media-tags':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.tags_info
            ? MediaPageStoreData[this.id].data.tags_info
            : [];
        break;
      case 'media-type':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.media_type
            ? MediaPageStoreData[this.id].data.media_type
            : null;
        break;
      case 'media-original-url':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.original_media_url
            ? MediaPageStoreData[this.id].data.original_media_url
            : null;
        break;
      case 'media-thumbnail-url':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.thumbnail_url
            ? MediaPageStoreData[this.id].data.thumbnail_url
            : null;
        break;
      case 'user-liked-media':
        r = MediaPageStoreData[this.id].likedMedia;
        break;
      case 'user-disliked-media':
        r = MediaPageStoreData[this.id].dislikedMedia;
        break;
      case 'media-author-thumbnail-url':
        r =
          void 0 !== MediaPageStoreData[this.id].data && void 0 !== MediaPageStoreData[this.id].data.author_thumbnail
            ? this.mediacms_config.site.url +
              '/' +
              MediaPageStoreData[this.id].data.author_thumbnail.replace(/^\//g, '')
            : null;
        break;
      case 'playlist-data':
        r = this.pagePlaylistData;
        break;
      case 'playlist-id':
        r = this.pagePlaylistId;
        break;
      case 'playlist-next-media-url':
        if (!this.pagePlaylistData) {
          break;
        }

        activeItem = 0;
        i = 0;
        while (i < this.pagePlaylistData.playlist_media.length) {
          if (MediaPageStoreData[this.id].mediaId === this.pagePlaylistData.playlist_media[i].friendly_token) {
            activeItem = i;
            break;
          }

          i += 1;
        }

        let nextItem = activeItem + 1;

        if (nextItem === this.pagePlaylistData.playlist_media.length) {
          browserCache = PageStore.get('browser-cache');
          if (true === browserCache.get('loopPlaylist[' + this.pagePlaylistId + ']')) {
            nextItem = 0;
          }
        }

        if (void 0 !== this.pagePlaylistData.playlist_media[nextItem]) {
          r = this.pagePlaylistData.playlist_media[nextItem].url + '&pl=' + this.pagePlaylistId;
        }

        break;
      case 'playlist-previous-media-url':
        if (!this.pagePlaylistData) {
          break;
        }

        activeItem = 0;
        i = 0;
        while (i < this.pagePlaylistData.playlist_media.length) {
          if (MediaPageStoreData[this.id].mediaId === this.pagePlaylistData.playlist_media[i].friendly_token) {
            activeItem = i;
            break;
          }

          i += 1;
        }

        let previousItem = activeItem - 1;

        if (0 === activeItem) {
          previousItem = null;

          browserCache = PageStore.get('browser-cache');

          if (true === browserCache.get('loopPlaylist[' + this.pagePlaylistId + ']')) {
            previousItem = this.pagePlaylistData.playlist_media.length - 1;
          }
        }

        if (void 0 !== this.pagePlaylistData.playlist_media[previousItem]) {
          r = this.pagePlaylistData.playlist_media[previousItem].url + '&pl=' + this.pagePlaylistId;
        }

        break;
    }
    return r;
  }

  isVideo() {
    return 'video' === this.get('media-type') || 'audio' === this.get('media-type');
  }

  onPlaylistCreationCompleted(response) {
    if (response && response.data) {
      this.emit('playlist_creation_completed', response.data);
    }
  }

  onPlaylistCreationFailed() {
    this.emit('playlist_creation_failed');
  }

  onPlaylistMediaAdditionCompleted(playlist_id, response) {
    if (response) {
      let i = 0;
      while (i < MediaPageStoreData[this.id].playlists.length) {
        if (playlist_id === MediaPageStoreData[this.id].playlists[i].playlist_id) {
          MediaPageStoreData[this.id].playlists[i].media_list.push(MediaPageStoreData[this.id].mediaId);
          break;
        }
        i += 1;
      }
      this.emit('media_playlist_addition_completed', playlist_id);
    }
  }

  onPlaylistMediaAdditionFailed(playlist_id, response) {
    this.emit('media_playlist_addition_failed');
  }

  onPlaylistMediaRemovalCompleted(playlist_id, response) {
    if (response) {
      let j, new_playlist_media;
      let i = 0;
      while (i < MediaPageStoreData[this.id].playlists.length) {
        if (playlist_id === MediaPageStoreData[this.id].playlists[i].playlist_id) {
          new_playlist_media = [];
          j = 0;
          while (j < MediaPageStoreData[this.id].playlists[i].media_list.length) {
            if (MediaPageStoreData[this.id].mediaId !== MediaPageStoreData[this.id].playlists[i].media_list[j]) {
              new_playlist_media.push(MediaPageStoreData[this.id].playlists[i].media_list[j]);
            }
            j += 1;
          }
          MediaPageStoreData[this.id].playlists[i].media_list = new_playlist_media;

          break;
        }
        i += 1;
      }
      this.emit('media_playlist_removal_completed', playlist_id);
    }
  }

  onPlaylistMediaRemovalFailed(playlist_id, response) {
    this.emit('media_playlist_removal_failed');
  }

  actions_handler(action) {
    switch (action.type) {
      case 'LOAD_MEDIA_DATA':
        MediaPageStoreData[this.id].mediaId = window.MediaCMS.mediaId || MediaPageStoreData[this.id].mediaId;

        this.pagePlaylistId = extractPlaylistId();

        if (this.pagePlaylistId) {
          this.loadPlaylistData();
          this.loadData();
        } else {
          this.emit('loaded_page_playlist_data');
          this.loadData();
        }

        break;
      case 'LIKE_MEDIA':
        if (!MediaPageStoreData[this.id].likedMedia && !MediaPageStoreData[this.id].dislikedMedia) {
          this.requestMediaLike();
        }
        break;
      case 'DISLIKE_MEDIA':
        if (!MediaPageStoreData[this.id].likedMedia && !MediaPageStoreData[this.id].dislikedMedia) {
          this.requestMediaDislike();
        }
        break;
      case 'REPORT_MEDIA':
        if (!MediaPageStoreData[this.id].reported_times) {
          if ('' !== action.reportDescription) {
            this.requestMediaReport(action.reportDescription);
          }
        }
        break;
      case 'COPY_SHARE_LINK':
        if (action.inputElement instanceof HTMLElement) {
          action.inputElement.select();
          document.execCommand('copy');
          this.emit('copied_media_link');
        }
        break;
      case 'COPY_EMBED_MEDIA_CODE':
        if (action.inputElement instanceof HTMLElement) {
          action.inputElement.select();
          document.execCommand('copy');
          this.emit('copied_embed_media_code');
        }
        break;
      case 'REMOVE_MEDIA':
        if (MediaPageStoreData[this.id].while.deleteMedia) {
          return;
        }
        MediaPageStoreData[this.id].while.deleteMedia = true;
        deleteRequest(
          this.mediaAPIUrl,
          { headers: { 'X-CSRFToken': csrfToken() } },
          false,
          this.removeMediaResponse,
          this.removeMediaFail
        );
        break;
      case 'SUBMIT_COMMENT':
        if (MediaPageStoreData[this.id].while.submitComment) {
          return;
        }

        MediaPageStoreData[this.id].while.submitComment = true;

        postRequest(
          this.commentsAPIUrl,
          { text: action.commentText },
          { headers: { 'X-CSRFToken': csrfToken() } },
          false,
          this.submitCommentResponse,
          this.submitCommentFail
        );
        break;
      case 'DELETE_COMMENT':
        if (null !== MediaPageStoreData[this.id].while.deleteCommentId) {
          return;
        }

        MediaPageStoreData[this.id].while.deleteCommentId = action.commentId;
        deleteRequest(
          this.commentsAPIUrl + '/' + action.commentId,
          { headers: { 'X-CSRFToken': csrfToken() } },
          false,
          this.removeCommentResponse,
          this.removeCommentFail
        );
        break;
      case 'CREATE_PLAYLIST':
        postRequest(
          this.mediacms_config.api.playlists,
          {
            title: action.playlist_data.title,
            description: action.playlist_data.description,
          },
          {
            headers: {
              'X-CSRFToken': csrfToken(),
            },
          },
          false,
          this.onPlaylistCreationCompleted.bind(this),
          this.onPlaylistCreationFailed.bind(this)
        );
        break;
      case 'ADD_MEDIA_TO_PLAYLIST':
        putRequest(
          this.mediacms_config.api.playlists + '/' + action.playlist_id,
          {
            type: 'add',
            media_friendly_token: action.media_id,
          },
          {
            headers: {
              'X-CSRFToken': csrfToken(),
            },
          },
          false,
          this.onPlaylistMediaAdditionCompleted.bind(this, action.playlist_id),
          this.onPlaylistMediaAdditionFailed.bind(this, action.playlist_id)
        );
        break;
      case 'REMOVE_MEDIA_FROM_PLAYLIST':
        putRequest(
          this.mediacms_config.api.playlists + '/' + action.playlist_id,
          {
            type: 'remove',
            media_friendly_token: action.media_id,
          },
          {
            headers: {
              'X-CSRFToken': csrfToken(),
            },
          },
          false,
          this.onPlaylistMediaRemovalCompleted.bind(this, action.playlist_id),
          this.onPlaylistMediaRemovalFailed.bind(this, action.playlist_id)
        );
        break;
      case 'APPEND_NEW_PLAYLIST':
        MediaPageStoreData[this.id].playlists.push(action.playlist_data);
        this.emit('playlists_load');
        break;
    }
  }

  removeMediaResponse(response) {
    if (response && 204 === response.status) {
      this.emit('media_delete', MediaPageStoreData[this.id].mediaId);
    }
  }

  removeMediaFail() {
    this.emit('media_delete_fail', MediaPageStoreData[this.id].mediaId);
    setTimeout(
      function (ins) {
        MediaPageStoreData[ins.id].while.deleteMedia = null;
      },
      100,
      this
    );
  }

  removeCommentFail(err) {
    this.emit('comment_delete_fail', MediaPageStoreData[this.id].while.deleteCommentId);
    setTimeout(
      function (ins) {
        MediaPageStoreData[ins.id].while.deleteCommentId = null;
      },
      100,
      this
    );
  }

  removeCommentResponse(response) {
    if (response && 204 === response.status) {
      let k;
      let newComments = [];
      for (k in MediaPageStoreData[this.id].comments) {
        if (MediaPageStoreData[this.id].comments.hasOwnProperty(k)) {
          if (MediaPageStoreData[this.id].while.deleteCommentId !== MediaPageStoreData[this.id].comments[k].uid) {
            newComments.push(MediaPageStoreData[this.id].comments[k]);
          }
        }
      }
      MediaPageStoreData[this.id].comments = newComments;
      newComments = null;

      this.emit('comment_delete', MediaPageStoreData[this.id].while.deleteCommentId);
    }
    setTimeout(
      function (ins) {
        MediaPageStoreData[ins.id].while.deleteCommentId = null;
      },
      100,
      this
    );
  }

  submitCommentFail(err) {
    this.emit('comment_submit_fail');
    setTimeout(
      function (ins) {
        MediaPageStoreData[ins.id].while.submitComment = false;
      },
      100,
      this
    );
  }

  submitCommentResponse(response) {
    if (response && 201 === response.status && response.data && Object.keys(response.data)) {
      MediaPageStoreData[this.id].comments.push(response.data);
      this.emit('comment_submit', response.data.uid);
    }
    setTimeout(
      function (ins) {
        MediaPageStoreData[ins.id].while.submitComment = false;
      },
      100,
      this
    );
  }
}

export default exportStore(new MediaPageStore(), 'actions_handler');
