import React from 'react';
import { PageStore } from '../../../utils/stores/';

export function SidebarBottom() {
  const content = PageStore.get('config-contents').sidebar.footer;
  return content ? <div className="page-sidebar-bottom" dangerouslySetInnerHTML={{ __html: content }}></div> : null;
}
