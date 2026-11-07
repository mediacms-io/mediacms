import React, { useEffect } from 'react';
import { useItemListSync } from '../../utils/hooks/';
import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { ItemsStaticListHandler } from './includes/itemLists/ItemsStaticListHandler';
import { applyDefaultProps } from '../../utils/helpers/applyDefaultProps';

export function ItemList(rawProps) {
  const props = applyDefaultProps(rawProps, ItemList.defaultPropValues);
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
    setListHandler(new ItemsStaticListHandler(props.items, props.pageItems, props.maxItems, onItemsCount, onItemsLoad));

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

ItemList.defaultPropValues = {
  hideDate: false,
  hideViews: false,
  hideAuthor: false,
  hidePlaylistOptions: true,
  hidePlaylistOrderNumber: true,
  hideAllMeta: false,
  preferSummary: false,
  inPlaylistView: false,
  inPlaylistPage: false,
  playlistActiveItem: 1,
  playlistId: void 0,
  /* ################################################## */
  maxItems: 99999,
  // pageItems: 48,
  pageItems: 24,
  horizontalItemsOrientation: false,
  singleLinkContent: false,
  inTagsList: false,
  inCategoriesList: false,
  firstItemViewer: false,
  firstItemDescr: false,
  canEdit: false,
};
