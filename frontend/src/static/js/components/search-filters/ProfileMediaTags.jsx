import React, { useState, useEffect, useRef } from 'react';
import { PageStore } from '../../utils/stores/';
import { FilterOptions } from '../_shared';
import { translateString } from '../../utils/helpers/';
import '../management-table/ManageItemList-filters.scss';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function ProfileMediaTags(rawProps) {
  const props = applyDefaultProps(rawProps, ProfileMediaTags.defaultPropValues);
  const [isHidden, setIsHidden] = useState(props.hidden);
  const [tagFilter, setFilter_tag] = useState('all');

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  // Build tags filter options from props
  const tagsOptions = [
    { id: 'all', title: translateString('All') },
    ...(props.tags || []).map((tag) => ({ id: tag, title: tag })),
  ];

  function onWindowResize() {
    if (!isHidden) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  function onFilterSelect(ev) {
    const tag = ev.currentTarget.getAttribute('value');
    // If clicking the currently selected tag, deselect it (set to 'all')
    const newTag = tag === tagFilter ? 'all' : tag;
    setFilter_tag(newTag);
    props.onTagSelect(newTag);
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
        <div className="mi-filter mi-filter-full-width">
          <div className="mi-filter-title">{translateString('TAGS')}</div>
          <div className="mi-filter-options mi-filter-options-horizontal">
            <FilterOptions id={'tag'} options={tagsOptions} selected={tagFilter} onSelect={onFilterSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

ProfileMediaTags.defaultPropValues = {
  hidden: false,
  tags: [],
};
