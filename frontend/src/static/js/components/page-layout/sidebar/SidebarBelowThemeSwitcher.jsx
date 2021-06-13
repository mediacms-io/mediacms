import React from 'react';
import { PageStore } from '../../../utils/stores/';

export function SidebarBelowThemeSwitcher() {
  const content = PageStore.get('config-contents').sidebar.belowThemeSwitcher;
  return content ? (
    <div className="page-sidebar-below-theme-switcher" dangerouslySetInnerHTML={{ __html: content }}></div>
  ) : null;
}
