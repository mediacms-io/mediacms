import React from 'react';
import { CircleIconButton, MaterialIcon } from '../_shared/';

export function OtherMediaDownloadLink(props) {
  return (
    <div className="download hidden-only-in-small">
      <a href={props.link} target="_blank" download={props.title} title="Download" rel="noreferrer">
        <CircleIconButton type="span">
          <MaterialIcon type="arrow_downward" />
        </CircleIconButton>
        <span>DOWNLOAD</span>
      </a>
    </div>
  );
}
