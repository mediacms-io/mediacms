import React from 'react';

import Daw from '../daw/Daw';

export default function AttachmentPlayer() {
  return (
    <>
    <div className='daw-container-outer' key="daw-container-outer">
      <Daw></Daw>
    </div>
    <div className="player-container viewer-attachment-container">
      <div className="player-container-inner">
        <span>
          <span>
            <i className="material-icons">insert_drive_file</i>
          </span>
        </span>
      </div>
    </div>
    </>
  );
}
