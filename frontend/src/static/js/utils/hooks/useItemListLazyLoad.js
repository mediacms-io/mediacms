import React, { useState, useEffect, useRef } from 'react';
import { PageStore } from '../stores/';
import { useItemList } from './useItemList';

export function useItemListLazyLoad(props) {
  const itemsListRef = useRef(null);
  const itemsListWrapperRef = useRef(null);

  const [items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems] = useItemList(
    props,
    itemsListRef
  );

  const [topScroll, setTopScroll] = useState(window.scrollY + 2 * window.outerHeight);

  let classname = {
    list: 'items-list',
    listOuter: 'items-list-outer' + ('string' === typeof props.className ? ' ' + props.className.trim() : ''),
  };

  function afterItemsLoad() {
    if (null === itemsListRef.current) {
      return;
    }

    onWindowScroll();

    if (listHandler.loadedAllItems()) {
      PageStore.removeListener('window_scroll', onWindowScroll);
    }
  }

  function renderBeforeListWrap() {
    return null;
  }

  function renderAfterListWrap() {
    return null;
  }

  function onWindowScroll() {
    setTopScroll(window.scrollY + 2 * window.outerHeight);
  }

  function onDocumentVisibilityChange() {
    if (!document.hidden) {
      // NOTE: The delay fixes the problem that occurs when the list loads within a non-focused browser's tab.
      setTimeout(onWindowScroll, 10);
    }
  }

  useEffect(() => {
    addListItems();
    afterItemsLoad();
  }, [items]);

  useEffect(() => {
    if (null === itemsListRef.current || null === listHandler) {
      return;
    }

    if (topScroll >= itemsListRef.current.offsetTop + itemsListRef.current.offsetHeight) {
      listHandler.loadItems();
    }
  }, [items, topScroll]);

  return [
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
  ];
}
