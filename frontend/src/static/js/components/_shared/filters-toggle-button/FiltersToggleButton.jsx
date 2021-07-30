import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { MaterialIcon } from '../material-icon/MaterialIcon.jsx';

export function FiltersToggleButton(props) {
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

FiltersToggleButton.propTypes = {
  onClick: PropTypes.func,
  active: PropTypes.bool,
};

FiltersToggleButton.defaultProps = {
  active: false,
};
