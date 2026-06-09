import React from 'react';
import { ManageMediaItem } from '../../ManageItem/ManageMediaItem';
import { ManageUsersItem } from '../../ManageItem/ManageUsersItem';
import { ManageCommentsItem } from '../../ManageItem/ManageCommentsItem';
import { ManageMediaItemHeader } from '../../ManageItem/ManageMediaItemHeader';
import { ManageUsersItemHeader } from '../../ManageItem/ManageUsersItemHeader';
import { ManageCommentsItemHeader } from '../../ManageItem/ManageCommentsItemHeader';
import { useUser } from '../../../../utils/hooks/';

function useManageItem(props) {
  const itemData = props.item;

  const itemProps = {
    order: props.order,
    onCheckRow: props.onCheckRow,
    selectedRow: props.selectedRow,
    onProceedRemoval: props.onProceedRemoval,
    hideDeleteAction: props.hideDeleteAction,
    onUserUpdate: props.onUserUpdate,
    setMessage: props.setMessage,
  };

  return [itemData, itemProps];
}

function ListManageMediaItem(props) {
  const [itemData, itemProps] = useManageItem(props);

  const args = {
    ...itemProps,
    thumbnail_url: itemData.thumbnail_url,
    title: itemData.title,
    url: itemData.url.replace(' ', '%20'),
    author_name: itemData.author_name,
    author_url: itemData.author_profile,
    add_date: itemData.add_date,
    media_type: itemData.media_type,
    encoding_status: itemData.encoding_status,
    state: itemData.state,
    is_reviewed: itemData.is_reviewed,
    featured: itemData.featured,
    reported_times: itemData.reported_times,
    token: itemData.friendly_token,
  };

  return <ManageMediaItem {...args} />;
}

function ListManageUserItem(props) {
  const { userCan } = useUser();
  const [itemData, itemProps] = useManageItem(props);

  const roles = [];

  if (void 0 !== itemData.is_editor && itemData.is_editor) {
    roles.push('Editor');
  }

  if (void 0 !== itemData.is_manager && itemData.is_manager) {
    roles.push('Manager');
  }

  const args = {
    ...itemProps,
    thumbnail_url: itemData.thumbnail_url,
    name: itemData.name,
    url: itemData.url.replace(' ', '%20'),
    username: itemData.username,
    add_date: itemData.date_added,
    is_featured: itemData.is_featured,
    roles: roles,
    is_verified: true === itemData.email_is_verified,
    is_trusted: true === itemData.advancedUser,
    has_roles: void 0 !== itemData.is_editor || void 0 !== itemData.is_manager,
    has_verified: void 0 !== itemData.email_is_verified,
    has_trusted: void 0 !== itemData.advancedUser,
    is_approved: itemData.is_approved,
    has_approved: userCan.usersNeedsToBeApproved && void 0 !== itemData.is_approved,
  };

  return <ManageUsersItem {...args} />;
}

function ListManageCommentItem(props) {
  const [itemData, itemProps] = useManageItem(props);

  const args = {
    ...itemProps,
    media_url: void 0 !== itemData.media_url ? itemData.media_url.replace(' ', '%20') : void 0,
    author_name: itemData.author_name,
    author_url: itemData.author_profile,
    author_thumbnail_url: itemData.author_thumbnail_url,
    add_date: itemData.add_date,
    text: itemData.text,
    uid: itemData.uid,
  };

  return <ManageCommentsItem {...args} />;
}

function ListManageItem(props) {
  const args = {
    item: props.item,
    order: props.order,
    hideDeleteAction: false,
    onCheckRow: props.onCheckRow,
    onProceedRemoval: props.onProceedRemoval,
    onUserUpdate: props.onUserUpdate,
    setMessage: props.setMessage,
  };

  if ('media' === props.type) {
    return <ListManageMediaItem {...args} selectedRow={-1 < props.selectedItems.indexOf(props.item.friendly_token)} />;
  }

  if ('users' === props.type) {
    return <ListManageUserItem {...args} selectedRow={-1 < props.selectedItems.indexOf(props.item.username)} />;
  }

  if ('comments' === props.type) {
    return <ListManageCommentItem {...args} selectedRow={-1 < props.selectedItems.indexOf(props.item.uid)} />;
  }

  return null;
}

function ListManageItemHeader(props) {
  const { userCan } = useUser();
  const args = {
    sort: props.sort,
    order: props.order,
    selected: props.selected,
    onCheckAllRows: props.onCheckAllRows,
    onClickColumnSort: props.onClickColumnSort,
  };

  if ('media' === props.type) {
    return <ManageMediaItemHeader {...args} />;
  }

  if ('users' === props.type) {
    args.has_roles =
      props.items.length && (void 0 !== props.items[0].is_editor || void 0 !== props.items[0].is_manager);
    args.has_verified = props.items.length && void 0 !== props.items[0].email_is_verified;
    args.has_trusted = props.items.length && void 0 !== props.items[0].advancedUser;
    args.has_approved =
      userCan.usersNeedsToBeApproved &&
      props.items.length &&
      void 0 !== props.items[0].is_approved;
    return <ManageUsersItemHeader {...args} />;
  }

  if ('comments' === props.type) {
    return <ManageCommentsItemHeader {...args} />;
  }

  return null;
}

export function renderManageItems(items, props) {
  return [
    <ListManageItemHeader
      key={0}
      type={props.manageType}
      items={items}
      sort={props.sortBy}
      order={props.ordering}
      selected={props.selectedAllItems}
      onCheckAllRows={props.onAllRowsCheck}
      onClickColumnSort={props.onClickColumnSort}
    />,
    ...items.map((item, index) => (
      <ListManageItem
        key={index + 1}
        order={index + 1}
        item={item}
        type={props.manageType}
        onCheckRow={props.onRowCheck}
        onProceedRemoval={props.onDelete}
        selectedItems={props.selectedItems}
      />
    )),
  ];
}
