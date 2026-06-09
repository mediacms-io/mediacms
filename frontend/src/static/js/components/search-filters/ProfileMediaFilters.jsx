import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';
import { FilterOptions } from '../_shared';
import { translateString } from '../../utils/helpers/';
import '../management-table/ManageItemList-filters.scss';

const filters = {
  media_type: [
    { id: 'all', title: translateString('All') },
    { id: 'video', title: translateString('Video') },
    { id: 'audio', title: translateString('Audio') },
    { id: 'image', title: translateString('Image') },
    { id: 'pdf', title: translateString('Pdf') },
  ],
  upload_date: [
    { id: 'all', title: translateString('All') },
    { id: 'today', title: translateString('Today') },
    { id: 'this_week', title: translateString('This week') },
    { id: 'this_month', title: translateString('This month') },
    { id: 'this_year', title: translateString('This year') },
  ],
  duration: [
    { id: 'all', title: translateString('All') },
    { id: '0-20', title: translateString('00 - 20 min') },
    { id: '20-40', title: translateString('20 - 40 min') },
    { id: '40-60', title: translateString('40 - 60 min') },
    { id: '60-120', title: translateString('60 - 120 min+') },
  ],
  publish_state: [
    { id: 'all', title: translateString('All') },
    { id: 'private', title: translateString('Private') },
    { id: 'unlisted', title: translateString('Unlisted') },
    { id: 'public', title: translateString('Published') },
    { id: 'shared', title: translateString('Shared') },
  ],
  sort_by: [
    { id: 'date_added_desc', title: translateString('Upload date (newest)') },
    { id: 'date_added_asc', title: translateString('Upload date (oldest)') },
    { id: 'most_views', title: translateString('View count') },
    { id: 'most_likes', title: translateString('Like count') },
  ],
};

export function ProfileMediaFilters(props) {
  const [isHidden, setIsHidden] = useState(props.hidden);

  const [mediaTypeFilter, setFilter_media_type] = useState('all');
  const [uploadDateFilter, setFilter_upload_date] = useState('all');
  const [durationFilter, setFilter_duration] = useState('all');
  const [publishStateFilter, setFilter_publish_state] = useState('all');
  const [sortByFilter, setFilter_sort_by] = useState('date_added_desc');
  const [tagFilter, setFilter_tag] = useState('all');

  const containerRef = useRef(null);
  const innerContainerRef = useRef(null);

  // Build tags filter options from props
  const tagsOptions = [
    { id: 'all', title: 'All' },
    ...(props.tags || []).map((tag) => ({ id: tag, title: tag })),
  ];

  function onWindowResize() {
    if (!isHidden) {
      containerRef.current.style.height = 24 + innerContainerRef.current.offsetHeight + 'px';
    }
  }

  function onFilterSelect(ev) {
    const filterType = ev.currentTarget.getAttribute('filter');
    const clickedValue = ev.currentTarget.getAttribute('value');

    const args = {
      media_type: mediaTypeFilter,
      upload_date: uploadDateFilter,
      duration: durationFilter,
      publish_state: publishStateFilter,
      sort_by: props.selectedSort || sortByFilter,
      tag: props.selectedTag || tagFilter,
    };

    switch (filterType) {
      case 'media_type':
        // If clicking the currently selected filter, deselect it (set to 'all')
        args.media_type = clickedValue === mediaTypeFilter ? 'all' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_media_type(args.media_type);
        break;
      case 'upload_date':
        args.upload_date = clickedValue === uploadDateFilter ? 'all' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_upload_date(args.upload_date);
        break;
      case 'duration':
        args.duration = clickedValue === durationFilter ? 'all' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_duration(args.duration);
        break;
      case 'publish_state':
        args.publish_state = clickedValue === publishStateFilter ? 'all' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_publish_state(args.publish_state);
        break;
      case 'sort_by':
        args.sort_by = clickedValue === sortByFilter ? 'date_added_desc' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_sort_by(args.sort_by);
        break;
      case 'tag':
        args.tag = clickedValue === tagFilter ? 'all' : clickedValue;
        props.onFiltersUpdate(args);
        setFilter_tag(args.tag);
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
          <div className="mi-filter-title">{translateString('MEDIA TYPE')}</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'media_type'}
              options={filters.media_type}
              selected={mediaTypeFilter}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">{translateString('UPLOAD DATE')}</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'upload_date'}
              options={filters.upload_date}
              selected={uploadDateFilter}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">{translateString('DURATION')}</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'duration'}
              options={filters.duration}
              selected={durationFilter}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

        <div className="mi-filter">
          <div className="mi-filter-title">{translateString('PUBLISH STATE')}</div>
          <div className="mi-filter-options">
            <FilterOptions
              id={'publish_state'}
              options={filters.publish_state}
              selected={publishStateFilter}
              onSelect={onFilterSelect}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

ProfileMediaFilters.propTypes = {
  hidden: PropTypes.bool,
  tags: PropTypes.array,
  onFiltersUpdate: PropTypes.func.isRequired,
  selectedTag: PropTypes.string,
  selectedSort: PropTypes.string,
};

ProfileMediaFilters.defaultProps = {
  hidden: false,
  tags: [],
};
