import React, { useEffect, useRef } from 'react';
import { useItemList } from './useItemList';
import { translateString } from '../../utils/helpers/';

export function useItemListSync(props) {
  const itemsListRef = useRef(null);
  const itemsListWrapperRef = useRef(null);

  const [items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems] = useItemList(
    props,
    itemsListRef
  );

  let classname = {
    list: 'items-list',
    listOuter: 'items-list-outer' + ('string' === typeof props.className ? ' ' + props.className.trim() : ''),
  };

  function onClickLoadMore() {
    listHandler.loadItems();
  }

  function afterItemsLoad() { }

  function renderBeforeListWrap() {
    return null;
  }

  function renderAfterListWrap() {
    if (!listHandler) {
      return null;
    }

    return 1 > listHandler.totalPages() || listHandler.loadedAllItems() ? null : (
      <button className="load-more" onClick={onClickLoadMore}>
        {translateString("SHOW MORE")}
      </button>
    );
  }

  useEffect(() => {
    addListItems();
    afterItemsLoad();
  }, [items]);

  return [
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
  ];
}
