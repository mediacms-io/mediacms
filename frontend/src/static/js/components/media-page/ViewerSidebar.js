import React from 'react';
import PlaylistView from './PlaylistView';

export default class ViewerSidebar extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      playlistData: props.playlistData,
      isPlaylistPage: !!props.playlistData,
      activeItem: 0,
    };

    if (props.playlistData) {
      let i = 0;
      while (i < props.playlistData.playlist_media.length) {
        if (props.mediaId === props.playlistData.playlist_media[i].friendly_token) {
          this.state.activeItem = i + 1;
          break;
        }

        i += 1;
      }
    }

  }

  render() {
    return (
      <div className="viewer-sidebar">
        {this.state.isPlaylistPage ? (
          <PlaylistView activeItem={this.state.activeItem} playlistData={this.props.playlistData} />
        ) : null}
      </div>
    );
  }
}
