import React, { useEffect, useRef, useState } from 'react';
import './ToolTip.scss';

function Tooltip({ children, content, title, position = 'right', classNames = '' }) {
  const [active, setActive] = useState(false);
  const [tooltipDimensions, setTooltipDimensions] = useState({
    height: 0,
    width: 0,
  });

  const popUpRef = useRef(null);

  const showTip = () => {
    setActive(true);
  };

  const hideTip = () => {
    setActive(false);
  };

  useEffect(() => {
    if (popUpRef.current) {
      setTooltipDimensions({
        height: popUpRef.current.clientHeight || 0,
        width: popUpRef.current.clientWidth || 0,
      });
    }
  }, [active]);

  const tooltipPositionStyles = {
    right: { left: '100%', marginLeft: '10px', top: '-50%' },
    left: { right: '100%', marginRight: '10px', top: '-50%' },
    top: { left: '50%', top: `-${tooltipDimensions.height + 10}px`, transform: 'translateX(-50%)' },
    center: { top: '50%', left: '50%', translate: 'x-[-50%]' },
    'bottom-left': { left: `-${tooltipDimensions.width - 20}px`, top: '100%', marginTop: '10px' },
  };

  return (
    <div onMouseEnter={showTip} onMouseLeave={hideTip}>
      <div
        ref={popUpRef}
        className={`tooltip-box ${active ? 'show' : 'hide'} ${classNames}`}
        style={tooltipPositionStyles[position]}
      >
        {title && <div className="tooltip-title">{title}</div>}
        <div className="tooltip-content">{content}</div>
      </div>
      {children}
    </div>
  );
}

export default Tooltip;
