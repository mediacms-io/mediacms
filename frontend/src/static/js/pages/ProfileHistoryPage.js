import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { inEmbeddedApp } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { ProfileMediaPage } from './ProfileMediaPage';

export class ProfileHistoryPage extends ProfileMediaPage {
  constructor(props) {
    super(props, 'author-history');

    this.state = {
      resultsCount: null,
    };

    this.getCountFunc = this.getCountFunc.bind(this);
  }

  getCountFunc(resultsCount) {
    this.setState({
      resultsCount: resultsCount,
    });
  }

  pageContent() {
    return [
      this.state.author ? (
        <ProfilePagesHeader key="ProfilePagesHeader" author={this.state.author} type="history" hideChannelBanner={inEmbeddedApp()} />
      ) : null,
      this.state.author ? (
        <ProfilePagesContent key="ProfilePagesContent">
          <ApiUrlConsumer>
            {(apiUrl) => (
              <MediaListWrapper
                title={
                  this.props.title + (null !== this.state.resultsCount ? ' (' + this.state.resultsCount + ')' : '')
                }
                className="items-list-ver"
              >
                <LazyLoadItemListAsync
                  itemsCountCallback={this.getCountFunc}
                  requestUrl={apiUrl.user.history}
                  hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                  hideViews={!PageStore.get('config-media-item').displayViews}
                  hideDate={!PageStore.get('config-media-item').displayPublishDate}
                  canEdit={false}
                />
              </MediaListWrapper>
            )}
          </ApiUrlConsumer>
        </ProfilePagesContent>
      ) : null,
    ];
  }
}

ProfileHistoryPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ProfileHistoryPage.defaultProps = {
  title: 'History',
};
