import React from 'react';
import EventEmitter from 'events';
import { publishedOnDate, exportStore, getRequest, postRequest, deleteRequest, csrfToken } from '../helpers';

import { config as mediacmsConfig } from '../settings/config.js';

const PlaylistPageStoreData = {};

class PlaylistPageStore extends EventEmitter {
  constructor() {
    super();

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    PlaylistPageStoreData[
      Object.defineProperty(this, 'id', {
        value: 'PlaylistPageStoreData_' + Object.keys(PlaylistPageStoreData).length,
      }).id
    ] = {
      playlistId: null,
      data: {},
    };

    this.data = {
      savedPlaylist: false,
      publishDate: new Date(2018, 3, 14, 1, 13, 22, 0),
      publishDateLabel: null,
    };

    this.onPlaylistUpdateCompleted = this.onPlaylistUpdateCompleted.bind(this);
    this.onPlaylistUpdateFailed = this.onPlaylistUpdateFailed.bind(this);

    this.onPlaylistRemovalCompleted = this.onPlaylistRemovalCompleted.bind(this);
    this.onPlaylistRemovalFailed = this.onPlaylistRemovalFailed.bind(this);
  }

  loadData() {
    if (!PlaylistPageStoreData[this.id].playlistId) {
      console.warn('Invalid playlist id:', PlaylistPageStoreData[this.id].playlistId);
      return false;
    }

    this.playlistAPIUrl = this.mediacms_config.api.playlists + '/' + PlaylistPageStoreData[this.id].playlistId;

    this.dataResponse = this.dataResponse.bind(this);
    this.dataErrorResponse = this.dataErrorResponse.bind(this);
    getRequest(this.playlistAPIUrl, !1, this.dataResponse, this.dataErrorResponse);
  }

  dataResponse(response) {
    if (response && response.data) {
      PlaylistPageStoreData[this.id].data = response.data;
      this.emit('loaded_playlist_data');
    }
  }

  dataErrorResponse(response) {
    this.emit('loaded_playlist_error');

    if (void 0 !== response.type) {
      /*switch( response.type ){
                case "network":
                case "private":
                case "unavailable":
                    MediaPageStoreData[this.id].loadErrorType = response.type;
                    MediaPageStoreData[this.id].loadErrorMessage = void 0 !== response.message ? response.message : "Αn error occurred while loading the media's data";
                    this.emit('loaded_media_error');
                    break;
            }*/
    }
  }

  get(type) {
    switch (type) {
      case 'playlistId':
        return PlaylistPageStoreData[this.id].playlistId || null;
        break;
      case 'logged-in-user-playlist':
        return (
          !this.mediacms_config.member.is.anonymous &&
          PlaylistPageStoreData[this.id].data.user === this.mediacms_config.member.username
        );
      case 'playlist-media':
        return PlaylistPageStoreData[this.id].data.playlist_media || [];
      case 'visibility':
        return 'public';
      case 'visibility-icon':
        switch (this.get('visibility')) {
          case 'unlisted':
            return <i className="material-icons">insert_link</i>;
          case 'private':
            return <i className="material-icons">lock</i>;
        }
        return null;
      case 'total-items':
        return PlaylistPageStoreData[this.id].data.playlist_media.length || 0;
      case 'views-count':
        return 'N/A';
      case 'title':
        return PlaylistPageStoreData[this.id].data.title || null;
      case 'edit-link':
        return '#';
      case 'thumb':
        if (
          PlaylistPageStoreData[this.id].data.playlist_media &&
          PlaylistPageStoreData[this.id].data.playlist_media.length
        ) {
          return PlaylistPageStoreData[this.id].data.playlist_media[0].thumbnail_url;
        }
        return null;
      case 'description':
        return PlaylistPageStoreData[this.id].data.description || null;
      case 'author-username':
        return PlaylistPageStoreData[this.id].data.user || null; // TODO: Recheck this, is this same with 'author-name'?
      case 'author-name':
        return PlaylistPageStoreData[this.id].data.user || null;
      case 'author-link':
        return PlaylistPageStoreData[this.id].data.user
          ? this.mediacms_config.site.url + '/user/' + PlaylistPageStoreData[this.id].data.user
          : null;
      case 'author-thumb':
        if (!PlaylistPageStoreData[this.id].data.user_thumbnail_url) {
          return null;
        }

        return (
          this.mediacms_config.site.url +
          '/' +
          PlaylistPageStoreData[this.id].data.user_thumbnail_url.replace(/^\//g, '')
        );

      case 'saved-playlist':
        return this.data.savedPlaylist;
      case 'date-label':
        if (!PlaylistPageStoreData[this.id].data || !PlaylistPageStoreData[this.id].data.add_date) {
          return null;
        }
        this.data.publishDateLabel =
          this.data.publishDateLabel ||
          'Created on ' + publishedOnDate(new Date(PlaylistPageStoreData[this.id].data.add_date), 3);
        return this.data.publishDateLabel;
    }
    return null;
  }

  onPlaylistUpdateCompleted(response) {
    if (response && response.data) {
      PlaylistPageStoreData[this.id].data.title = response.data.title;
      PlaylistPageStoreData[this.id].data.description = response.data.description;
      this.emit('playlist_update_completed', response.data);
    }
  }

  onPlaylistUpdateFailed() {
    this.emit('playlist_update_failed');
  }

  onPlaylistRemovalCompleted(response) {
    if (response && void 0 !== response.status && 403 !== response.status) {
      this.emit('playlist_removal_completed', response);
    } else {
      this.onPlaylistRemovalFailed();
    }
  }

  onPlaylistRemovalFailed() {
    this.emit('playlist_removal_failed');
  }

  actions_handler(action) {
    switch (action.type) {
      case 'LOAD_PLAYLIST_DATA':
        PlaylistPageStoreData[this.id].playlistId =
          window.MediaCMS.playlistId ||
          (function (url) {
            var arr = url.split('/');
            return arr.length ? arr[arr.length - 1] : null;
          })(window.location.href);
        this.loadData();
        break;
      case 'TOGGLE_SAVE':
        this.data.savedPlaylist = !this.data.savedPlaylist;
        this.emit('saved-updated');
        break;
      case 'UPDATE_PLAYLIST':
        postRequest(
          this.playlistAPIUrl,
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
          this.onPlaylistUpdateCompleted,
          this.onPlaylistUpdateFailed
        );
        break;
      case 'REMOVE_PLAYLIST':
        deleteRequest(
          this.playlistAPIUrl,
          {
            headers: {
              'X-CSRFToken': csrfToken(),
            },
          },
          false,
          this.onPlaylistRemovalCompleted,
          this.onPlaylistRemovalFailed
        );
        break;
      case 'PLAYLIST_MEDIA_REORDERED':
        PlaylistPageStoreData[this.id].data.playlist_media = action.playlist_media;
        this.emit('reordered_media_in_playlist');
        break;
      case 'MEDIA_REMOVED_FROM_PLAYLIST':
        const new_playlist_media = [];
        let i = 0;
        while (i < PlaylistPageStoreData[this.id].data.playlist_media.length) {
          if (action.media_id !== PlaylistPageStoreData[this.id].data.playlist_media[i].url.split('=')[1]) {
            new_playlist_media.push(PlaylistPageStoreData[this.id].data.playlist_media[i]);
          }
          i += 1;
        }
        PlaylistPageStoreData[this.id].data.playlist_media = new_playlist_media;

        this.emit('removed_media_from_playlist');
        break;
    }
  }
}

export default exportStore(new PlaylistPageStore(), 'actions_handler');
