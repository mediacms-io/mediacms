import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext } from '../utils/contexts/';
import { PageActions } from '../utils/actions/';
import { FiltersToggleButton } from '../components/_shared';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { ManageUsersFilters } from '../components/management-table/ManageUsersFilters.jsx';
import { ManageItemList } from '../components/management-table/ManageItemList/ManageItemList';
import { Page } from './_Page';

function genReqUrl(url, filters, sort, page) {
  const ret = url + '?' + filters + ('' === filters ? '' : '&') + sort + ('' === sort ? '' : '&') + 'page=' + page;
  return ret;
}

export class ManageUsersPage extends Page {
  constructor(props) {
    super(props, 'manage-users');

    this.state = {
      resultsCount: null,
      currentPage: 1,
      requestUrl: ApiUrlContext._currentValue.manage.users,
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
        ApiUrlContext._currentValue.manage.users,
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
    });
  }

  onFiltersUpdate(updatedArgs) {
    // console.log( "==>", updatedArgs );

    const newArgs = [];

    for (let arg in updatedArgs) {
      if (null !== updatedArgs[arg] && 'all' !== updatedArgs[arg]) {
        newArgs.push(arg + '=' + updatedArgs[arg]);
      }
    }

    // console.log( ApiUrlContext._currentValue.manage.users + ( newArgs.length ? '?' + newArgs.join('&') : '' ) );

    /*if( 1 === this.state.currentPage ){*/
    this.setState({
      filterArgs: newArgs.join('&'),
      requestUrl: genReqUrl(
        ApiUrlContext._currentValue.manage.users,
        newArgs.join('&'),
        this.state.sortingArgs,
        this.state.currentPage
      ),
    });
    /*}
    else{
      this.setState({
        filterArgs: newArgs.join('&'),
        requestUrl: ApiUrlContext._currentValue.manage.users + ( newArgs.length ? '?' + newArgs.join('&') : '' ) + '&page=' + this.state.currentPage,
      });
    }*/
  }

  onColumnSortClick(sort, order) {
    const newArgs = 'sort_by=' + sort + '&ordering=' + order;
    this.setState({
      sortBy: sort,
      ordering: order,
      sortingArgs: newArgs,
      requestUrl: genReqUrl(
        ApiUrlContext._currentValue.manage.users,
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
        requestUrl: ApiUrlContext._currentValue.manage.users,
      },
      function () {
        if (multipleItems) {
          PageActions.addNotification('The users deleted successfully.', 'usersRemovalSucceed');
        } else {
          PageActions.addNotification('The user deleted successfully.', 'userRemovalSucceed');
        }
      }
    );
  }

  onItemsRemovalFail(multipleItems) {
    if (multipleItems) {
      PageActions.addNotification('The users removal failed. Please try again.', 'usersRemovalFailed');
    } else {
      PageActions.addNotification('The user removal failed. Please try again.', 'userRemovalFailed');
    }
  }

  pageContent() {
    return [
      <MediaListWrapper
        key="2"
        title={this.props.title + (null === this.state.resultsCount ? '' : ' (' + this.state.resultsCount + ')')}
      >
        <FiltersToggleButton onClick={this.onToggleFiltersClick} />
        <ManageUsersFilters hidden={this.state.hiddenFilters} onFiltersUpdate={this.onFiltersUpdate} />
        <ManageItemList
          pageItems={50}
          manageType={'users'}
          key={this.state.requestUrl + '[' + this.state.refresh + ']'}
          itemsCountCallback={this.getCountFunc}
          requestUrl={this.state.requestUrl}
          onPageChange={this.onTablePageChange}
          sortBy={this.state.sortBy}
          ordering={this.state.ordering}
          onRowsDelete={this.onItemsRemoval}
          onRowsDeleteFail={this.onItemsRemovalFail}
          onClickColumnSort={this.onColumnSortClick}
        />
      </MediaListWrapper>,
    ];
  }
}

ManageUsersPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ManageUsersPage.defaultProps = {
  title: 'Manage users',
};
