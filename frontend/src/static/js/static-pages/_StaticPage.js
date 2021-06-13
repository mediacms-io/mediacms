import React from 'react';

import { Page as _Page } from '../pages/_Page';

export class Page extends _Page {
  pageContent() {
    return <div className="page-main-inner">{this.props.children || null}</div>;
  }
}
