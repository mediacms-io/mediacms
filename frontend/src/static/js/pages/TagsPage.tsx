import React, { useState } from 'react';
import { ApiUrlConsumer, linksConfig } from '../utils/contexts/';
import { SearchFieldStore } from '../utils/stores/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';
import { translateString } from '../utils/helpers/';

interface TagsPageProps {
  id?: string;
  title?: string;
}

export const TagsPage: React.FC<TagsPageProps> = ({ id = 'tags', title = translateString('Tags') }) => {
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
                ? translateString('No tags match') + ' "' + query + '"'
                : query
                  ? translateString('Tags matching') + ' "' + query + '"'
                  : title
            }
            viewAllLink={nothingFound ? linksConfig.search.query + encodeURIComponent(query) : undefined}
            viewAllText={translateString('Search media instead')}
            className="items-list-ver"
          >
            <LazyLoadItemListAsync
              key={query}
              itemsCountCallback={setResultsCount}
              singleLinkContent={true}
              inTagsList={true}
              requestUrl={query ? apiUrl.archive.tags + '?q=' + encodeURIComponent(query) : apiUrl.archive.tags}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
