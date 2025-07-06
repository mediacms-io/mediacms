import React, { useState } from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { useUser } from '../utils/hooks/';
import { addClassname } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { ProfileHistoryPage } from './ProfileHistoryPage';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

declare global {
  interface Window {
    MediaCMS: any;
  }
}

interface AnonymousHistoryPageProps {
  id?: string;
  title?: string;
}

export const AnonymousHistoryPage: React.FC<AnonymousHistoryPageProps> = ({
  id = 'history-media',
  title = translateString('History'),
}) => {
  const [resultsCount, setResultsCount] = useState<number | null>(null);

  return (
    <Page id={id}>
      <ApiUrlConsumer>
        {(apiUrl) => (
          <MediaListWrapper
            title={title + (null !== resultsCount ? ' (' + resultsCount + ')' : '')}
            className="search-results-wrap items-list-hor"
          >
            <LazyLoadItemListAsync
              singleLinkContent={false}
              horizontalItemsOrientation={true}
              itemsCountCallback={setResultsCount}
              requestUrl={apiUrl.user.history}
              hideViews={!PageStore.get('config-media-item').displayViews}
              hideAuthor={!PageStore.get('config-media-item').displayAuthor}
              hideDate={!PageStore.get('config-media-item').displayPublishDate}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};

export const HistoryPage: React.FC = () => {
  const { username, isAnonymous } = useUser();
  const anonymousPage = isAnonymous || !PageStore.get('config-options').pages.profile.includeHistory;

  if (!anonymousPage) {
    addClassname(document.getElementById('page-history'), 'profile-page-history');
    window.MediaCMS.profileId = username;
  }

  return anonymousPage ? <AnonymousHistoryPage /> : <ProfileHistoryPage />;
};
