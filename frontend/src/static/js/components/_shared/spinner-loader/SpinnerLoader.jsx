import React from 'react';
import PropTypes from 'prop-types';
import './SpinnerLoader.scss';

export function SpinnerLoader(props) {
  let classname = 'spinner-loader';

  switch (props.size) {
    case 'tiny':
    case 'x-small':
    case 'small':
    case 'large':
    case 'x-large':
      classname += ' ' + props.size;
      break;
  }

  return (
    <div className={classname}>
      <svg className="circular" viewBox="25 25 50 50">
        <circle className="path" cx="50" cy="50" r="20" fill="none" strokeWidth="1.5" strokeMiterlimit="10" />
      </svg>
    </div>
  );
}

SpinnerLoader.propTypes = {
  size: PropTypes.oneOf(['tiny', 'x-small', 'small', 'medium', 'large', 'x-large']),
};

SpinnerLoader.defaultProps = {
  size: 'medium',
};
