import React from 'react';
import { useItem } from '../../utils/hooks/';
import { UserItemMemberSince, UserItemThumbnailLink } from './includes/items/';
import { Item } from './Item';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function UserItem(rawProps) {
  const props = applyDefaultProps(rawProps, UserItem.defaultPropValues);
  const type = 'user';

  const { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper } = useItem({ ...props, type });

  function metaComponents() {
    return props.hideAllMeta ? null : (
      <span className="item-meta">
        <UserItemMemberSince date={props.publish_date} />
      </span>
    );
  }

  function thumbnailComponent() {
    return <UserItemThumbnailLink src={thumbnailUrl} title={props.title} link={props.link} />;
  }

  return (
    <div className="item member-item">
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

UserItem.defaultPropValues = {
  ...Item.defaultPropValues,
};
