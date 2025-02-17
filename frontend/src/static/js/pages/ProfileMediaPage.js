import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext, LinksConsumer, MemberContext } from '../utils/contexts';
import { PageStore } from '../utils/stores';
import { loadAuthorData, updateSearchQuery } from '../utils/stores/actions/profile';
import store from '../utils/stores/store';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { Page } from './_Page';

import '../components/profile-page/ProfilePage.scss';

function EmptyChannelMedia({ name }) {
  return (
    <LinksConsumer>
      {(links) => (
        <div className="empty-media empty-channel-media">
          <div className="welcome-title">Welcome {name}</div>
          <div className="start-uploading">
            Start uploading media and sharing your work. Media that you upload will show up here.
          </div>
          <a href={links.user.addMedia} title="Upload media" className="button-link">
            <i className="material-icons" data-icon="video_call"></i>UPLOAD MEDIA
          </a>
        </div>
      )}
    </LinksConsumer>
  );
}

export class ProfileMediaPage extends Page {
  constructor(props, pageSlug = 'author-home') {
    super(props, pageSlug);

    this.state = {
      channelMediaCount: -1,
      author: null,
      uploadsPreviewItemsCount: 0,
      title: this.props.title,
      query: '',
      requestUrl: null,
    };

    this.onAuthorPreviewItemsCountCallback = this.onAuthorPreviewItemsCountCallback.bind(this);
    this.getCountFunc = this.getCountFunc.bind(this);
    this.changeRequestQuery = this.changeRequestQuery.bind(this);

    this.unsubscribeFromStore = null;
  }

  componentDidMount() {
    store.dispatch(loadAuthorData());

    this.unsubscribeFromStore = store.subscribe(() => {
      const state = store.getState();
      const author = state.profile.authorData;
      const query = state.profile.authorQuery || '';

      let requestUrl = null;
      if (author) {
        requestUrl = query
          ? `${ApiUrlContext._currentValue.search.query}${query}&author=${author.username}`
          : `${ApiUrlContext._currentValue.media}?author=${author.username}`;
      }

      this.setState({ author, query, requestUrl });
    });
  }

  componentWillUnmount() {
    // prevent memory leaks
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

  onAuthorPreviewItemsCountCallback(totalAuthorPreviewItems) {
    this.setState({ uploadsPreviewItemsCount: totalAuthorPreviewItems });
  }

  getCountFunc(count) {
    this.setState({ channelMediaCount: count }, () => {
      if (this.state.query) {
        const title =
          count === 0 ? `No results for "${this.state.query}"` : `${count} results for "${this.state.query}"`;
        this.setState({ title });
      }
    });
  }

  changeRequestQuery(newQuery) {
    if (!this.state.author) return;

    const requestUrl = newQuery
      ? `${ApiUrlContext._currentValue.search.query}${newQuery}&author=${this.state.author.username}`
      : `${ApiUrlContext._currentValue.media}?author=${this.state.author.username}`;

    const title = newQuery ? this.state.title : this.props.title;

    this.setState({ requestUrl, query: newQuery, title });

    store.dispatch(updateSearchQuery(newQuery));
  }

  pageContent() {
    const { author, channelMediaCount, requestUrl, title, query } = this.state;
    const isMediaAuthor = author && author.username === MemberContext._currentValue.username;

    return [
      author && <ProfilePagesHeader key="ProfilePagesHeader" onQueryChange={this.changeRequestQuery} />,
      author && (
        <ProfilePagesContent key="ProfilePagesContent">
          <MediaListWrapper title={!isMediaAuthor || channelMediaCount > 0 ? title : null} className="items-list-ver">
            <LazyLoadItemListAsync
              key={requestUrl}
              requestUrl={requestUrl}
              hideAuthor={true}
              itemsCountCallback={requestUrl ? this.getCountFunc : null}
              hideViews={!PageStore.get('config-media-item').displayViews}
              hideDate={!PageStore.get('config-media-item').displayPublishDate}
              canEdit={isMediaAuthor}
            />
            {isMediaAuthor && channelMediaCount === 0 && !query && <EmptyChannelMedia name={author.name} />}
          </MediaListWrapper>
        </ProfilePagesContent>
      ),
    ];
  }
}

ProfileMediaPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ProfileMediaPage.defaultProps = {
  title: 'Uploads',
};
