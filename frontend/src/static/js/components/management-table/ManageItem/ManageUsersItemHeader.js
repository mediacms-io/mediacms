import React from 'react';
import PropTypes from 'prop-types';
import { useManagementTableHeader } from '../../../utils/hooks/';
import { MaterialIcon } from '../../_shared/material-icon/MaterialIcon';

export function ManageUsersItemHeader(props) {
  const [sort, order, isSelected, sortByColumn, checkAll] = useManagementTableHeader({ ...props, type: 'users' });

  return (
    <div className="item manage-item manage-item-header manage-users-item">
      <div className="mi-checkbox">
        <input type="checkbox" checked={isSelected} onChange={checkAll} />
      </div>
      <div
        id="name"
        onClick={sortByColumn}
        className={'mi-name mi-col-sort' + ('name' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
      >
        Name
        <div className="mi-col-sort-icons">
          <span>
            <MaterialIcon type="arrow_drop_up" />
          </span>
          <span>
            <MaterialIcon type="arrow_drop_down" />
          </span>
        </div>
      </div>
      <div className="mi-username">Username</div>
      <div
        id="add_date"
        onClick={sortByColumn}
        className={'mi-added mi-col-sort' + ('add_date' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
      >
        Date added
        <div className="mi-col-sort-icons">
          <span>
            <MaterialIcon type="arrow_drop_up" />
          </span>
          <span>
            <MaterialIcon type="arrow_drop_down" />
          </span>
        </div>
      </div>
      {props.has_roles ? <div className="mi-role">Role</div> : null}
      {props.has_verified ? <div className="mi-verified">Verified</div> : null}
      {props.has_trusted ? <div className="mi-trusted">Trusted</div> : null}
      {props.has_approved ? <div className="mi-approved">Approved</div> : null}
      <div className="mi-featured">Featured</div>
    </div>
  );
}

ManageUsersItemHeader.propTypes = {
  sort: PropTypes.string.isRequired,
  order: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onClickColumnSort: PropTypes.func,
  onCheckAllRows: PropTypes.func,
  has_roles: PropTypes.bool,
  has_verified: PropTypes.bool,
  has_trusted: PropTypes.bool,
  has_approved: PropTypes.bool,
};

ManageUsersItemHeader.defaultProps = {
  has_roles: false,
  has_verified: false,
  has_trusted: false,
  has_approved: false,
};
