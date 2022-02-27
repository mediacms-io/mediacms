import React from 'react';

import { SiteContext, SiteConsumer } from '../../utils/contexts';
import { BrowserCache } from '../../utils/classes/';

export default class Daw extends React.PureComponent {
    constructor(props) {
        super(props);

        this.browserCache = new BrowserCache(SiteContext._currentValue.id, 86400); // Keep cache data "fresh" for one day.
    }

    render() {
        return (
            <div className="daw-container" key="daw-container">
                <SiteConsumer>
                {(site) => (
                  <span>DAW placeholder</span>
                )}
              </SiteConsumer>
            </div>
        );
    }
}