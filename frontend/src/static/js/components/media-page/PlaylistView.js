import React from 'react';
import PropTypes from 'prop-types';
import { LinksContext } from '../../utils/contexts/';
import { PlaylistViewStore } from '../../utils/stores/';
import { PositiveIntegerOrZero } from '../../utils/helpers/';
import { PageActions, PlaylistViewActions } from '../../utils/actions/';
import { CircleIconButton } from '../_shared/';
import { PlaylistPlaybackMedia } from './PlaylistPlaybackMedia';

import './PlaylistView.scss';

export default class PlaylistView extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      expanded: true,
      loopRepeat: PlaylistViewStore.get('enabled-loop'),
      shuffle: PlaylistViewStore.get('enabled-shuffle'),
      savedPlaylist: PlaylistViewStore.get('saved-playlist-loop'),
      title: props.playlistData.title,
      link: props.playlistData.url,
      authorName: props.playlistData.user,
      authorLink: LinksContext._currentValue.home + '/user/' + props.playlistData.user,
      activeItem: props.activeItem,
      totalMedia: props.playlistData.media_count,
      items: props.playlistData.playlist_media,
    };

    this.onHeaderClick = this.onHeaderClick.bind(this);
    this.onLoopClick = this.onLoopClick.bind(this);
    this.onShuffleClick = this.onShuffleClick.bind(this);
    this.onSaveClick = this.onSaveClick.bind(this);
    this.onLoopRepeatUpdate = this.onLoopRepeatUpdate.bind(this);
    this.onShuffleUpdate = this.onShuffleUpdate.bind(this);
    this.onPlaylistSaveUpdate = this.onPlaylistSaveUpdate.bind(this);

    PlaylistViewStore.on('loop-repeat-updated', this.onLoopRepeatUpdate);
    PlaylistViewStore.on('shuffle-updated', this.onShuffleUpdate);
    PlaylistViewStore.on('saved-updated', this.onPlaylistSaveUpdate);
  }

  onHeaderClick(ev) {
    this.setState({ expanded: !this.state.expanded });
  }

  onLoopClick() {
    PlaylistViewActions.toggleLoop();
  }

  onShuffleClick() {
    PlaylistViewActions.toggleShuffle();
  }

  onSaveClick() {
    PlaylistViewActions.toggleSave();
  }

  onShuffleUpdate() {
    this.setState(
      {
        shuffle: PlaylistViewStore.get('enabled-shuffle'),
      },
      () => {
        if (this.state.shuffle) {
          PageActions.addNotification('Playlist shuffle is on', 'shuffle-on');
        } else {
          PageActions.addNotification('Playlist shuffle is off', 'shuffle-off');
        }
      }
    );
  }

  onLoopRepeatUpdate() {
    this.setState(
      {
        loopRepeat: PlaylistViewStore.get('enabled-loop'),
      },
      () => {
        if (this.state.loopRepeat) {
          PageActions.addNotification('Playlist loop is on', 'loop-on');
        } else {
          PageActions.addNotification('Playlist loop is off', 'loop-off');
        }
      }
    );
  }

  onPlaylistSaveUpdate() {
    this.setState(
      {
        savedPlaylist: PlaylistViewStore.get('saved-playlist'),
      },
      () => {
        if (this.state.savedPlaylist) {
          PageActions.addNotification('Added to playlists library', 'added-to-playlists-lib');
        } else {
          PageActions.addNotification('Removed from playlists library', 'removed-from-playlists-lib');
        }
      }
    );
  }

  render() {
    return (
      <div className="playlist-view-wrap">
        <div className={'playlist-view' + (!this.state.expanded ? '' : ' playlist-expanded-view')}>
          <div className="playlist-header">
            <div className="playlist-title">
              <a href={this.state.link} title={this.state.title}>
                {this.state.title}
              </a>
            </div>

            <div className="playlist-meta">
              {/*'public' === PlaylistViewStore.get('visibility') ? null :
								<div className="playlist-status">
									<span>{ PlaylistViewStore.get('visibility-icon') }</span>
									<div>{ PlaylistViewStore.get('visibility') }</div>
								</div>*/}
              <span>
                <a href={this.state.authorLink} title={this.state.authorName}>
                  {this.state.authorName}
                </a>
              </span>
              &nbsp;&nbsp;-&nbsp;&nbsp;
              <span className="counter">
                {this.state.activeItem} / {this.state.totalMedia}
              </span>
            </div>

            <CircleIconButton className="toggle-playlist-view" onClick={this.onHeaderClick}>
              {this.state.expanded ? (
                <i className="material-icons">keyboard_arrow_up</i>
              ) : (
                <i className="material-icons">keyboard_arrow_down</i>
              )}
            </CircleIconButton>
          </div>

          {!this.state.expanded ? null : (
            <div className="playlist-actions">
              <CircleIconButton
                className={this.state.loopRepeat ? 'active' : ''}
                onClick={this.onLoopClick}
                title="Loop playlist"
              >
                <i className="material-icons">repeat</i>
              </CircleIconButton>
              {/*<CircleIconButton className={ this.state.shuffle ? 'active' : '' } onClick={ this.onShuffleClick } title="Shuffle playlist"><i className="material-icons">shuffle</i></CircleIconButton>*/}
              {/*PlaylistViewStore.get('logged-in-user-playlist') ? null : <CircleIconButton className={ 'add-to-playlist' + ( this.state.savedPlaylist ? ' active' : '' ) } onClick={ this.onSaveClick } title={ this.state.savedPlaylist ? "Remove" : "Save playlist" }><i className="material-icons">{ this.state.savedPlaylist ? 'playlist_add_check' : 'playlist_add' }</i></CircleIconButton>*/}
            </div>
          )}

          {!this.state.expanded || !this.state.items.length ? null : (
            <div className="playlist-media">
              <PlaylistPlaybackMedia items={this.state.items} playlistActiveItem={this.state.activeItem} />
            </div>
          )}
        </div>
      </div>
    );
  }
}

PlaylistView.propTypes = {
  playlistData: PropTypes.object.isRequired,
  activeItem: PositiveIntegerOrZero,
};

PlaylistView.defaultProps = {};
