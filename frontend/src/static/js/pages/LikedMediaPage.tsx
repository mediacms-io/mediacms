import React, { useState } from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { useUser } from '../utils/hooks/';
import { addClassname } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { ProfileLikedPage } from './ProfileLikedPage';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

declare global {
  interface Window {
    MediaCMS: any;
  }
}

interface AnonymousLikedMediaPageProps {
  id?: string;
  title?: string;
}

export const AnonymousLikedMediaPage: React.FC<AnonymousLikedMediaPageProps> = ({
  id = 'liked-media',
  title = translateString('Liked media'),
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
              requestUrl={apiUrl.user.liked}
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

export const LikedMediaPage: React.FC = () => {
  const { username, isAnonymous } = useUser();
  const anonymousPage = isAnonymous || !PageStore.get('config-options').pages.profile.includeLikedMedia;

  if (!anonymousPage) {
    addClassname(document.getElementById('page-liked'), 'profile-page-liked');
    window.MediaCMS.profileId = username;
  }

  return anonymousPage ? <AnonymousLikedMediaPage /> : <ProfileLikedPage />;
};
