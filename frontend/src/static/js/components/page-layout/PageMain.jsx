import React from 'react';
import { useLayout } from '../../utils/hooks/';
import { PageSidebarContentOverlay } from './PageSidebarContentOverlay';

export function PageMain(props) {
  const { enabledSidebar } = useLayout();
  return (
    <div className="page-main">
      {props.children || null}
      {enabledSidebar ? <PageSidebarContentOverlay /> : null}
    </div>
  );
}
