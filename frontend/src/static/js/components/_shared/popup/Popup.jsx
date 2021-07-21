import React from 'react';

import './Popup.scss';

const Popup = React.forwardRef((props, ref) => {
  return void 0 !== props.children ? (
    <div ref={ref} className={'popup' + (void 0 !== props.className ? ' ' + props.className : '')} style={props.style}>
      {props.children}
    </div>
  ) : null;
});

export default Popup;

export function PopupTop(props) {
  return void 0 !== props.children ? (
    <div className={'popup-top' + (void 0 !== props.className ? ' ' + props.className : '')} style={props.style}>
      {props.children}
    </div>
  ) : null;
}

export function PopupMain(props) {
  return void 0 !== props.children ? (
    <div className={'popup-main' + (void 0 !== props.className ? ' ' + props.className : '')} style={props.style}>
      {props.children}
    </div>
  ) : null;
}
