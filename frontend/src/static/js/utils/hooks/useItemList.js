import React, { useState, useEffect } from 'react';
import initItemsList from '../../components/item-list/includes/itemLists/initItemsList';
import '../../components/item-list/ItemList.scss'; // TODO: Remove it from here

export function useItemList(props, itemsListRef) {
  let previousItemsLength = 0;

  let itemsListInstance = null;

  const [items, setItems] = useState([]);

  const [countedItems, setCountedItems] = useState(false);
  const [listHandler, setListHandler] = useState(null);

  function onItemsLoad(itemsArray) {
    setItems([...itemsArray]);
  }

  function onItemsCount(totalItems) {
    setCountedItems(true);
    if (void 0 !== props.itemsCountCallback) {
      props.itemsCountCallback(totalItems);
    }
  }

  function addListItems() {
    if (previousItemsLength < items.length) {
      if (null === itemsListInstance) {
        itemsListInstance = initItemsList([itemsListRef.current])[0];
      }

      // TODO: Should get item elements from children components.
      const itemsElem = itemsListRef.current.querySelectorAll('.item');

      if (!itemsElem || !itemsElem.length) {
        return;
      }

      let i = previousItemsLength;

      while (i < items.length) {
        itemsListInstance.appendItems(itemsElem[i]);
        i += 1;
      }

      previousItemsLength = items.length;
    }
  }

  useEffect(() => {
    if (void 0 !== props.itemsLoadCallback) {
      props.itemsLoadCallback();
    }
  }, [items]);

  return [items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems];
}
