import React from 'react';
import PropTypes from 'prop-types';

import { MaterialIcon } from '../material-icon/MaterialIcon.jsx';

export function FilterOptions(props) {
  return props.options.map((filter) => {
    return (
      <div key={filter.id} className={filter.id === props.selected ? 'active' : ''}>
        <button onClick={props.onSelect} filter={props.id} value={filter.id}>
          <span>{filter.title}</span>
          {filter.id === props.selected ? <MaterialIcon type="close" /> : null}
        </button>
      </div>
    );
  });
}

FilterOptions.propTypes = {
  id: PropTypes.string.isRequired,
  selected: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};
