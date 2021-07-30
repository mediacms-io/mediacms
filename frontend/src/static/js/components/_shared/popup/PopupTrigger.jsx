import React from 'react';
export function PopupTrigger(props) {
  const onClick = () => props.contentRef.current.toggle();
  return React.cloneElement(props.children, { onClick });
}
