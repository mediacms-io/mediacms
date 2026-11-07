import React from 'react';

import './CircleIconButton.scss';
import { applyDefaultProps } from '../../../utils/helpers/applyDefaultProps';

export function CircleIconButton(rawProps) {
  const props = applyDefaultProps(rawProps, CircleIconButton.defaultPropValues);
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

CircleIconButton.defaultPropValues = {
  type: 'button',
  buttonShadow: false,
};
