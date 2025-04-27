import React from 'react';
import { MediaPageStore } from '../../utils/stores/';
import { AutoPlay } from './AutoPlay';
import { RelatedMedia } from './RelatedMedia';
import PlaylistView from './PlaylistView';

export default class ViewerSidebar extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      playlistData: props.playlistData,
      isPlaylistPage: !!props.playlistData,
      activeItem: 0,
      mediaType: MediaPageStore.get('media-type'),
      chapters: MediaPageStore.get('media-data')?.chapters
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

    this.onMediaLoad = this.onMediaLoad.bind(this);
  }

  componentDidMount() {
    MediaPageStore.on('loaded_media_data', this.onMediaLoad);
  }

  onMediaLoad() {
    this.setState({
      mediaType: MediaPageStore.get('media-type'),
      chapters: MediaPageStore.get('media-data')?.chapter_data || []
    });
  }

  render() {
    return (
      <div className="viewer-sidebar">
        {this.state.isPlaylistPage ? (
          <PlaylistView activeItem={this.state.activeItem} playlistData={this.props.playlistData} />
        ) : 'video' === this.state.mediaType || 'audio' === this.state.mediaType ? (
          <AutoPlay />
        ) : null}
        <RelatedMedia hideFirst={!this.state.isPlaylistPage} />
      </div>
    );
  }
}
