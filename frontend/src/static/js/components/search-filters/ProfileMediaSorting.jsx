import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';
import { FilterOptions } from '../_shared';
import { translateString } from '../../utils/helpers/';
import '../management-table/ManageItemList-filters.scss';

const sortOptions = {
  sort_by: [
    { id: 'date_added_desc', title: translateString('Upload date - Newest') },
    { id: 'date_added_asc', title: translateString('Upload date - Oldest') },
    { id: 'alphabetically_asc', title: translateString('Alphabetically - A-Z') },
    { id: 'alphabetically_desc', title: translateString('Alphabetically - Z-A') },
    { id: 'plays_least', title: translateString('Plays - Least') },
    { id: 'plays_most', title: translateString('Plays - Most') },
    { id: 'likes_least', title: translateString('Likes - Least') },
    { id: 'likes_most', title: translateString('Likes - Most') },
  ],
};

export function ProfileMediaSorting(props) {
  const [isHidden, setIsHidden] = useState(props.hidden);
  const [sortByFilter, setFilter_sort_by] = useState('date_added_desc');

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  function onWindowResize() {
    if (!isHidden) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  function onFilterSelect(ev) {
    const sortBy = ev.currentTarget.getAttribute('value');
    setFilter_sort_by(sortBy);
    props.onSortSelect(sortBy);
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
          <div className="mi-filter-title">{translateString('SORT BY')}</div>
          <div className="mi-filter-options">
            <FilterOptions id={'sort_by'} options={sortOptions.sort_by} selected={sortByFilter} onSelect={onFilterSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

ProfileMediaSorting.propTypes = {
  hidden: PropTypes.bool,
  onSortSelect: PropTypes.func.isRequired,
};

ProfileMediaSorting.defaultProps = {
  hidden: false,
};
