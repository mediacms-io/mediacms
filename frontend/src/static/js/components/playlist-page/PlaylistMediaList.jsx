import React from 'react';
import Sortable from 'sortablejs';
import { store } from '../../utils/stores/store'; // Import Redux store
import { ApiUrlContext } from '../../utils/contexts';
import { putRequest, csrfToken } from '../../utils/helpers';
import { PlaylistPageMedia } from './PlaylistPageMedia';
import { reorderPlaylistMedia } from '../../utils/stores/actions/playlistPage';

export class PlaylistMediaList extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      media: props.media,
    };

    this.containerRef = React.createRef();
    this.onItemsLoad = this.onItemsLoad.bind(this);
  }

  componentDidMount() {
    // Subscribe to Redux store updates to update state when media changes
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState().playlistPage;
      this.setState({ media: state.data?.playlist_media || [] });
    });
  }

  componentWillUnmount() {
    // Cleanup Redux subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onItemsLoad() {
    if (!this.props.loggedinUserPlaylist) {
      return;
    }

    const container = this.containerRef.current.querySelector('.items-list');

    if (!container) {
      return;
    }

    const playlistId = this.props.id;

    function onPutMediaOrderingSuccess(response) {
      // TODO: Handle successful API response
    }

    function onPutMediaOrderingFail(response) {
      // TODO: Handle failed API response
    }

    const getMediaArray = (index) => this.state.media[index];

    const updateMediaData = (newMediaOrder) => {
      const newMediaData = newMediaOrder.map((index) => this.state.media[index]);

      this.setState({ media: newMediaData }, () => {
        store.dispatch(reorderPlaylistMedia(newMediaData));
      });
    };

    Sortable.create(container, {
      onStart: function () {
        container.classList.add('on-dragging');
      },
      onEnd: function () {
        const newMediaOrder = [];

        const itemsOrderNumElems = container.querySelectorAll('.item-order-number div div');
        let oldOrdering, newOrdering, friendly_token;

        for (let i = 0; i < itemsOrderNumElems.length; i++) {
          oldOrdering = parseInt(itemsOrderNumElems[i].getAttribute('data-order'), 10);
          newOrdering = i + 1;

          if (newOrdering !== oldOrdering) {
            friendly_token = getMediaArray(oldOrdering - 1).friendly_token;

            putRequest(
              ApiUrlContext._currentValue.playlists + '/' + playlistId,
              {
                type: 'ordering',
                ordering: newOrdering,
                media_friendly_token: friendly_token,
              },
              {
                headers: {
                  'X-CSRFToken': csrfToken(),
                },
              },
              false,
              onPutMediaOrderingSuccess,
              onPutMediaOrderingFail
            );
          }

          newMediaOrder.push(oldOrdering - 1);
          itemsOrderNumElems[i].setAttribute('data-order', newOrdering);
          itemsOrderNumElems[i].innerHTML = newOrdering;
        }

        container.classList.remove('on-dragging');

        // **Update state & dispatch Redux action**
        updateMediaData(newMediaOrder);
      },
    });
  }

  render() {
    return (
      <div
        ref={this.containerRef}
        className={`playlist-videos-list ${this.props.loggedinUserPlaylist ? 'draggable' : ''}`}
      >
        {this.state.media.length ? (
          <PlaylistPageMedia
            itemsLoadCallback={this.onItemsLoad}
            playlistId={this.props.id}
            media={this.state.media}
            hidePlaylistOptions={!this.props.loggedinUserPlaylist}
          />
        ) : null}
      </div>
    );
  }
}
