import React, { useState, useEffect } from 'react';
import { formatInnerLink } from '../helpers/';
import {
  ItemDescription,
  ItemMain,
  ItemMainInLink,
  ItemTitle,
  ItemTitleLink,
} from '../../components/list-item/includes/items';

import PageStore from '../stores/PageStore.js';

export function useItem(props) {
  const [duration, setDuration] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [publishDateTime, setPublishDateTime] = useState('');

  const itemType = props.type;

  const UnderThumbWrapper = props.singleLinkContent ? ItemMainInLink : ItemMain;

  const thumbnailUrl =
    '' === props.thumbnail ? null : formatInnerLink(props.thumbnail, PageStore.get('config-site').url);

  function titleComponent() {
    let ariaLabel = props.title;

    if ('' !== publishDate) {
      ariaLabel += ' ' + publishDate;
    }

    if ('' !== duration) {
      ariaLabel += ' ' + duration;
    }

    if (props.singleLinkContent) {
      return <ItemTitle title={props.title} ariaLabel={ariaLabel} />;
    }

    return <ItemTitleLink title={props.title} ariaLabel={ariaLabel} link={props.link} />;
  }

  function descriptionComponent() {
    if (props.hasMediaViewer && props.hasMediaViewerDescr) {
      return [
        <ItemDescription key="1" description={props.meta_description ? props.meta_description.trim() : ' '} />,
        <ItemDescription key="2" description={props.description ? props.description.trim() : ' '} />,
      ];
    }
    return <ItemDescription description={props.description.trim()} />;
  }

  useEffect(() => {
    if (void 0 !== props.onMount) {
      props.onMount();
    }
  }, []);

  return { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper };
}
