import React from 'react';
import { MediaListRow } from './MediaListRow';
import './MediaListWrapper.scss';

interface MediaListWrapperProps {
  title?: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
  style?: { [key: string]: any };
  children?: any;
}

export const MediaListWrapper: React.FC<MediaListWrapperProps> = ({
  title,
  viewAllLink,
  viewAllText,
  className,
  style,
  children,
}) => (
  <div className={(className ? className + ' ' : '') + 'media-list-wrapper'} style={style}>
    <MediaListRow title={title} viewAllLink={viewAllLink} viewAllText={viewAllText}>
      {children || null}
    </MediaListRow>
  </div>
);
