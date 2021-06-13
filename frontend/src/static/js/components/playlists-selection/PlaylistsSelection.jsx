import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { CircleIconButton, MaterialIcon } from '../_shared';
import { PlaylistCreationForm } from '../playlist-form/PlaylistCreationForm';

import './PlaylistsSelection.scss';

function PlaylistsSingleSelection(props) {
  function onChange(ev) {
    ev.persist();

    if (props.isChecked) {
      MediaPageActions.removeMediaFromPlaylist(props.playlistId, MediaPageStore.get('media-id'));
    } else {
      MediaPageActions.addMediaToPlaylist(props.playlistId, MediaPageStore.get('media-id'));
    }
  }

  return !!props.renderDate ? (
    <label>
      <input type="checkbox" checked={props.isChecked} onChange={onChange} />
      <span>{props.title}</span>
      {/*<MaterialIcon type={ "private" === this.props.privacy ? "lock" : ( "unlisted" === this.props.privacy ? "link" : "public" ) } />*/}
    </label>
  ) : null;
}

PlaylistsSingleSelection.propTypes = {
  playlistId: PropTypes.string,
  isChecked: PropTypes.bool,
  title: PropTypes.string,
};

PlaylistsSingleSelection.defaultProps = {
  isChecked: false,
  title: '',
};

export function PlaylistsSelection(props) {
  const containerRef = useRef(null);
  const saveToSelectRef = useRef(null);

  const [date, setDate] = useState(new Date());
  const [playlists, setPlaylists] = useState(MediaPageStore.get('playlists'));
  const [openCreatePlaylist, setOpenCreatePlaylist] = useState(false);

  function onWindowResize() {
    updateSavetoSelectMaxHeight();
  }

  function onLoadPlaylists() {
    setPlaylists(MediaPageStore.get('playlists'));
    setDate(new Date());
  }

  function onPlaylistMediaAdditionComplete() {
    setPlaylists(MediaPageStore.get('playlists'));
    setDate(new Date());
    setTimeout(function () {
      PageActions.addNotification('Media added to playlist', 'playlistMediaAdditionComplete');
    }, 100);
  }

  function onPlaylistMediaAdditionFail() {
    setTimeout(function () {
      PageActions.addNotification("Media's addition to playlist failed", 'playlistMediaAdditionFail');
    }, 100);
  }

  function onPlaylistMediaRemovalComplete() {
    setPlaylists(MediaPageStore.get('playlists'));
    setDate(new Date());
    setTimeout(function () {
      PageActions.addNotification('Media removed from playlist', 'playlistMediaRemovalComplete');
    }, 100);
  }

  function onPlaylistMediaRemovalFail() {
    setTimeout(function () {
      PageActions.addNotification("Media's removal from playlist failed", 'playlistMediaaRemovalFail');
    }, 100);
  }

  function updateSavetoSelectMaxHeight() {
    if (null !== saveToSelectRef.current) {
      saveToSelectRef.current.style.maxHeight =
        window.innerHeight -
        (56 + 18) -
        (containerRef.current.offsetHeight - saveToSelectRef.current.offsetHeight) +
        'px';
    }
  }

  function getCreatedPlaylists() {
    const mediaId = MediaPageStore.get('media-id');
    let ret = [];
    let i = 0;
    while (i < playlists.length) {
      ret.push(
        <div key={'playlist_' + playlists[i].playlist_id}>
          <PlaylistsSingleSelection
            renderDate={date}
            title={playlists[i].title}
            privacy={playlists[i].status}
            isChecked={-1 < playlists[i].media_list.indexOf(mediaId)}
            playlistId={playlists[i].playlist_id}
          />
        </div>
      );
      i += 1;
    }
    return ret;
  }

  function togglePlaylistCreationForm() {
    setOpenCreatePlaylist(!openCreatePlaylist);
    updateSavetoSelectMaxHeight();
  }

  function onClickExit() {
    setOpenCreatePlaylist(false);
    if (void 0 !== props.triggerPopupClose) {
      props.triggerPopupClose();
    }
  }

  function onPlaylistCreation(newPlaylistData) {
    MediaPageActions.addNewPlaylist(newPlaylistData);
    togglePlaylistCreationForm();
  }

  useEffect(() => {
    updateSavetoSelectMaxHeight();
  });

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    MediaPageStore.on('playlists_load', onLoadPlaylists);
    MediaPageStore.on('media_playlist_addition_completed', onPlaylistMediaAdditionComplete);
    MediaPageStore.on('media_playlist_addition_failed', onPlaylistMediaAdditionFail);
    MediaPageStore.on('media_playlist_removal_completed', onPlaylistMediaRemovalComplete);
    MediaPageStore.on('media_playlist_removal_failed', onPlaylistMediaRemovalFail);

    return () => {
      PageStore.removeListener('window_resize', onWindowResize);
      MediaPageStore.removeListener('playlists_load', onLoadPlaylists);
      MediaPageStore.removeListener('media_playlist_addition_completed', onPlaylistMediaAdditionComplete);
      MediaPageStore.removeListener('media_playlist_addition_failed', onPlaylistMediaAdditionFail);
      MediaPageStore.removeListener('media_playlist_removal_completed', onPlaylistMediaRemovalComplete);
      MediaPageStore.removeListener('media_playlist_removal_failed', onPlaylistMediaRemovalFail);
    };
  }, []);

  return (
    <div ref={containerRef} className="saveto-popup">
      <div className="saveto-title">
        Save to...
        <CircleIconButton type="button" onClick={onClickExit}>
          <MaterialIcon type="close" />
        </CircleIconButton>
      </div>
      {playlists.length ? (
        <div ref={saveToSelectRef} className="saveto-select">
          {getCreatedPlaylists()}
        </div>
      ) : null}
      {openCreatePlaylist ? (
        <div className="saveto-new-playlist">
          <PlaylistCreationForm onCancel={togglePlaylistCreationForm} onPlaylistSave={onPlaylistCreation} />
        </div>
      ) : (
        <CircleIconButton className="saveto-create" type="button" onClick={togglePlaylistCreationForm}>
          <MaterialIcon type="add" />
          Create a new playlist
        </CircleIconButton>
      )}
    </div>
  );
}

PlaylistsSelection.propTypes = {
  triggerPopupClose: PropTypes.func,
};
