import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';
import { FilterOptions } from '../_shared';

import './ManageItemList-filters.scss';

// Get categories from window if available
const categories = window.CATEGORIES ? 
  [{ id: 'all', title: 'All' }].concat(window.CATEGORIES.map(cat => ({ id: cat, title: cat }))) : 
  [{ id: 'all', title: 'All' }];

const filters = {
  state: [
    { id: 'all', title: 'All' },
    { id: 'public', title: 'Public' },
    { id: 'private', title: 'Private' },
    { id: 'unlisted', title: 'Unlisted' },
  ],
  media_type: [
    { id: 'all', title: 'All' },
    { id: 'video', title: 'Video' },
    { id: 'audio', title: 'Audio' },
    { id: 'image', title: 'Image' },
    { id: 'pdf', title: 'Pdf' },
  ],
  encoding_status: [
    { id: 'all', title: 'All' },
    { id: 'success', title: 'Success' },
    { id: 'running', title: 'Running' },
    { id: 'pending', title: 'Pending' },
    { id: 'fail', title: 'Fail' },
  ],
  reviewed: [
    { id: 'all', title: 'All' },
    { id: 'true', title: 'Yes' },
    { id: 'false', title: 'No' },
  ],
  featured: [
    { id: 'all', title: 'All' },
    { id: 'true', title: 'Yes' },
    { id: 'false', title: 'No' },
  ],
};

export function ManageMediaFilters(props) {
  const [isHidden, setIsHidden] = useState(props.hidden);

  const [state, setState] = useState('all');
  const [mediaType, setMediaType] = useState('all');
  const [encodingStatus, setEncodingStatus] = useState('all');
  const [isFeatured, setIsFeatured] = useState('all');
  const [isReviewed, setIsReviewed] = useState('all');
  const [category, setCategory] = useState('all');

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  function onWindowResize() {
    if (!isHidden) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  function onFilterSelect(ev) {
    const args = {
      state: state,
      media_type: mediaType,
      encoding_status: encodingStatus,
      featured: isFeatured,
      is_reviewed: isReviewed,
      category: category,
    };

    switch (ev.currentTarget.getAttribute('filter')) {
      case 'state':
        args.state = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setState(args.state);
        break;
      case 'media_type':
        args.media_type = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setMediaType(args.media_type);
        break;
      case 'encoding_status':
        args.encoding_status = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setEncodingStatus(args.encoding_status);
        break;
      case 'featured':
        args.featured = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setIsFeatured(args.featured);
        break;
      case 'reviewed':
        args.is_reviewed = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setIsReviewed(args.is_reviewed);
        break;
      case 'category':
        args.category = ev.currentTarget.getAttribute('value');
        props.onFiltersUpdate(args);
        setCategory(args.category);
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
          <div className="mi-filter-title">STATE</div>
          <div className="mi-filter-options">
            <FilterOptions id={'state'} options={filters.state} selected={state} onSelect={onFilterSelect} />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">MEDIA TYPE</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'media_type'}
              options={filters.media_type}
              selected={mediaType}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">ENCODING STATUS</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'encoding_status'}
              options={filters.encoding_status}
              selected={encodingStatus}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">REVIEWED</div>
          <div className="mi-filter-options">
            <FilterOptions id={'reviewed'} options={filters.reviewed} selected={isReviewed} onSelect={onFilterSelect} />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">FEATURED</div>
          <div className="mi-filter-options">
            <FilterOptions id={'featured'} options={filters.featured} selected={isFeatured} onSelect={onFilterSelect} />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">CATEGORY</div>
          <div className="mi-filter-options">
            <FilterOptions id={'category'} options={categories} selected={category} onSelect={onFilterSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

ManageMediaFilters.propTypes = {
  hidden: PropTypes.bool,
};

ManageMediaFilters.defaultProps = {
  hidden: false,
};
