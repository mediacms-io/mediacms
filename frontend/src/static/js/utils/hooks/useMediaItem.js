import React from 'react';
import { format } from 'timeago.js';
import { formatInnerLink } from '../helpers/';
import { PageStore } from '../stores/';
import {
  MediaItemAuthor,
  MediaItemAuthorLink,
  MediaItemMetaViews,
  MediaItemMetaDate,
  MediaItemEditLink,
  MediaItemViewLink,
} from '../../components/list-item/includes/items';
import { useItem } from './useItem';
import { replaceString } from '../../utils/helpers/';

export function itemClassname(defaultClassname, inheritedClassname, isActiveInPlaylistPlayback) {
  let classname = defaultClassname;

  if ('' !== inheritedClassname) {
    classname += ' ' + inheritedClassname;
  }

  if (isActiveInPlaylistPlayback) {
    classname += ' pl-active-item';
  }

  return classname;
}

export function useMediaItem(props) {
  const { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper } = useItem({ ...props });

  function editMediaComponent() {
    return <MediaItemEditLink link={props.editLink} />;
  }

  function viewMediaComponent() {
    return props.showSelection ? <MediaItemViewLink link={props.publishLink || props.link} /> : null;
  }

  function authorComponent() {
    if (props.hideAuthor) {
      return null;
    }

    if (props.singleLinkContent) {
      return <MediaItemAuthor name={props.author_name} />;
    }

    const authorUrl =
      '' === props.author_link ? null : formatInnerLink(props.author_link, PageStore.get('config-site').url);

    return <MediaItemAuthorLink name={props.author_name} link={authorUrl} />;
  }

  function viewsComponent() {
    return props.hideViews ? null : <MediaItemMetaViews views={props.views} />;
  }

  function dateComponent() {
    if (props.hideDate) {
      return null;
    }

    const publishDate = replaceString(format(new Date(props.publish_date)));
    const publishDateTime =
      'string' === typeof props.publish_date
        ? Date.parse(props.publish_date)
        : Date.parse(new Date(props.publish_date));

    return <MediaItemMetaDate time={props.publish_date} dateTime={publishDateTime} text={publishDate} />;
  }

  function metaComponents() {
    return props.hideAllMeta ? null : (
      <span className="item-meta">
        {authorComponent()}
        {viewsComponent()}
        {dateComponent()}
      </span>
    );
  }

  return [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper, editMediaComponent, metaComponents, viewMediaComponent];
}
