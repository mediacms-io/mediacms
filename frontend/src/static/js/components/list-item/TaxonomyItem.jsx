import React from 'react';
import PropTypes from 'prop-types';
import { useItem } from '../../utils/hooks/';
import { PositiveIntegerOrZero } from '../../utils/helpers/';
import { TaxonomyItemMediaCount, itemClassname } from './includes/items/';
import { Item } from './Item';

export function TaxonomyItem(props) {
  const type = props.type;

  const { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper } = useItem({ ...props, type });

  function thumbnailComponent() {
    const attr = {
      key: 'item-thumb',
      href: props.link,
      title: props.title,
      tabIndex: '-1',
      'aria-hidden': true,
      className: 'item-thumb' + (!thumbnailUrl ? ' no-thumb' : ''),
      style: !thumbnailUrl ? null : { backgroundImage: "url('" + thumbnailUrl + "')" },
    };
    return <a {...attr}></a>;
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

TaxonomyItem.propTypes = {
  ...Item.propTypes,
  type: PropTypes.string.isRequired,
  class_name: PropTypes.string,
  media_count: PositiveIntegerOrZero,
};

TaxonomyItem.defaultProps = {
  ...Item.defaultProps,
  class_name: '',
  media_count: 0,
};
