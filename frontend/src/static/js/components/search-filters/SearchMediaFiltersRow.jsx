import React, { useState, useEffect } from 'react';
import { useMediaFilter } from '../../utils/hooks/';
import { MaterialIcon, PopupMain } from '../_shared';

function MediaFilterOption(props) {
  function onSelectOption() {
    props.onSelect(props.id);
  }

  return (
    <div className="media-filter-option">
      <button className={props.selected ? 'active' : ''} onClick={onSelectOption}>
        {props.label}
      </button>
    </div>
  );
}

function MediaFilterOptionsList(props) {
  const [selected, setSelected] = useState(props.default);

  function onSelectOption(newId) {
    setSelected(newId);

    if ('function' === typeof props.onSelect) {
      props.onSelect(newId);
    }
  }

  function renderOptions(selected) {
    const ret = [];

    let i = 0;

    while (i < props.items.length) {
      if (props.hideOptionOnSelect) {
        if (props.items[i].id !== selected) {
          ret.push(
            <MediaFilterOption
              key={props.items[i].id}
              id={props.items[i].id}
              label={props.items[i].label}
              selected={props.items[i].id === selected}
              onSelect={onSelectOption}
            />
          );
        }
      } else {
        ret.push(
          <MediaFilterOption
            key={props.items[i].id}
            id={props.items[i].id}
            label={props.items[i].label}
            selected={props.items[i].id === selected}
            onSelect={onSelectOption}
          />
        );
      }

      i += 1;
    }

    return ret;
  }

  return <div className="media-filter-option-list">{renderOptions(selected)}</div>;
}

function MediaTypesFilter(props) {
  const [containerRef, value, setValue, popupContentRef, PopupContent, PopupTrigger] = useMediaFilter(props.default);

  const [label, setLabel] = useState(props.label);

  useEffect(() => {
    popupContentRef.current.tryToHide();

    if (props.updateTriggerButtonOnChange) {
      let i = 0;
      while (i < props.options.length) {
        if (value === props.options[i].id) {
          setLabel(props.options[i].label);
          break;
        }
        i += 1;
      }
    }

    if ('function' === typeof props.onSelect) {
      props.onSelect(value);
    }
  }, [value]);

  return (
    <div ref={containerRef} className="media-filter">
      <PopupTrigger contentRef={popupContentRef}>
        <button className="popup-trigger" aria-label="Filter">
          <span className="filter-button-label">
            <span className="filter-button-label-text">{label}</span>
            <MaterialIcon type="arrow_drop_down" />
          </span>
        </button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef}>
        <div className="main-options">
          <PopupMain>
            <MediaFilterOptionsList
              items={props.options}
              default={value}
              onSelect={setValue}
              hideOptionOnSelect={props.hideOptionOnSelect}
            />
          </PopupMain>
        </div>
      </PopupContent>
    </div>
  );
}

function MediaSortingFilter(props) {
  const [containerRef, value, setValue, popupContentRef, PopupContent, PopupTrigger] = useMediaFilter(props.default);

  useEffect(() => {
    popupContentRef.current.tryToHide();

    if ('function' === typeof props.onSelect) {
      props.onSelect(value);
    }
  }, [value]);

  return (
    <div ref={containerRef} className="media-filter">
      <PopupTrigger contentRef={popupContentRef}>
        <button className="popup-trigger" aria-label="Filter">
          <MaterialIcon type="sort" />
          <span className="filter-button-label">
            <span className="filter-button-label-text">{props.label}</span>
          </span>
        </button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef}>
        <div className="main-options">
          <PopupMain>
            <MediaFilterOptionsList items={props.options} default={value} onSelect={setValue} />
          </PopupMain>
        </div>
      </PopupContent>
    </div>
  );
}

const typeFilters = [
  {
    id: 'all',
    label: 'All media types',
  },
  {
    id: 'video',
    label: 'Video',
  },
  {
    id: 'audio',
    label: 'Audio',
  },
  {
    id: 'image',
    label: 'Images',
  },
  {
    id: 'pdf',
    label: 'Pdf',
  },
];

const sortingOptions = [
  {
    id: 'date_added_desc',
    label: 'Upload date (newest)',
  },
  {
    id: 'date_added_asc',
    label: 'Upload date (oldest)',
  },
  {
    id: 'most_views',
    label: 'View count',
  },
  {
    id: 'most_likes',
    label: 'Like count',
  },
];

export function SearchMediaFiltersRow(props) {
  const [selectedFilterTypeId, setSelectedFilterTypeId] = useState('all');
  const [selectedSortId, setSelectedSortId] = useState('date_added_desc');

  const [args, setArgs] = useState({
    sort_by: null,
    ordering: null,
    media_type: null,
  });

  function updateFiltersArgs() {
    const newArgs = {
      ...args,
      media_type: null,
      sort_by: null,
      ordering: null,
    };

    switch (selectedFilterTypeId) {
      case 'video':
        newArgs.media_type = 'video';
        break;
      case 'audio':
        newArgs.media_type = 'audio';
        break;
      case 'image':
        newArgs.media_type = 'image';
        break;
      case 'pdf':
        newArgs.media_type = 'pdf';
        break;
    }

    switch (selectedSortId) {
      case 'most_views':
        newArgs.sort_by = 'views';
        newArgs.ordering = null;
        break;
      case 'most_likes':
        newArgs.sort_by = 'likes';
        newArgs.ordering = null;
        break;
      case 'date_added_asc':
        newArgs.sort_by = null;
        newArgs.ordering = 'asc';
        break;
    }

    setArgs(newArgs);
  }

  function onSelectFilterTypeOption(newFilterTypeId) {
    setSelectedFilterTypeId(newFilterTypeId);
  }
  function onSelectSortOption(newSortId) {
    setSelectedSortId(newSortId);
  }

  useEffect(() => {
    updateFiltersArgs();
  }, [selectedFilterTypeId, selectedSortId]);

  useEffect(() => {
    if ('function' === typeof props.onFiltersUpdate) {
      props.onFiltersUpdate(args);
    }
  }, [args]);

  useEffect(() => {
    updateFiltersArgs();
  }, []);

  return (
    <div className="media-filters-row">
      <div className="media-filters-row-inner">
        <div className="media-type-filters">
          <MediaTypesFilter
            label={typeFilters[0].label}
            default={typeFilters[0].id}
            options={typeFilters}
            onSelect={onSelectFilterTypeOption}
            updateTriggerButtonOnChange={true}
            hideOptionOnSelect={true}
          />
        </div>
        <div className="media-filters-sort">
          <MediaSortingFilter
            label="SORT BY"
            default={sortingOptions[0].id}
            options={sortingOptions}
            onSelect={onSelectSortOption}
            updateTriggerButtonOnChange={false}
            hideOptionOnSelect={false}
          />
        </div>
      </div>
    </div>
  );
}
