import React, { useEffect } from 'react';
import { PageStore } from '../../utils/stores/';
import { useItemListLazyLoad } from '../../utils/hooks/';
import { ItemListAsync } from './ItemListAsync';
import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { ItemsListHandler } from './includes/itemLists/ItemsListHandler';

export function LazyLoadItemListAsync(props) {
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

LazyLoadItemListAsync.propTypes = {
  ...ItemListAsync.propTypes,
};

LazyLoadItemListAsync.defaultProps = {
  ...ItemListAsync.defaultProps,
  pageItems: 2,
};
