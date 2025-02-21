import React from 'react';
import { PageActions } from '../utils/actions/';
import { store } from '../utils/stores/store';
import { MemberContext } from '../utils/contexts/';
import { usePopup } from '../utils/hooks/';
import {
  CircleIconButton,
  MaterialIcon,
  NavigationContentApp,
  NavigationMenuList,
  PopupMain,
} from '../components/_shared/';
import { PlaylistCreationForm } from '../components/playlist-form/PlaylistCreationForm';
import { PlaylistMediaList } from '../components/playlist-page/PlaylistMediaList';
import { config as mediacmsConfig } from '../utils/settings/config';
import { Page } from './_Page';

import '../components/playlist-page/PlaylistPage.scss';
import { loadPlaylistData, removePlaylist } from '../utils/stores/actions/playlistPage';
import { publishedOnDate } from '../utils/helpers';

if (window.MediaCMS.site.devEnv) {
  const extractUrlParams = () => {
    let mediaId = null;
    let playlistId = null;

    const query = window.location.search.split('?')[1];

    if (query) {
      const params = query.split('&');
      params.forEach((param) => {
        if (param.startsWith('m=')) {
          mediaId = param.split('m=')[1];
        } else if (param.startsWith('pl=')) {
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
  let playAllUrl = props.media[0]?.url;

  if (window.MediaCMS.site.devEnv && playAllUrl?.includes('view?')) {
    playAllUrl = '/media.html?' + playAllUrl.split('view?')[1];
  }

  playAllUrl += `&pl=${props.id}`;

  return props.media?.length ? (
    <a href={playAllUrl} title="">
      {props.children}
    </a>
  ) : (
    <span>{props.children}</span>
  );
}

function PlaylistThumb(props) {
  return (
    <div
      className={'playlist-thumb' + (props.thumb ? '' : ' no-thumb')}
      style={{ backgroundImage: `url("${props.thumb}")` }}
    >
      <PlayAllLink id={props.id} media={props.media}>
        <span>
          {props.thumb ? <img src={props.thumb} alt="" /> : null}
          <span className="play-all">
            <i className="material-icons">play_arrow</i>
            <span className="play-all-label">PLAY ALL</span>
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
      {!props.dateLabel ? null : <div className="playlist-last-update">{props.dateLabel}</div>}
    </div>
  );
}

function playlistOptionsList() {
  return {
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
function PlaylistOptions() {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
  const [popupCurrentPage, setPopupCurrentPage] = React.useState('main');

  function proceedPlaylistRemoval() {
    if (window.MediaCMS.playlistId) {
      store.dispatch(removePlaylist(window.MediaCMS.playlistId));
      popupContentRef.current.toggle();
    }
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

  // useEffect(() => {
  //   PlaylistPageStore.on('playlist_update_completed', playlistUpdateCompleted);
  //   PlaylistPageStore.on('playlist_update_failed', playlistUpdateFailed);
  //   PlaylistPageStore.on('playlist_removal_completed', playlistRemovalCompleted);
  //   PlaylistPageStore.on('playlist_removal_failed', playlistRemovalFailed);
  //   return () => {
  //     PlaylistPageStore.removeListener('playlist_update_completed', playlistUpdateCompleted);
  //     PlaylistPageStore.removeListener('playlist_update_failed', playlistUpdateFailed);
  //     PlaylistPageStore.removeListener('playlist_removal_completed', playlistRemovalCompleted);
  //     PlaylistPageStore.removeListener('playlist_removal_failed', playlistRemovalFailed);
  //   };
  // }, []);

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
                id={window.MediaCMS.playlistId}
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

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    this.state = {
      playlistId: null,
      title: '',
      description: '',
      thumb: '',
      savedPlaylist: null,
      publishedDateLabel: '',
      media: [],
      user: '',
      user_link: '',
      user_thumb: '',
      loggedinUserPlaylist: false,
    };

    this.unsubscribe = null;
  }

  componentDidMount() {
    // Subscribe to Redux store updates
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState().playlistPage;
      if (!state.loading) {
        this.setState({
          playlistId: state.playlistId,
          title: state.data?.title || '',
          description: state.data?.description || '',
          thumb: state.data?.playlist_media[0].thumbnail_url || '',
          media: state.data?.playlist_media || [],
          savedPlaylist: state.data?.savedPlaylist || '',
          user: state.data?.user || '',
          user_link: state.data?.user ? this.mediacms_config.site.url + '/user/' + state.data.user : null,
          user_thumb: state.data?.user_thumbnail_url
            ? this.mediacms_config.site.url + '/' + state.data.user_thumbnail_url.replace(/^\//g, '')
            : null,
          publishedDateLabel:
            state.data?.publishDateLab || 'Created on ' + publishedOnDate(new Date(state.data?.add_date), 3),
          loggedinUserPlaylist:
            !this.mediacms_config.member.is.anonymous && state.data?.user === this.mediacms_config.member.username,
        });
      }
    });

    if (window.MediaCMS.playlistId) {
      store.dispatch(loadPlaylistData(window.MediaCMS.playlistId));
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const {
      playlistId,
      title,
      description,
      thumb,
      media,
      savedPlaylist,
      loggedinUserPlaylist,
      publishedDateLabel,
      user,
      user_link,
      user_thumb,
    } = this.state;

    if (!playlistId) {
      return null;
    }
    return (
      <>
        <div className="playlist-details">
          <PlaylistThumb id={playlistId} thumb={thumb} media={media} />
          <PlaylistTitle title={title} />
          <PlaylistMeta totalItems={media.length} dateLabel={publishedDateLabel} />
          <PlaylistActions loggedinUserPlaylist={loggedinUserPlaylist} savedPlaylist={savedPlaylist} />
          {description ? <div className="playlist-description">{description}</div> : null}
          <PlaylistAuthor
            name={user}
            link={user_link}
            thumb={user_thumb}
            loggedinUserPlaylist={this.state.loggedinUserPlaylist}
          />
        </div>
        <PlaylistMediaList
          key={'playlistMediaList_' + media.length}
          id={playlistId}
          media={media}
          loggedinUserPlaylist={loggedinUserPlaylist}
        />
      </>
    );
  }
}
