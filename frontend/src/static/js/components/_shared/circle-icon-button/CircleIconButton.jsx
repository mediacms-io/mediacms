import React from 'react';
import PropTypes from 'prop-types';

import './CircleIconButton.scss';

export function CircleIconButton(props) {
  const children = (
    <span>
      <span>{props.children}</span>
    </span>
  );

  const attr = {
    tabIndex: props.tabIndex || null,
    title: props.title || null,
    className:
      'circle-icon-button' +
      (void 0 !== props.className ? ' ' + props.className : '') +
      (props.buttonShadow ? ' button-shadow' : ''),
  };

  if (void 0 !== props['data-page-id']) {
    attr['data-page-id'] = props['data-page-id'];
  }

  if (void 0 !== props['aria-label']) {
    attr['aria-label'] = props['aria-label'];
  }

  if ('link' === props.type) {
    return (
      <a {...attr} href={props.href || null} rel={props.rel || null}>
        {children}
      </a>
    );
  }

  if ('span' === props.type) {
    return (
      <span {...attr} onClick={props.onClick || null}>
        {children}
      </span>
    );
  }

  return (
    <button {...attr} onClick={props.onClick || null}>
      {children}
    </button>
  );
}

CircleIconButton.propTypes = {
  type: PropTypes.oneOf(['button', 'link', 'span']),
  buttonShadow: PropTypes.bool,
  className: PropTypes.string,
};

CircleIconButton.defaultProps = {
  type: 'button',
  buttonShadow: false,
};
