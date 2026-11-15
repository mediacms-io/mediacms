import React, { useState } from 'react';
import { ApiUrlConsumer, linksConfig } from '../utils/contexts/';
import { SearchFieldStore } from '../utils/stores/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';
import { translateString, inEmbeddedApp } from '../utils/helpers/';

interface CategoriesPageProps {
  id?: string;
  title?: string;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ id = 'categories', title = inEmbeddedApp() ? translateString('Courses') : translateString('Categories') }) => {
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
                ? translateString('No categories match') + ' "' + query + '"'
                : query
                  ? translateString('Categories matching') + ' "' + query + '"'
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
              inCategoriesList={true}
              requestUrl={query ? apiUrl.archive.categories + '?q=' + encodeURIComponent(query) : apiUrl.archive.categories}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
