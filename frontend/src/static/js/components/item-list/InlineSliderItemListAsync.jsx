import React, { useEffect } from 'react';
import { PageStore } from '../../utils/stores/';
import { useLayout, useItemListInlineSlider } from '../../utils/hooks/';
import { ItemListAsync } from './ItemListAsync';
import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { ItemsListHandler } from './includes/itemLists/ItemsListHandler';

export function InlineSliderItemListAsync(props) {
  const { visibleSidebar } = useLayout();

  const [
    items,
    countedItems,
    listHandler,
    classname,
    setListHandler,
    onItemsCount,
    onItemsLoad,
    winResizeListener,
    sidebarVisibilityChangeListener,
    itemsListWrapperRef,
    itemsListRef,
    renderBeforeListWrap,
    renderAfterListWrap,
  ] = useItemListInlineSlider(props);

  useEffect(() => {
    sidebarVisibilityChangeListener();
  }, [visibleSidebar]);

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

    PageStore.on('window_resize', winResizeListener);

    return () => {
      PageStore.removeListener('window_resize', winResizeListener);

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

InlineSliderItemListAsync.propTypes = {
  ...ItemListAsync.propTypes,
};

InlineSliderItemListAsync.defaultProps = {
  ...ItemListAsync.defaultProps,
  pageItems: 12,
};
