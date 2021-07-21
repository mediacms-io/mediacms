import React from 'react';
import { MediaListHeader } from './MediaListHeader';

interface MediaListRowProps {
  title?: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
  style?: { [key: string]: any };
}

export const MediaListRow: React.FC<MediaListRowProps> = (props) => {
  return (
    <div className={(props.className ? props.className + ' ' : '') + 'media-list-row'} style={props.style}>
      {props.title ? (
        <MediaListHeader title={props.title} viewAllLink={props.viewAllLink} viewAllText={props.viewAllText} />
      ) : null}
      {props.children || null}
    </div>
  );
};
