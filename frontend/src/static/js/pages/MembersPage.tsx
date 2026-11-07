import React, { useState } from 'react';
import { ApiUrlConsumer, linksConfig } from '../utils/contexts/';
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
  const [resultsCount, setResultsCount] = useState<number | null>(null);
  const nothingFound = '' !== query && 0 === resultsCount;

  return (
    <Page id={id}>
      <ApiUrlConsumer>
        {(apiUrl) => (
          <MediaListWrapper
            title={
              nothingFound
                ? translateString('No members match') + ' "' + query + '"'
                : query
                  ? translateString('Members matching') + ' "' + query + '"'
                  : title
            }
            viewAllLink={nothingFound ? linksConfig.search.query + encodeURIComponent(query) : undefined}
            viewAllText={translateString('Search media instead')}
            className="items-list-ver"
          >
            <LazyLoadItemListAsync
              key={query}
              itemsCountCallback={setResultsCount}
              requestUrl={query ? apiUrl.users + '?name=' + encodeURIComponent(query) : apiUrl.users}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
