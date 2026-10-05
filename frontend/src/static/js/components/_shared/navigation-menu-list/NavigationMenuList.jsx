import React from 'react';
import { MaterialIcon } from '../material-icon/MaterialIcon.jsx';
import './NavigationMenuList.scss';
import { applyDefaultProps } from '../../../utils/helpers/applyDefaultProps';

// TODO: Improve components.

function NavigationMenuListItem(rawProps) {
  const props = applyDefaultProps(rawProps, NavigationMenuListItem.defaultPropValues);
  let children = [];

  const attr = props.itemAttr || {};

  if (void 0 === attr.className) {
    attr.className = '';
  } else if (attr.className) {
    attr.className += ' ';
  }

  let textPosIndex = props.text ? (!props.icon || 'right' === props.iconPos ? 0 : 1) : -1;
  let iconPosIndex = props.icon ? (props.text && 'right' === props.iconPos ? 1 : 0) : -1;

  if (-1 < textPosIndex) {
    children[textPosIndex] = <span key="Text">{props.text}</span>;
  }

  if (-1 < iconPosIndex) {
    children[iconPosIndex] = (
      <span key="Icon" className={'right' === props.iconPos ? 'menu-item-icon-right' : 'menu-item-icon'}>
        {<MaterialIcon type={props.icon} />}
      </span>
    );
  }

  switch (props.itemType) {
    case 'link':
      children = (
        <a {...(props.linkAttr || {})} href={props.link} title={props.text || null}>
          {children}
        </a>
      );
      attr.className += 'link-item' + (props.active ? ' active' : '');
      break;
    case 'button':
    case 'open-subpage':
      children = (
        <button {...(props.buttonAttr || {})} key="button">
          {children}
        </button>
      );
      break;
    case 'label':
      children = (
        <button {...(props.buttonAttr || {})} key="button">
          <span>{props.text || null}</span>
        </button>
      );
      attr.className = 'label-item';
      break;
    case 'div':
      children = (
        <div {...(props.divAttr || {})} key="div">
          {props.text || null}
        </div>
      );
      break;
  }

  if ('' !== attr.className) {
    attr.className = ' ' + attr.className;
  }

  attr.className = attr.className.trim();

  return <li {...attr}>{children}</li>;
}

NavigationMenuListItem.defaultPropValues = {
  itemType: 'link',
  iconPos: 'left',
  active: !1,
};

export function NavigationMenuList(rawProps) {
  const props = applyDefaultProps(rawProps, NavigationMenuList.defaultPropValues);
  const menuItems = props.items.map((item, index) => <NavigationMenuListItem key={index} {...item} />);
  return menuItems.length ? (
    <div className={'nav-menu' + (props.removeVerticalPadding ? ' pv0' : '')}>
      <nav>
        <ul>{menuItems}</ul>
      </nav>
    </div>
  ) : null;
}

NavigationMenuList.defaultPropValues = {
  removeVerticalPadding: false,
};
