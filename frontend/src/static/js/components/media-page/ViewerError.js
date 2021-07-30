import React from 'react';
import { MediaPageStore } from '../../utils/stores/';

export default class ViewerError extends React.PureComponent {
  render() {
    return (
      <div className="viewer-container" key="viewer-container-error">
        <div className="player-container player-container-error">
          <div className="player-container-inner">
            <div className="error-container">
              <div className="error-container-inner">
                <span className="icon-wrap">
                  <i className="material-icons">error_outline</i>
                </span>
                <span className="msg-wrap">{MediaPageStore.get('media-load-error-message')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
