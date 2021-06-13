import React, { useEffect, useRef } from 'react';
import { useLayout } from '../../utils/hooks/';
import './PageSidebarContentOverlay.scss';

export function PageSidebarContentOverlay() {
  const containerRef = useRef(null);
  const { toggleSidebar } = useLayout();

  function onClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    toggleSidebar();
  }

  useEffect(() => {
    containerRef.current.addEventListener('click', onClick);
    return () => containerRef.current.removeEventListener('click', onClick);
  }, []);

  return <div ref={containerRef} className="page-sidebar-content-overlay"></div>;
}
