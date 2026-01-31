import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { inEmbeddedApp } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { ProfileMediaPage } from './ProfileMediaPage';

export class ProfilePlaylistsPage extends ProfileMediaPage {
  constructor(props) {
    super(props, 'author-playlists');

    this.state = {
      loadedAuthor: false,
      loadedPlaylists: false,
      playlistsCount: -1,
    };

    this.getPlaylistsCountFunc = this.getPlaylistsCountFunc.bind(this);
  }

  getPlaylistsCountFunc(resultsCount) {
    this.setState({
      loadedPlaylists: true,
      playlistsCount: resultsCount,
    });
  }

  pageContent() {
    return [
      this.state.author ? (
        <ProfilePagesHeader key="ProfilePagesHeader" author={this.state.author} type="playlists" hideChannelBanner={inEmbeddedApp()} />
      ) : null,
      this.state.author ? (
        <ProfilePagesContent key="ProfilePagesContent">
          <ApiUrlConsumer>
            {(apiUrl) => (
              <MediaListWrapper
                title={-1 < this.state.playlistsCount ? 'Created playlists' : void 0}
                className="profile-playlists-content items-list-ver"
              >
                <LazyLoadItemListAsync
                  requestUrl={apiUrl.user.playlists + this.state.author.username}
                  itemsCountCallback={this.getPlaylistsCountFunc}
                  hideViews={!PageStore.get('config-media-item').displayViews}
                  hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                  hideDate={!PageStore.get('config-media-item').displayPublishDate}
                />
              </MediaListWrapper>
            )}
          </ApiUrlConsumer>
        </ProfilePagesContent>
      ) : null,
    ];
  }
}
