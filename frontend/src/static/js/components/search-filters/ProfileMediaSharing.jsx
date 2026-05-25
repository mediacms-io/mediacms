import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';
import { FilterOptions } from '../_shared';
import { translateString } from '../../utils/helpers/';
import '../management-table/ManageItemList-filters.scss';

export function ProfileMediaSharing(props) {
  const [isHidden, setIsHidden] = useState(props.hidden);

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  function onWindowResize() {
    if (!isHidden && containerRef.current && innerContainerRef.current) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  useEffect(() => {
    setIsHidden(props.hidden);
    onWindowResize();
  }, [props.hidden, props.sharedUsers, props.sharedGroups]);

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    return () => PageStore.removeListener('window_resize', onWindowResize);
  }, []);

  function onUserSelect(ev) {
    const username = ev.currentTarget.getAttribute('value');
    const newValue = (username === 'all' || username === props.selectedSharingValue) ? null : username;
    props.onSharingSelect(newValue ? 'user' : null, newValue);
  }

  function onGroupSelect(ev) {
    const name = ev.currentTarget.getAttribute('value');
    const newValue = (name === 'all' || name === props.selectedSharingValue) ? null : name;
    props.onSharingSelect(newValue ? 'group' : null, newValue);
  }

  const hasUsers = props.sharedUsers && props.sharedUsers.length > 0;
  const hasGroups = props.sharedGroups && props.sharedGroups.length > 0;

  const usersOptions = [
    { id: 'all', title: translateString('All') },
    ...(props.sharedUsers || []).map((u) => ({ id: u.username, title: u.name })),
  ];
  const groupsOptions = [
    { id: 'all', title: translateString('All') },
    ...(props.sharedGroups || []).map((g) => ({ id: g.name, title: g.name })),
  ];

  const selectedUser = props.selectedSharingType === 'user' ? props.selectedSharingValue : 'all';
  const selectedGroup = props.selectedSharingType === 'group' ? props.selectedSharingValue : 'all';

  return (
    <div ref={containerRef} className={'mi-filters-row' + (isHidden ? ' hidden' : '')}>
      <div ref={innerContainerRef} className="mi-filters-row-inner">
        {hasUsers ? (
          <div className="mi-filter mi-filter-full-width">
            <div className="mi-filter-title">{translateString(props.mode === 'shared_with_me' ? 'USERS SHARING' : 'SHARED WITH USERS')}</div>
            <div className="mi-filter-options mi-filter-options-horizontal mi-sharing-filter-options">
              <FilterOptions id="shared_user" options={usersOptions} selected={selectedUser} onSelect={onUserSelect} />
            </div>
          </div>
        ) : null}
        {hasGroups ? (
          <div className="mi-filter mi-filter-full-width">
            <div className="mi-filter-title">{translateString(props.mode === 'shared_with_me' ? 'GROUPS SHARING' : 'SHARED WITH GROUPS')}</div>
            <div className="mi-filter-options mi-filter-options-horizontal mi-sharing-filter-options">
              <FilterOptions id="shared_group" options={groupsOptions} selected={selectedGroup} onSelect={onGroupSelect} />
            </div>
          </div>
        ) : null}
        {!hasUsers && !hasGroups ? (
          <div className="mi-filter mi-filter-full-width">
            <div className="mi-filter-title">{translateString('NOT SHARED WITH ANYONE')}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

ProfileMediaSharing.propTypes = {
  hidden: PropTypes.bool,
  mode: PropTypes.string,
  sharedUsers: PropTypes.array,
  sharedGroups: PropTypes.array,
  onSharingSelect: PropTypes.func,
  selectedSharingType: PropTypes.string,
  selectedSharingValue: PropTypes.string,
};

ProfileMediaSharing.defaultProps = {
  hidden: false,
  mode: null,
  sharedUsers: [],
  sharedGroups: [],
  selectedSharingType: null,
  selectedSharingValue: null,
};
