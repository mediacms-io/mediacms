import React from 'react';
import { useItem } from '../../utils/hooks/';
import { TaxonomyItemMediaCount, itemClassname } from './includes/items/';
import { Item } from './Item';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function TaxonomyItem(rawProps) {
  const props = applyDefaultProps(rawProps, TaxonomyItem.defaultPropValues);
  const type = props.type;

  const { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper } = useItem({ ...props, type });

  function thumbnailComponent() {
    const attr = {
      href: props.link,
      title: props.title,
      tabIndex: '-1',
      'aria-hidden': true,
      className: 'item-thumb' + (!thumbnailUrl ? ' no-thumb' : ''),
      style: !thumbnailUrl ? null : { backgroundImage: "url('" + thumbnailUrl + "')" },
    };
    return <a key="item-thumb" {...attr}></a>;
  }

  function metaComponents() {
    return props.hideAllMeta ? null : (
      <span className="item-meta">{<TaxonomyItemMediaCount count={props.media_count} />}</span>
    );
  }

  const containerClassname = itemClassname('item ' + type + '-item', props.class_name.trim(), false);

  return (
    <div className={containerClassname}>
      <div className="item-content">
        {thumbnailComponent()}

        <UnderThumbWrapper title={props.title} link={props.link}>
          {titleComponent()}
          {metaComponents()}
          {descriptionComponent()}
        </UnderThumbWrapper>
      </div>
    </div>
  );
}

TaxonomyItem.defaultPropValues = {
  ...Item.defaultPropValues,
  class_name: '',
  media_count: 0,
};
