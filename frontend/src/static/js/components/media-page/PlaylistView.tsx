import React, { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../utils/stores/store';

import { CircleIconButton } from '../_shared';

import './PlaylistView.scss';
import { loadPlaylistState, toggleLoop } from '../../utils/stores/actions/playlistView';
import { PlaylistPlaybackMedia } from './PlaylistPlaybackMedia';
import { PageActions } from '../../utils/actions';
import { LinksContext } from '../../utils/contexts';

const FixedCircleIconButton = CircleIconButton as React.FC<{
  className: string;
  title?: string;
  children: React.ReactNode;
  buttonShadow?: boolean;
  onClick?: () => void;
}>;

interface PlaylistViewProps {
  playlistData: {
    title: string;
    url: string;
    user: string;
    media_count: number;
    playlist_media: any[];
  };
  activeItem: number;
}

const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistData, activeItem }) => {
  const dispatch = useDispatch<AppDispatch>();
  console.log(playlistData);

  const playlistId = useSelector((state: RootState) => state.playlistView.playlistId);
  const loop = useSelector((state: RootState) => state.playlistView.loop[playlistId ?? '']);
  const shuffle = useSelector((state: RootState) => state.playlistView.shuffle[playlistId ?? '']);
  const savedPlaylist = useSelector((state: RootState) => state.playlistView.savedPlaylist);
  const links = useContext(LinksContext);

  const [expanded, setExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (playlistData) {
      const playlistId = playlistData.url;
      dispatch(loadPlaylistState(playlistId));
    }
  }, [dispatch, playlistData]);

  const handleHeaderClick = () => {
    setExpanded((prev) => !prev);
  };

  const handleLoopClick = () => {
    dispatch(toggleLoop());
  };

  // const handleShuffleClick = () => {
  //   dispatch(toggleShuffle());
  // };

  // const handleSaveClick = () => {
  //   dispatch(toggleSave());
  // };

  const handleShuffleUpdate = () => {
    if (shuffle) {
      PageActions.addNotification('Playlist shuffle is on', 'shuffle-on');
    } else {
      PageActions.addNotification('Playlist shuffle is off', 'shuffle-off');
    }
  };

  const handleLoopRepeatUpdate = () => {
    if (loop) {
      PageActions.addNotification('Playlist loop is on', 'loop-on');
    } else {
      PageActions.addNotification('Playlist loop is off', 'loop-off');
    }
  };

  const handlePlaylistSaveUpdate = () => {
    if (savedPlaylist) {
      PageActions.addNotification('Added to playlists library', 'added-to-playlists-lib');
    } else {
      PageActions.addNotification('Removed from playlists library', 'removed-from-playlists-lib');
    }
  };

  useEffect(() => {
    handleShuffleUpdate();
  }, [shuffle]);

  useEffect(() => {
    handleLoopRepeatUpdate();
  }, [loop]);

  useEffect(() => {
    handlePlaylistSaveUpdate();
  }, [savedPlaylist]);

  return (
    <div className="playlist-view-wrap">
      <div className={`playlist-view ${expanded ? 'playlist-expanded-view' : ''}`}>
        <div className="playlist-header">
          <div className="playlist-title">
            <a href={playlistData.url} title={playlistData.title}>
              {playlistData.title}
            </a>
          </div>
          <div className="playlist-meta">
            <span>
              <a href={`${links.home}/user/${playlistData.user}`} title={playlistData.user}>
                {playlistData.user}
              </a>
            </span>
            &nbsp;&nbsp;-&nbsp;&nbsp;
            <span className="counter">
              {activeItem} / {playlistData.media_count}
            </span>
          </div>
          <FixedCircleIconButton className="toggle-playlist-view" onClick={handleHeaderClick}>
            <i className="material-icons">{expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</i>
          </FixedCircleIconButton>
        </div>

        {expanded && (
          <div className="playlist-actions">
            <FixedCircleIconButton className={loop ? 'active' : ''} onClick={handleLoopClick} title="Loop playlist">
              <i className="material-icons">repeat</i>
            </FixedCircleIconButton>
            {/* <FixedCircleIconButton
              className={shuffle ? 'active' : ''}
              onClick={handleShuffleClick}
              title="Shuffle playlist"
            >
              <i className="material-icons">shuffle</i>
            </FixedCircleIconButton>
            <FixedCircleIconButton
              className={savedPlaylist ? 'active' : ''}
              onClick={handleSaveClick}
              title={savedPlaylist ? 'Remove' : 'Save playlist'}
            >
              <i className="material-icons">{savedPlaylist ? 'playlist_add_check' : 'playlist_add'}</i>
            </FixedCircleIconButton> */}
          </div>
        )}

        {expanded && playlistData.playlist_media.length > 0 && (
          <div className="playlist-media">
            <PlaylistPlaybackMedia items={playlistData.playlist_media} playlistActiveItem={activeItem} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistView;
