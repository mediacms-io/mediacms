import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext } from '../utils/contexts/';
import { PageActions } from '../utils/actions/';
import { FiltersToggleButton } from '../components/_shared';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { ManageMediaFilters } from '../components/management-table/ManageMediaFilters.jsx';
import { ManageItemList } from '../components/management-table/ManageItemList/ManageItemList';
import { Page } from './_Page';

function genReqUrl(url, filters, sort, page) {
  const ret = url + '?' + filters + ('' === filters ? '' : '&') + sort + ('' === sort ? '' : '&') + 'page=' + page;
  return ret;
}

export class ManageMediaPage extends Page {
  constructor(props) {
    super(props, 'manage-media');

    this.state = {
      resultsCount: null,
      currentPage: 1,
      requestUrl: ApiUrlContext._currentValue.manage.media,
      pageTitle: props.title,
      hiddenFilters: true,
      filterArgs: '',
      sortingArgs: '',
      sortBy: 'add_date',
      ordering: 'desc',
      refresh: 0,
    };

    this.getCountFunc = this.getCountFunc.bind(this);
    this.onTablePageChange = this.onTablePageChange.bind(this);
    this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
    this.onFiltersUpdate = this.onFiltersUpdate.bind(this);
    this.onColumnSortClick = this.onColumnSortClick.bind(this);
    this.onItemsRemoval = this.onItemsRemoval.bind(this);
    this.onItemsRemovalFail = this.onItemsRemovalFail.bind(this);
  }

  onTablePageChange(newPageUrl, updatedPage) {
    this.setState({
      currentPage: updatedPage,
      requestUrl: genReqUrl(
        ApiUrlContext._currentValue.manage.media,
        this.state.filterArgs,
        this.state.sortingArgs,
        updatedPage
      ),
    });
  }

  onToggleFiltersClick() {
    this.setState({
      hiddenFilters: !this.state.hiddenFilters,
    });
  }

  getCountFunc(resultsCount) {
    this.setState({
      resultsCount: resultsCount,
      pageTitle: this.state.pageTitle,
    });
  }

  onFiltersUpdate(updatedArgs) {
    const newArgs = [];

    for (let arg in updatedArgs) {
      if (null !== updatedArgs[arg] && 'all' !== updatedArgs[arg]) {
        newArgs.push(arg + '=' + updatedArgs[arg]);
      }
    }

    this.setState({
      filterArgs: newArgs.join('&'),
      requestUrl: genReqUrl(
        ApiUrlContext._currentValue.manage.media,
        newArgs.join('&'),
        this.state.sortingArgs,
        this.state.currentPage
      ),
    });
  }

  onColumnSortClick(sort, order) {
    const newArgs = 'sort_by=' + sort + '&ordering=' + order;
    this.setState({
      sortBy: sort,
      ordering: order,
      sortingArgs: newArgs,
      requestUrl: genReqUrl(
        ApiUrlContext._currentValue.manage.media,
        this.state.filterArgs,
        newArgs,
        this.state.currentPage
      ),
    });
  }

  onItemsRemoval(multipleItems) {
    this.setState(
      {
        resultsCount: null,
        refresh: this.state.refresh + 1,
        requestUrl: ApiUrlContext._currentValue.manage.media,
      },
      function () {
        PageActions.addNotification('The media deleted successfully.', 'mediaRemovalSucceed');
      }
    );
  }

  onItemsRemovalFail(multipleItems) {
    PageActions.addNotification('The media removal failed. Please try again.', 'mediaRemovalFailed');
  }

  pageContent() {
    return (
      <MediaListWrapper
        title={this.state.pageTitle + (null === this.state.resultsCount ? '' : ' (' + this.state.resultsCount + ')')}
        className=""
      >
        <FiltersToggleButton onClick={this.onToggleFiltersClick} />
        <ManageMediaFilters hidden={this.state.hiddenFilters} onFiltersUpdate={this.onFiltersUpdate} />
        <ManageItemList
          pageItems={50}
          manageType={'media'}
          key={this.state.requestUrl + '[' + this.state.refresh + ']'}
          requestUrl={this.state.requestUrl}
          itemsCountCallback={this.getCountFunc}
          onPageChange={this.onTablePageChange}
          sortBy={this.state.sortBy}
          ordering={this.state.ordering}
          onRowsDelete={this.onItemsRemoval}
          onRowsDeleteFail={this.onItemsRemovalFail}
          onClickColumnSort={this.onColumnSortClick}
        />
      </MediaListWrapper>
    );
  }
}

ManageMediaPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ManageMediaPage.defaultProps = {
  title: 'Manage media',
};
