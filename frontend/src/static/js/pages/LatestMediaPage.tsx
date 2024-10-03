import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

interface LatestMediaPageProps {
  id?: string;
  title?: string;
}

export const LatestMediaPage: React.FC<LatestMediaPageProps> = ({
  id = 'latest-media',
  title = translateString('Recent uploads'),
}) => (
  <Page id={id}>
    <ApiUrlConsumer>
      {(apiUrl) => (
        <MediaListWrapper title={title} className="items-list-ver">
          <LazyLoadItemListAsync
            requestUrl={apiUrl.media}
            hideViews={!PageStore.get('config-media-item').displayViews}
            hideAuthor={!PageStore.get('config-media-item').displayAuthor}
            hideDate={!PageStore.get('config-media-item').displayPublishDate}
          />
        </MediaListWrapper>
      )}
    </ApiUrlConsumer>
  </Page>
);
