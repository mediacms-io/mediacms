import React from 'react';
import PropTypes from 'prop-types';
import { useManagementTableHeader } from '../../../utils/hooks/';
import { MaterialIcon } from '../../_shared/material-icon/MaterialIcon';

export function ManageCommentsItemHeader(props) {
  const [sort, order, isSelected, sortByColumn, checkAll] = useManagementTableHeader({ ...props, type: 'comments' });

  return (
    <div className="item manage-item manage-item-header manage-comments-item">
      <div className="mi-checkbox">
        <input type="checkbox" checked={isSelected} onChange={checkAll} />
      </div>
      <div className="mi-author">Author</div>
      <div
        id="text"
        onClick={sortByColumn}
        className={'mi-comment mi-col-sort' + ('text' === sort ? ('asc' === order ? ' asc' : ' desc') : '')}
      >
        Comment
        <div className="mi-col-sort-icons">
          <span>
            <MaterialIcon type="arrow_drop_up" />
          </span>
          <span>
            <MaterialIcon type="arrow_drop_down" />
          </span>
        </div>
      </div>
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
    </div>
  );
}

ManageCommentsItemHeader.propTypes = {
  sort: PropTypes.string.isRequired,
  order: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onClickColumnSort: PropTypes.func,
  onCheckAllRows: PropTypes.func,
};
