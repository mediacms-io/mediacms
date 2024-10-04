import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

interface FeaturedMediaPageProps {
  id?: string;
  title?: string;
}

export const FeaturedMediaPage: React.FC<FeaturedMediaPageProps> = ({
  id = 'featured-media',
  title = translateString('Featured'),
}) => (
  <Page id={id}>
    <ApiUrlConsumer>
      {(apiUrl) => (
        <MediaListWrapper title={title} className="items-list-ver">
          <LazyLoadItemListAsync
            requestUrl={apiUrl.featured}
            hideViews={!PageStore.get('config-media-item').displayViews}
            hideAuthor={!PageStore.get('config-media-item').displayAuthor}
            hideDate={!PageStore.get('config-media-item').displayPublishDate}
          />
        </MediaListWrapper>
      )}
    </ApiUrlConsumer>
  </Page>
);
