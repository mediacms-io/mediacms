import React, { useEffect } from 'react';
import { PageStore } from '../../utils/stores/';
import { useItemListLazyLoad } from '../../utils/hooks/';
import { ItemList } from './ItemList';
import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { ItemsStaticListHandler } from './includes/itemLists/ItemsStaticListHandler';

export function LazyLoadItemList(props) {
  const [
    items,
    countedItems,
    listHandler,
    setListHandler,
    classname,
    onItemsCount,
    onItemsLoad,
    onWindowScroll,
    onDocumentVisibilityChange,
    itemsListWrapperRef,
    itemsListRef,
    renderBeforeListWrap,
    renderAfterListWrap,
  ] = useItemListLazyLoad(props);

  useEffect(() => {
    setListHandler(new ItemsStaticListHandler(props.items, props.pageItems, props.maxItems, onItemsCount, onItemsLoad));

    PageStore.on('window_scroll', onWindowScroll);
    PageStore.on('document_visibility_change', onDocumentVisibilityChange);

    onWindowScroll();

    return () => {
      PageStore.removeListener('window_scroll', onWindowScroll);
      PageStore.removeListener('document_visibility_change', onDocumentVisibilityChange);

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

LazyLoadItemList.propTypes = {
  ...ItemList.propTypes,
};

LazyLoadItemList.defaultProps = {
  ...ItemList.defaultProps,
  pageItems: 2,
};
