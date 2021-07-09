import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext, LinksConsumer, MemberContext } from '../utils/contexts';
import { PageStore, ProfilePageStore } from '../utils/stores';
import { ProfilePageActions } from '../utils/actions';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';

import { Page } from './_Page';

import '../components/profile-page/ProfilePage.scss';

function EmptyChannelMedia(props) {
  return (
    <LinksConsumer>
      {(links) => (
        <div className="empty-media empty-channel-media">
          <div className="welcome-title">Welcome {props.name}</div>
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
  constructor(props, pageSlug) {
    super(props, 'string' === typeof pageSlug ? pageSlug : 'author-home');

    this.profilePageSlug = 'string' === typeof pageSlug ? pageSlug : 'author-home';

    this.state = {
      channelMediaCount: -1,
      author: ProfilePageStore.get('author-data'),
      uploadsPreviewItemsCount: 0,
      title: this.props.title,
      query: ProfilePageStore.get('author-query'),
      requestUrl: null,
    };

    this.authorDataLoad = this.authorDataLoad.bind(this);
    this.onAuthorPreviewItemsCountCallback = this.onAuthorPreviewItemsCountCallback.bind(this);
    this.getCountFunc = this.getCountFunc.bind(this);
    this.changeRequestQuery = this.changeRequestQuery.bind(this);

    ProfilePageStore.on('load-author-data', this.authorDataLoad);
  }

  componentDidMount() {
    ProfilePageActions.load_author_data();
  }

  authorDataLoad() {
    const author = ProfilePageStore.get('author-data');

    let requestUrl = this.state.requestUrl;

    if (author) {
      if (this.state.query) {
        requestUrl = ApiUrlContext._currentValue.search.query + this.state.query + '&author=' + author.id;
      } else {
        requestUrl = ApiUrlContext._currentValue.media + '?author=' + author.id;
      }
    }

    this.setState({
      author: author,
      requestUrl: requestUrl,
    });
  }

  onAuthorPreviewItemsCountCallback(totalAuthorPreviewItems) {
    this.setState({
      uploadsPreviewItemsCount: totalAuthorPreviewItems,
    });
  }

  getCountFunc(count) {
    this.setState(
      {
        channelMediaCount: count,
      },
      () => {
        if (this.state.query) {
          let title = '';

          if (!count) {
            title = 'No results for "' + this.state.query + '"';
          } else if (1 === count) {
            title = '1 result for "' + this.state.query + '"';
          } else {
            title = count + ' results for "' + this.state.query + '"';
          }

          this.setState({
            title: title,
          });
        }
      }
    );
  }

  changeRequestQuery(newQuery) {
    if (!this.state.author) {
      return;
    }

    let requestUrl;

    if (newQuery) {
      requestUrl = ApiUrlContext._currentValue.search.query + newQuery + '&author=' + this.state.author.id;
    } else {
      requestUrl = ApiUrlContext._currentValue.media + '?author=' + this.state.author.id;
    }

    let title = this.state.title;

    if ('' === newQuery) {
      title = this.props.title;
    }

    this.setState({
      requestUrl: requestUrl,
      query: newQuery,
      title: title,
    });
  }

  pageContent() {
    const authorData = ProfilePageStore.get('author-data');

    const isMediaAuthor = authorData && authorData.username === MemberContext._currentValue.username;

    return [
      this.state.author ? (
        <ProfilePagesHeader
          key="ProfilePagesHeader"
          author={this.state.author}
          onQueryChange={this.changeRequestQuery}
        />
      ) : null,
      this.state.author ? (
        <ProfilePagesContent key="ProfilePagesContent">
          <MediaListWrapper
            title={!isMediaAuthor || 0 < this.state.channelMediaCount ? this.state.title : null}
            className="items-list-ver"
          >
            <LazyLoadItemListAsync
              key={this.state.requestUrl}
              requestUrl={this.state.requestUrl}
              hideAuthor={true}
              itemsCountCallback={this.state.requestUrl ? this.getCountFunc : null}
              hideViews={!PageStore.get('config-media-item').displayViews}
              hideDate={!PageStore.get('config-media-item').displayPublishDate}
              canEdit={isMediaAuthor}
            />
            {isMediaAuthor && 0 === this.state.channelMediaCount && !this.state.query ? (
              <EmptyChannelMedia name={this.state.author.name} />
            ) : null}
          </MediaListWrapper>
        </ProfilePagesContent>
      ) : null,
    ];
  }
}

ProfileMediaPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ProfileMediaPage.defaultProps = {
  title: 'Uploads',
};
