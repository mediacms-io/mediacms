import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { SearchFieldStore } from '../utils/stores/';
import { translateString } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';

interface MembersPageProps {
  id?: string;
  title?: string;
}

export const MembersPage: React.FC<MembersPageProps> = ({ id = 'members', title = 'Members' }) => {
  const query = (SearchFieldStore.get('search-query') || '').trim();

  return (
    <Page id={id}>
      <ApiUrlConsumer>
        {(apiUrl) => (
          <MediaListWrapper
            title={query ? translateString('Authors matching') + ' "' + query + '"' : title}
            className="items-list-ver"
          >
            <LazyLoadItemListAsync
              key={query}
              requestUrl={query ? apiUrl.users + '?name=' + encodeURIComponent(query) : apiUrl.users}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
