import React from 'react';
import Sortable from 'sortablejs';
import { PlaylistPageActions } from '../../utils/actions';
import { ApiUrlContext } from '../../utils/contexts';
import { putRequest, csrfToken } from '../../utils/helpers';
import { PlaylistPageMedia } from './PlaylistPageMedia';

export class PlaylistMediaList extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            media: props.media,
        };
        this.containerRef = React.createRef();
        this.onItemsLoad = this.onItemsLoad.bind(this);
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
            // TODO: Continue here
        }

        function onPutMediaOrderingFail(response) {
            // TODO: Continue here
        }

        const getMediaArray = function (index) {
            return this.state.media[index];
        }.bind(this);

        const updateMediaData = function (newMediaOrder) {
            const newMediadata = [];
            let i = 0;
            while (i < newMediaOrder.length) {
                newMediadata.push(this.state.media[newMediaOrder[i]]);
                i += 1;
            }

            this.setState(
                {
                    media: newMediadata,
                },
                () => {
                    PlaylistPageActions.reorderedMediaInPlaylist(this.state.media);
                }
            );
        }.bind(this);

        Sortable.create(container, {
            onStart: function (evt) {
                container.classList.add('on-dragging');
            },
            onEnd: function (evt) {
                const newMediaOrder = [];

                const itemsOrderNumElems = container.querySelectorAll('.item-order-number div div');
                let oldOrdering, newOrdering, friendly_token;
                let i = 0;
                while (i < itemsOrderNumElems.length) {
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

                    i += 1;
                }

                container.classList.remove('on-dragging');

                updateMediaData(newMediaOrder);
            },
        });
    }

    render() {
        return (
            <div
                ref={this.containerRef}
                className={'playlist-videos-list' + (this.props.loggedinUserPlaylist ? ' draggable' : '')}
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