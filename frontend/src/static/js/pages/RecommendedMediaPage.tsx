import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

interface RecommendedMediaPageProps {
  id?: string;
  title?: string;
}

export const RecommendedMediaPage: React.FC<RecommendedMediaPageProps> = ({
  id = 'recommended-media',
  title = translateString('Recommended'),
}) => (
  <Page id={id}>
    <ApiUrlConsumer>
      {(apiUrl) => (
        <MediaListWrapper title={title} className="items-list-ver">
          <LazyLoadItemListAsync
            requestUrl={apiUrl.recommended}
            hideViews={!PageStore.get('config-media-item').displayViews}
            hideAuthor={!PageStore.get('config-media-item').displayAuthor}
            hideDate={!PageStore.get('config-media-item').displayPublishDate}
          />
        </MediaListWrapper>
      )}
    </ApiUrlConsumer>
  </Page>
);
