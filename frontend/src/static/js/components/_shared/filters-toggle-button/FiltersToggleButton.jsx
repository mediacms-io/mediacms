import React, { useState } from 'react';
import { MaterialIcon } from '../material-icon/MaterialIcon.jsx';
import { applyDefaultProps } from '../../../utils/helpers/applyDefaultProps';

export function FiltersToggleButton(rawProps) {
  const props = applyDefaultProps(rawProps, FiltersToggleButton.defaultPropValues);
  const [isActive, setIsActive] = useState(props.active);

  function onClick() {
    setIsActive(!isActive);
    if (void 0 !== props.onClick) {
      props.onClick();
    }
  }

  return (
    <div className="mi-filters-toggle">
      <button className={isActive ? 'active' : ''} aria-label="Filter" onClick={onClick}>
        <MaterialIcon type="filter_list" />
        <span className="filter-button-label">
          <span className="filter-button-label-text">FILTERS</span>
        </span>
      </button>
    </div>
  );
}

FiltersToggleButton.defaultPropValues = {
  active: false,
};
