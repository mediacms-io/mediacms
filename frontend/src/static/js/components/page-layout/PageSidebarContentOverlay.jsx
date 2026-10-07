import React from 'react';
import { useLayout } from '../../utils/hooks/';
import './PageSidebarContentOverlay.scss';

export const PageSidebarContentOverlay = () => {
  const { visibleSidebar, toggleSidebar } = useLayout();

  function onClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (visibleSidebar) {
      toggleSidebar();
    }
  }

  return <div className="page-sidebar-content-overlay" onClick={onClick}></div>;
};
