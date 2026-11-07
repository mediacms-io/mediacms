import React from 'react';
import { CircleIconButton, MaterialIcon } from '../_shared/';
import { translateString } from '../../utils/helpers/';

export function OtherMediaDownloadLink(props) {
  return (
    <div className="download hidden-only-in-small" data-action-tooltip={translateString('Download')}>
      <a href={props.link} target="_blank" download={props.title} rel="noreferrer">
        <CircleIconButton type="span">
          <MaterialIcon type="arrow_downward" />
        </CircleIconButton>
        <span>{translateString('DOWNLOAD')}</span>
      </a>
    </div>
  );
}
