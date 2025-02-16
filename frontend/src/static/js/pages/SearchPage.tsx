import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { debounce } from 'lodash';
import { ApiUrlContext } from '../utils/contexts';
import { FiltersToggleButton } from '../components/_shared';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { SearchMediaFiltersRow } from '../components/search-filters/SearchMediaFiltersRow';
import { SearchResultsFilters } from '../components/search-filters/SearchResultsFilters';
import { translateString } from '../utils/helpers';
import { RootState } from '../utils/stores/store';
import { setResultsCount, setSearchQuery } from '../utils/stores/actions/search';
import { PageStore } from '../utils/stores';

// TODO: add this in a helpers file
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    query: urlParams.get('q') || '',
    categories: urlParams.get('c') || '',
    tags: urlParams.get('t') || '',
  };
}

export function SearchPage() {
  const dispatch = useDispatch();

  const searchQuery = useSelector((state: RootState) => state.search.searchQuery);
  const searchCategories = useSelector((state: RootState) => state.search.categoriesQuery);
  const searchTags = useSelector((state: RootState) => state.search.tagsQuery);
  const resultsCount = useSelector((state: RootState) => state.search.resultsCount);

  const [hiddenFilters, setHiddenFilters] = useState(true);
  const [filterArgs, setFilterArgs] = useState('');

  const apiUrl = useContext(ApiUrlContext);
  const advancedFilters = PageStore.get('config-options').pages.search.advancedFilters;

  useEffect(() => {
    const { query, categories, tags } = getUrlParams();
    if (query !== '' || categories !== '' || tags !== '') {
      dispatch(setSearchQuery(query, categories, tags));
    }
  }, [dispatch]);

  useEffect(() => {
    const handlePopState = () => {
      const { query } = getUrlParams();
      dispatch(setSearchQuery(query || ''));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const { requestUrl, resultsTitle } = useMemo(() => {
    // const validQuery = searchQuery.trim() !== '' || searchCategories !== '' || searchTags !== '';
    let title: string = '';

    if (resultsCount === 0 && searchQuery === '') {
      title = 'Start typing to search for media...';
    } else if (searchCategories) {
      title = `${resultsCount || 'No'} ${translateString('media in category')} "${searchCategories}"`;
    } else if (searchTags) {
      title = `${resultsCount || 'No'} ${translateString('media in tag')} "${searchTags}"`;
    } else {
      title = resultsCount
        ? `${resultsCount} result${resultsCount > 1 ? 's' : ''} for "${searchQuery}"`
        : `${translateString('No results for')} "${searchQuery}"`;
    }

    let baseUrl = apiUrl.search.query.replace(/\?q=$/, '');
    const queryParams: string[] = [];

    if (searchQuery) queryParams.push(`q=${encodeURIComponent(searchQuery)}`);
    if (searchTags) queryParams.push(`t=${encodeURIComponent(searchTags)}`);
    if (searchCategories) queryParams.push(`c=${encodeURIComponent(searchCategories)}`);

    const api_url_postfix = queryParams.length ? `?${queryParams.join('&')}` : '';

    return {
      requestUrl: `${baseUrl}${api_url_postfix}${filterArgs}`,
      resultsTitle: title,
    };
  }, [searchQuery, searchCategories, searchTags, resultsCount, filterArgs, apiUrl]);

  function onToggleFiltersClick() {
    setHiddenFilters((prev) => !prev);
  }

  function onFiltersUpdate(updatedArgs: { media_type?: string; upload_date?: string; sort_by?: string }) {
    const args: {
      media_type: string | null;
      upload_date: string | null;
      sort_by: 'views' | 'likes' | null;
      ordering: 'asc' | 'desc' | null;
    } = {
      media_type: null,
      upload_date: null,
      sort_by: null,
      ordering: null,
    };

    if (updatedArgs.media_type && ['video', 'audio', 'image', 'pdf'].includes(updatedArgs.media_type)) {
      args.media_type = updatedArgs.media_type;
    }
    if (
      updatedArgs.upload_date &&
      ['today', 'this_week', 'this_month', 'this_year'].includes(updatedArgs.upload_date)
    ) {
      args.upload_date = updatedArgs.upload_date;
    }
    if (updatedArgs.sort_by === 'most_views') args.sort_by = 'views';
    if (updatedArgs.sort_by === 'most_likes') args.sort_by = 'likes';
    if (updatedArgs.sort_by === 'date_added_asc') args.ordering = 'asc';

    const newArgs = Object.entries(args)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    setFilterArgs(newArgs.length ? `&${newArgs}` : '');
  }

  return (
    <MediaListWrapper className="search-results-wrap items-list-hor" title={resultsTitle}>
      {advancedFilters && <FiltersToggleButton onClick={onToggleFiltersClick} />}
      {advancedFilters ? (
        <SearchResultsFilters hidden={hiddenFilters} onFiltersUpdate={onFiltersUpdate} />
      ) : (
        <SearchMediaFiltersRow onFiltersUpdate={onFiltersUpdate} />
      )}
      {searchQuery && (
        <LazyLoadItemListAsync
          key={requestUrl}
          singleLinkContent={false}
          horizontalItemsOrientation={true}
          requestUrl={requestUrl}
          preferSummary={true}
          itemsCountCallback={(count) => {
            dispatch(setResultsCount(count));
          }}
          hideViews={!PageStore.get('config-media-item').displayViews}
          hideAuthor={!PageStore.get('config-media-item').displayAuthor}
          hideDate={!PageStore.get('config-media-item').displayPublishDate}
        />
      )}
    </MediaListWrapper>
  );
}
