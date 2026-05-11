import React from 'react';
import { translateString, inSelectMediaEmbedMode } from '../utils/helpers/';

interface MediaListHeaderProps {
  title?: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
  style?: { [key: string]: any };
}

export const MediaListHeader: React.FC<MediaListHeaderProps> = (props) => {
  const viewAllText = props.viewAllText || translateString('VIEW ALL');
  const isSelectMediaMode = inSelectMediaEmbedMode();

  return (
    <div className={(props.className ? props.className + ' ' : '') + 'media-list-header'} style={props.style}>
      <h2>{props.title}</h2>
      {!isSelectMediaMode && props.viewAllLink ? (
        <h3>
          {' '}
          <a href={props.viewAllLink} title={viewAllText}>
            {' '}
            {viewAllText || props.viewAllLink}{' '}
          </a>{' '}
        </h3>
      ) : null}
    </div>
  );
};
