import React from 'react';
export function PopupTrigger(props) {
  const onClick = () => {
    if (typeof props.onBeforeOpen === 'function') {
      props.onBeforeOpen();
    }
    props.contentRef.current.toggle();
  };
  return React.cloneElement(props.children, { onClick });
}
