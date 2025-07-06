import React, { useState, useEffect } from 'react';
import { PageActions, PlaylistPageActions } from '../utils/actions/';
import { MemberContext } from '../utils/contexts/';
import { usePopup } from '../utils/hooks/';
import { PlaylistPageStore } from '../utils/stores/';
import {
  CircleIconButton,
  MaterialIcon,
  NavigationContentApp,
  NavigationMenuList,
  PopupMain,
} from '../components/_shared/';
import { PlaylistCreationForm } from '../components/playlist-form/PlaylistCreationForm';
import { PlaylistMediaList } from '../components/playlist-page/PlaylistMediaList';

import { Page } from './_Page';

import '../components/playlist-page/PlaylistPage.scss';

if (window.MediaCMS.site.devEnv) {
  const extractUrlParams = () => {
    let mediaId = null;
    let playlistId = null;

    const query = window.location.search.split('?')[1];

    if (query) {
      const params = query.split('&');
      params.forEach((param) => {
        if (0 === param.indexOf('m=')) {
          mediaId = param.split('m=')[1];
        } else if (0 === param.indexOf('pl=')) {
          playlistId = param.split('pl=')[1];
        }
      });
    }

    return { mediaId, playlistId };
  };

  const { playlistId } = extractUrlParams();

  if (playlistId) {
    window.MediaCMS.playlistId = playlistId;
  }
}

function PlayAllLink(props) {

  if (!props.media || !props.media.length) {
      return <span>{props.children}</span>;
    }

  let playAllUrl = props.media[0].url;

  if (window.MediaCMS.site.devEnv && -1 < playAllUrl.indexOf('view?')) {
    playAllUrl = '/media.html?' + playAllUrl.split('view?')[1];
  }

  playAllUrl += '&pl=' + props.id;

  return !props.media || !props.media.length ? (
    <span>{props.children}</span>
  ) : (
    <a href={playAllUrl} title="">
      {props.children}
    </a>
  );
}

function PlaylistThumb(props) {
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    if (!props.thumb || 'string' !== typeof props.thumb) {
      setThumb(null);
    } else {
      const tb = props.thumb.trim();
      setThumb('' !== tb ? tb : null);
    }
  }, [props.thumb]);

  return (
    <div className={'playlist-thumb' + (thumb ? '' : ' no-thumb')} style={{ backgroundImage: 'url("' + thumb + '")' }}>
      <PlayAllLink id={props.id} media={props.media}>
        <span>
          {thumb ? <img src={thumb} alt="" /> : null}
          <span className="play-all">
            <span>
              <span>
                <i className="material-icons">play_arrow</i>
                <span className="play-all-label">PLAY ALL</span>
              </span>
            </span>
          </span>
        </span>
      </PlayAllLink>
    </div>
  );
}

function PlaylistTitle(props) {
  return (
    <div className="playlist-title">
      <h1>{props.title}</h1>
    </div>
  );
}

function PlaylistMeta(props) {
  return (
    <div className="playlist-meta">
      <div className="playlist-videos-number">{props.totalItems} media</div>
      {/*<div className="playlist-views">{ props.viewsCount } { 1 < formatViewsNumber( props.viewsCount ) ? 'views' : 'view' }</div>*/}
      {!props.dateLabel ? null : <div className="playlist-last-update">{props.dateLabel}</div>}
    </div>
  );
}

function playlistOptionsList() {
  const items = {
    deleteMedia: {
      itemType: 'open-subpage',
      text: 'Delete',
      icon: 'delete',
      buttonAttr: {
        className: 'change-page',
        'data-page-id': 'proceedPlaylistRemovalPopup',
      },
    },
  };

  return items;
}

function playlistOptionsPopupPages(proceedPlaylistRemoval, cancelPlaylistRemoval) {
  const optionsList = playlistOptionsList();

  return {
    main: (
      <PopupMain>
        <NavigationMenuList items={[optionsList.deleteMedia]} />
      </PopupMain>
    ),
    proceedPlaylistRemovalPopup: (
      <PopupMain>
        <div className="popup-message">
          <span className="popup-message-title">Playlist removal</span>
          <span className="popup-message-main">You're willing to remove playlist permanently?</span>
        </div>
        <hr />
        <span className="popup-message-bottom">
          <button className="button-link cancel-playlist-removal" onClick={cancelPlaylistRemoval}>
            CANCEL
          </button>
          <button className="button-link proceed-playlist-removal" onClick={proceedPlaylistRemoval}>
            PROCEED
          </button>
        </span>
      </PopupMain>
    ),
  };
}

function PlaylistOptions(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [popupCurrentPage, setPopupCurrentPage] = useState('main');

  function proceedPlaylistRemoval() {
    PlaylistPageActions.removePlaylist();
    popupContentRef.current.toggle();
  }

  function cancelPlaylistRemoval() {
    popupContentRef.current.toggle();
  }

  return (
    <div className={'playlist-options-wrap' + ('main' === popupCurrentPage ? ' playlist-options-main' : '')}>
      <PopupTrigger contentRef={popupContentRef}>
        <CircleIconButton>
          <MaterialIcon type="more_horiz" />
        </CircleIconButton>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef}>
        <NavigationContentApp
          pageChangeCallback={setPopupCurrentPage}
          initPage="main"
          focusFirstItemOnPageChange={false}
          pages={playlistOptionsPopupPages(proceedPlaylistRemoval, cancelPlaylistRemoval)}
          pageChangeSelector={'.change-page'}
          pageIdSelectorAttr={'data-page-id'}
        />
      </PopupContent>
    </div>
  );
}

function PlaylistEdit(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  function onPlaylistSave() {
    // Empty for now...
  }

  function onClickExit() {
    popupContentRef.current.toggle();
  }

  function playlistUpdateCompleted(new_playlist_data) {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Playlist updated', 'playlistUpdateCompleted');
      onClickExit();
    }, 100);
  }

  function playlistUpdateFailed() {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Playlist update failed', 'playlistUpdateFailed');
      onClickExit();
    }, 100);
  }

  function playlistRemovalCompleted(playlistId) {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Playlist removed. Redirecting...', 'playlistDelete');
      setTimeout(function () {
        window.location.href = MemberContext._currentValue.pages.playlists;
      }, 2000);
    }, 100);
  }

  function playlistRemovalFailed(playlistId) {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Playlist removal failed', 'playlistDeleteFail');
    }, 100);
  }

  useEffect(() => {
    PlaylistPageStore.on('playlist_update_completed', playlistUpdateCompleted);
    PlaylistPageStore.on('playlist_update_failed', playlistUpdateFailed);
    PlaylistPageStore.on('playlist_removal_completed', playlistRemovalCompleted);
    PlaylistPageStore.on('playlist_removal_failed', playlistRemovalFailed);
    return () => {
      PlaylistPageStore.removeListener('playlist_update_completed', playlistUpdateCompleted);
      PlaylistPageStore.removeListener('playlist_update_failed', playlistUpdateFailed);
      PlaylistPageStore.removeListener('playlist_removal_completed', playlistRemovalCompleted);
      PlaylistPageStore.removeListener('playlist_removal_failed', playlistRemovalFailed);
    };
  }, []);

  return (
    <div className="edit-playlist">
      <PopupTrigger contentRef={popupContentRef}>
        <CircleIconButton>
          <MaterialIcon type="edit" />
          <span>EDIT</span>
        </CircleIconButton>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef}>
        <div className="popup-fullscreen">
          <PopupMain>
            <span className="popup-fullscreen-overlay"></span>
            <div className="edit-playlist-form-wrap">
              <div className="edit-playlist-popup-title">
                Edit playlist
                <CircleIconButton type="button" onClick={onClickExit}>
                  <MaterialIcon type="close" />
                </CircleIconButton>
              </div>
              <PlaylistCreationForm
                date={new Date().getTime()}
                id={PlaylistPageStore.get('playlistId')}
                onCancel={onClickExit}
                onPlaylistSave={onPlaylistSave}
              />
            </div>
          </PopupMain>
        </div>
      </PopupContent>
    </div>
  );
}

function PlaylistActions(props) {
  return props.loggedinUserPlaylist ? (
    <div className="playlist-actions">{props.loggedinUserPlaylist ? <PlaylistOptions /> : null}</div>
  ) : null;
}

function PlaylistAuthor(props) {
  return (
    <div className="playlist-author">
      <div>
        <div className="playlist-author-thumb">
          <a href={props.link} title={props.name}>
            {props.thumb ? (
              <span style={{ backgroundImage: 'url(' + props.thumb + ')' }}>
                <img src={props.thumb} alt="" />
              </span>
            ) : (
              <span>
                <MaterialIcon type="person" />
              </span>
            )}
          </a>
        </div>
        <div className="playlist-author-name">
          <a href={props.link} title={props.name}>
            {props.name}
          </a>
        </div>
        {props.loggedinUserPlaylist ? <PlaylistEdit /> : null}
      </div>
    </div>
  );
}

export class PlaylistPage extends Page {
  constructor(props) {
    super(props, 'playlist-page');

    this.state = {
      thumb: PlaylistPageStore.get('thumb'),
      media: PlaylistPageStore.get('playlist-media'),
      savedPlaylist: PlaylistPageStore.get('saved-playlist'),
      loggedinUserPlaylist: PlaylistPageStore.get('logged-in-user-playlist'),
      title: PlaylistPageStore.get('title'),
      description: PlaylistPageStore.get('description'),
    };

    this.onLoadPlaylistData = this.onLoadPlaylistData.bind(this);
    PlaylistPageStore.on('loaded_playlist_data', this.onLoadPlaylistData);

    /*this.onPlaylistSaveUpdate = this.onPlaylistSaveUpdate.bind(this);
    PlaylistPageStore.on('saved-updated', this.onPlaylistSaveUpdate);*/

    this.onMediaRemovedFromPlaylist = this.onMediaRemovedFromPlaylist.bind(this);
    PlaylistPageStore.on('removed_media_from_playlist', this.onMediaRemovedFromPlaylist);

    this.onMediaReorderedInPlaylist = this.onMediaReorderedInPlaylist.bind(this);
    PlaylistPageStore.on('reordered_media_in_playlist', this.onMediaReorderedInPlaylist);

    this.onCompletePlaylistUpdate = this.onCompletePlaylistUpdate.bind(this);
    PlaylistPageStore.on('playlist_update_completed', this.onCompletePlaylistUpdate);
  }

  onCompletePlaylistUpdate() {
    this.setState({
      thumb: PlaylistPageStore.get('thumb'),
      title: PlaylistPageStore.get('title'),
      description: PlaylistPageStore.get('description'),
    });
  }

  onLoadPlaylistData() {
    this.setState({
      thumb: PlaylistPageStore.get('thumb'),
      title: PlaylistPageStore.get('title'),
      description: PlaylistPageStore.get('description'),
      media: PlaylistPageStore.get('playlist-media'),
      savedPlaylist: PlaylistPageStore.get('saved-playlist'),
      loggedinUserPlaylist: PlaylistPageStore.get('logged-in-user-playlist'),
    });
  }

  componentDidMount() {
    PlaylistPageActions.loadPlaylistData();
  }

  /*onPlaylistSaveUpdate(){
    this.setState({
      savedPlaylist: PlaylistPageStore.get('saved-playlist'),
    }, () => {
      if( this.state.savedPlaylist ){
        PageActions.addNotification('Added to playlists library', 'added-to-playlists-lib');
      }
      else{
        PageActions.addNotification('Removed from playlists library', 'removed-from-playlists-lib');
      }
    });
  }*/

  onMediaRemovedFromPlaylist() {
    this.setState({
      media: PlaylistPageStore.get('playlist-media'),
      thumb: PlaylistPageStore.get('thumb'),
    });
  }

  onMediaReorderedInPlaylist() {
    this.setState({
      media: PlaylistPageStore.get('playlist-media'),
      thumb: PlaylistPageStore.get('thumb'),
    });
  }

  pageContent() {
    const playlistId = PlaylistPageStore.get('playlistId');

    if (!playlistId) {
      return null;
    }

    return [
      <div key="playlistDetails" className="playlist-details">
        <PlaylistThumb id={playlistId} thumb={this.state.thumb} media={this.state.media} />
        <PlaylistTitle title={this.state.title} />
        <PlaylistMeta
          totalItems={PlaylistPageStore.get('total-items')}
          dateLabel={PlaylistPageStore.get('date-label')}
          viewsCount={PlaylistPageStore.get('views-count')}
        />

        {/*'public' === PlaylistPageStore.get('visibility') ? null :
						<div className="playlist-status">
							<span>{ PlaylistPageStore.get('visibility-icon') }</span>
							<div>{ PlaylistPageStore.get('visibility') }</div>
						</div>*/}

        <PlaylistActions
          loggedinUserPlaylist={this.state.loggedinUserPlaylist}
          savedPlaylist={this.state.savedPlaylist}
        />

        {this.state.description ? <div className="playlist-description">{this.state.description}</div> : null}

        <PlaylistAuthor
          name={PlaylistPageStore.get('author-name')}
          link={PlaylistPageStore.get('author-link')}
          thumb={PlaylistPageStore.get('author-thumb')}
          loggedinUserPlaylist={this.state.loggedinUserPlaylist}
        />
      </div>,

      <PlaylistMediaList
        key={'playlistMediaList_' + this.state.media.length}
        id={playlistId}
        media={this.state.media}
        loggedinUserPlaylist={this.state.loggedinUserPlaylist}
      />,
    ];
  }
}
