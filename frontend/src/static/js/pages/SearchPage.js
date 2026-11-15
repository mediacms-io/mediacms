import React from 'react';
import { apiUrlConfig } from '../utils/contexts/';
import { PageStore, SearchFieldStore } from '../utils/stores/';
import { getRequest } from '../utils/helpers/';
import { FiltersToggleButton, MaterialIcon } from '../components/_shared/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { SearchMediaFiltersRow } from '../components/search-filters/SearchMediaFiltersRow';
import { SearchResultsFilters } from '../components/search-filters/SearchResultsFilters';
import { Page } from './_Page';
import { translateString, inEmbeddedApp } from '../utils/helpers/';

export class SearchPage extends Page {
  constructor(props) {
    super(props, 'search-results');

    this.state = {
      validQuery: false,
      requestUrl: null,
      filterArgs: '',
      resultsTitle: null,
      resultsCount: null,
      searchQuery: SearchFieldStore.get('search-query'),
      searchCategories: SearchFieldStore.get('search-categories'),
      searchTags: SearchFieldStore.get('search-tags'),
      searchCategoryTitle: SearchFieldStore.get('search-categories'),
      categoryEditUrl: '',
      searchMediaType: SearchFieldStore.get('search-media-type'),
      searchUploadDate: SearchFieldStore.get('search-upload-date'),
      searchAuthor: SearchFieldStore.get('search-author'),
      hiddenFilters: !(SearchFieldStore.get('search-media-type') || SearchFieldStore.get('search-upload-date')),
    };

    this.state.filterArgs = this.buildFilterArgs({
      media_type: this.state.searchMediaType || null,
      upload_date: this.state.searchUploadDate || null,
    });

    this.getCountFunc = this.getCountFunc.bind(this);

    this.updateRequestUrl = this.updateRequestUrl.bind(this);
    this.onFilterArgsUpdate = this.onFilterArgsUpdate.bind(this);

    this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
    this.onFiltersUpdate = this.onFiltersUpdate.bind(this);

    this.onCategoryLoad = this.onCategoryLoad.bind(this);

    this.didMount = false;

    this.updateRequestUrl();
  }

  componentDidMount() {
    this.didMount = true;

    if (this.state.searchCategories) {
      getRequest(
        apiUrlConfig.archive.categories + '/' + encodeURIComponent(this.state.searchCategories),
        !1,
        this.onCategoryLoad
      );
    }
  }

  onCategoryLoad(response) {
    if (response && response.data && response.data.title) {
      this.setState(
        {
          searchCategoryTitle: response.data.title,
          categoryEditUrl: response.data.edit_url || '',
        },
        this.updateRequestUrl
      );
    }
  }

  onToggleFiltersClick() {
    this.setState({
      hiddenFilters: !this.state.hiddenFilters,
    });
  }

  onFiltersUpdate(updatedArgs) {
    const args = {
      media_type: null,
      upload_date: null,
      sort_by: null,
      ordering: null,
    };

    switch (updatedArgs.media_type) {
      case 'video':
      case 'audio':
      case 'image':
      case 'pdf':
        args.media_type = updatedArgs.media_type;
        break;
    }

    switch (updatedArgs.upload_date) {
      case 'today':
      case 'this_week':
      case 'this_month':
      case 'this_year':
        args.upload_date = updatedArgs.upload_date;
        break;
    }

    switch (updatedArgs.sort_by) {
      case 'most_views':
        args.sort_by = 'views';
        break;
      case 'most_likes':
        args.sort_by = 'likes';
        break;
      case 'date_added_asc':
        args.ordering = 'asc';
        break;
    }

    this.setState(
      {
        filterArgs: this.buildFilterArgs(args),
      },
      function () {
        this.updateRequestUrl();
      }
    );
  }

  updateRequestUrl() {
    const validQuery = this.state.searchQuery || this.state.searchCategories || this.state.searchTags;

    let title = null;

    if (null !== this.state.resultsCount) {
      if (!validQuery) {
        title = 'No results for "' + this.state.searchQuery + '"';
      } else {
        if (this.state.searchCategories) {
          title = null === this.state.resultsCount || 0 === this.state.resultsCount ? 'No' : this.state.resultsCount;
          title +=
            ' ' +
            translateString(inEmbeddedApp() ? 'media in course' : 'media in category') +
            ' "' +
            this.state.searchCategoryTitle +
            '"';
        } else if (this.state.searchTags) {
          title = null === this.state.resultsCount || 0 === this.state.resultsCount ? 'No' : this.state.resultsCount;
          title += ' ' + translateString('media in tag') + ' "' + this.state.searchTags + '"';
        } else {
          if (null === this.state.resultsCount || 0 === this.state.resultsCount) {
            title = translateString('No results for') + ' "' + this.state.searchQuery + '"';
          } else {
            title =
              this.state.resultsCount +
              ' result' +
              (1 < this.state.resultsCount ? 's' : '') +
              ' for "' +
              this.state.searchQuery +
              '"';
          }
        }
      }
    }

    const api_url_postfix =
      (this.state.searchQuery || '') +
      (this.state.searchTags ? '&t=' + this.state.searchTags : '') +
      (this.state.searchCategories ? '&c=' + this.state.searchCategories : '');

    const url = apiUrlConfig.search.query + api_url_postfix + this.state.filterArgs;

    if (this.didMount) {
      this.setState({
        validQuery: validQuery,
        requestUrl: url,
        resultsTitle: title,
      });
    } else {
      this.state.validQuery = validQuery;
      this.state.requestUrl = url;
      this.state.resultsTitle = title;
    }
  }

  buildFilterArgs(args) {
    const allArgs = { ...args, author: this.state.searchAuthor || null };
    const newArgs = [];

    for (let arg in allArgs) {
      if (null !== allArgs[arg] && void 0 !== allArgs[arg]) {
        newArgs.push(arg + '=' + encodeURIComponent(allArgs[arg]));
      }
    }

    return newArgs.length ? '&' + newArgs.join('&') : '';
  }

  onFilterArgsUpdate(updatedArgs) {
    this.setState(
      {
        filterArgs: this.buildFilterArgs({ upload_date: this.state.searchUploadDate || null, ...updatedArgs }),
      },
      function () {
        this.updateRequestUrl();
      }
    );
  }

  getCountFunc(resultsCount) {
    this.setState(
      {
        resultsCount: resultsCount,
      },
      function () {
        this.updateRequestUrl();
      }
    );
  }

  pageContent() {
    const advancedFilters = PageStore.get('config-options').pages.search.advancedFilters;

    return (
      <MediaListWrapper
        className="search-results-wrap items-list-hor"
        title={null === this.state.resultsTitle ? null : this.state.resultsTitle}
      >
        {advancedFilters || this.state.categoryEditUrl ? (
          <div className="mi-filters-actions">
            {advancedFilters ? <FiltersToggleButton onClick={this.onToggleFiltersClick} /> : null}
            {this.state.categoryEditUrl ? (
              <a href={this.state.categoryEditUrl} className="mi-edit-link">
                <MaterialIcon type="edit" />
                <span>{translateString('EDIT')}</span>
              </a>
            ) : null}
          </div>
        ) : null}
        {advancedFilters ? (
          <SearchResultsFilters
            hidden={this.state.hiddenFilters}
            mediaType={this.state.searchMediaType || 'all'}
            uploadDate={this.state.searchUploadDate || 'all'}
            onFiltersUpdate={this.onFiltersUpdate}
          />
        ) : null}

        {advancedFilters ? null : (
          <SearchMediaFiltersRow mediaType={this.state.searchMediaType || 'all'} onFiltersUpdate={this.onFilterArgsUpdate} />
        )}

        {!this.state.validQuery ? null : (
          <LazyLoadItemListAsync
            key={this.state.requestUrl}
            singleLinkContent={false}
            horizontalItemsOrientation={true}
            itemsCountCallback={this.getCountFunc}
            requestUrl={this.state.requestUrl}
            preferSummary={true}
            hideViews={!PageStore.get('config-media-item').displayViews}
            hideAuthor={!PageStore.get('config-media-item').displayAuthor}
            hideDate={!PageStore.get('config-media-item').displayPublishDate}
          />
        )}
      </MediaListWrapper>
    );
  }
}
