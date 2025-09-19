import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';
import { useUser } from '../../utils/hooks/';
import { FilterOptions } from '../_shared';

import './ManageItemList-filters.scss';

const filters = {
  role: [
    { id: 'all', title: 'All' },
    { id: 'editor', title: 'Editor' },
    { id: 'manager', title: 'Manager' },
  ],
  approved: [
    { id: 'all', title: 'All' },
    { id: 'true', title: 'Yes' },
    { id: 'false', title: 'No' },
  ],
};

export function ManageUsersFilters(props) {
  const { userCan } = useUser();
  const [isHidden, setIsHidden] = useState(props.hidden);

  const [role, setFilterRole] = useState('all');
  const [approved, setFilterApproved] = useState('all');

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  function onWindowResize() {
    if (!isHidden) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  function onFilterSelect(ev) {
    const args = {
      role: role,
      is_approved: approved,
    };

    switch (ev.currentTarget.getAttribute('filter')) {
      case 'role':
        args.role = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setFilterRole(args.role);
        break;
      case 'approved':
        args.is_approved = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setFilterApproved(args.is_approved);
        break;
    }
  }

  useEffect(() => {
    setIsHidden(props.hidden);
    onWindowResize();
  }, [props.hidden]);

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    return () => PageStore.removeListener('window_resize', onWindowResize);
  }, []);

  return (
    <div ref={containerRef} className={'mi-filters-row' + (isHidden ? ' hidden' : '')}>
      <div ref={innerContainerRef} className="mi-filters-row-inner">
        <div className="mi-filter">
          <div className="mi-filter-title">ROLE</div>
          <div className="mi-filter-options">
            <FilterOptions id={'role'} options={filters.role} selected={role} onSelect={onFilterSelect} />
          </div>
        </div>
        {userCan.usersNeedsToBeApproved ? (
          <div className="mi-filter">
            <div className="mi-filter-title">APPROVED</div>
            <div className="mi-filter-options">
              <FilterOptions id={'approved'} options={filters.approved} selected={approved} onSelect={onFilterSelect} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

ManageUsersFilters.propTypes = {
  hidden: PropTypes.bool,
};

ManageUsersFilters.defaultProps = {
  hidden: false,
};
