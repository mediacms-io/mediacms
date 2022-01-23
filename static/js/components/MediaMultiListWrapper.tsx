import React from 'react';
import './MediaListWrapper.scss';

interface MediaMultiListWrapperProps {
  className?: string;
  style?: { [key: string]: any };
  children?: any;
}

export const MediaMultiListWrapper: React.FC<MediaMultiListWrapperProps> = ({ className, style, children }) => (
  <div className={(className ? className + ' ' : '') + 'media-list-wrapper'} style={style}>
    {children || null}
  </div>
);
