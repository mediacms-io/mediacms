import React, { useEffect } from 'react';
import { useItemListSync } from '../../utils/hooks/';
import { ItemList } from './ItemList';
import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { ItemsListHandler } from './includes/itemLists/ItemsListHandler';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function ItemListAsync(rawProps) {
  const props = applyDefaultProps(rawProps, ItemListAsync.defaultPropValues);
  const [
    countedItems,
    items,
    listHandler,
    setListHandler,
    classname,
    itemsListWrapperRef,
    itemsListRef,
    onItemsCount,
    onItemsLoad,
    renderBeforeListWrap,
    renderAfterListWrap,
  ] = useItemListSync(props);

  useEffect(() => {
    setListHandler(
      new ItemsListHandler(
        props.pageItems,
        props.maxItems,
        props.firstItemRequestUrl,
        props.requestUrl,
        onItemsCount,
        onItemsLoad
      )
    );

    return () => {
      if (listHandler) {
        listHandler.cancelAll();
        setListHandler(null);
      }
    };
  }, []);

  return !countedItems ? (
    <PendingItemsList className={classname.listOuter} />
  ) : !items.length ? null : (
    <div className={classname.listOuter}>
      {renderBeforeListWrap()}

      <div ref={itemsListWrapperRef} className="items-list-wrap">
        <div ref={itemsListRef} className={classname.list}>
          {items.map((itm, index) => (
            <ListItem key={index} {...listItemProps(props, itm, index)} />
          ))}
        </div>
      </div>

      {renderAfterListWrap()}
    </div>
  );
}

ItemListAsync.defaultPropValues = {
  ...ItemList.defaultPropValues,
  requestUrl: null,
  firstItemRequestUrl: null,
  pageItems: 24,
};
