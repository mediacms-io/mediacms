import React from 'react';
import { PageStore } from '../../../utils/stores/';

export function SidebarBelowNavigationMenu() {
  const content = PageStore.get('config-contents').sidebar.belowNavMenu;
  return content ? (
    <div className="page-sidebar-under-nav-menus" dangerouslySetInnerHTML={{ __html: content }}></div>
  ) : null;
}
