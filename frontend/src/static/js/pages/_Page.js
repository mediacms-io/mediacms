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
    return (
      <>
        <PageMain>{this.pageContent()}</PageMain>
        <Notifications />
      </>
    );
  }
}
