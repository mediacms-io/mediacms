import React from 'react';
import { PageActions } from '../utils/actions/';
import { PageMain } from '../components/page-layout/';
import { Notifications } from '../components/_shared';

export class Page extends React.PureComponent {
  constructor(props, pageId) {
    super(props);

    if (void 0 !== pageId) {
      PageActions.initPage(pageId);
    }
  }

  render() {
    return [
      /*<div key="alert" className="alert info alert-dismissible" role="alert">
          <button type="button" className="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">×</span>
          </button>
          Media was edited!
        </div>,*/
      <PageMain key="page-main">{this.pageContent()}</PageMain>,
      <Notifications key="notifications" />,
    ];
  }
}
