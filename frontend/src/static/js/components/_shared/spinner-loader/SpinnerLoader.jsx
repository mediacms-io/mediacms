import React from 'react';
import './SpinnerLoader.scss';
import { applyDefaultProps } from '../../../utils/helpers/applyDefaultProps';

export function SpinnerLoader(rawProps) {
  const props = applyDefaultProps(rawProps, SpinnerLoader.defaultPropValues);
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

SpinnerLoader.defaultPropValues = {
  size: 'medium',
};
