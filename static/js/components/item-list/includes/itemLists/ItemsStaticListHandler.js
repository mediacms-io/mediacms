export function ItemsStaticListHandler(itemsArray, itemsPerPage, maxItems, itemsCountCallback, loadItemsCallback) {
  const config = {
    maxItems: maxItems || 255,
    pageItems: itemsPerPage ? Math.min(maxItems, itemsPerPage) : 1,
  };

  const state = {
    totalItems: 0,
    totalPages: 0,
  };

  let results = itemsArray;

  const items = [];
  const responseItems = [];

  const callbacks = {
    itemsCount: function () {
      if ('function' === typeof itemsCountCallback) {
        itemsCountCallback(state.totalItems);
      }
    },
    itemsLoad: function () {
      if ('function' === typeof loadItemsCallback) {
        loadItemsCallback(items);
      }
    },
  };

  function loadNextItems(itemsLength) {
    itemsLength = !isNaN(itemsLength) ? itemsLength : config.pageItems;

    let itemsToLoad = Math.min(itemsLength, responseItems.length);

    if (itemsToLoad) {
      let i = 0;
      while (i < itemsToLoad) {
        items.push(responseItems.shift());
        i += 1;
      }

      callbacks.itemsLoad();
    }
  }

  function loadItems(itemsLength) {
    if (items.length < state.totalItems) {
      loadNextItems(itemsLength);
    }
  }

  function totalPages() {
    return state.totalPages;
  }

  function loadedAllItems() {
    return items.length === state.totalItems;
  }

  function cancelAll() {
    itemsCountCallback = null;
    loadItemsCallback = null;
  }

  let i = 0;
  while (i < results.length && config.maxItems > responseItems.length) {
    responseItems.push(results[i]);
    i += 1;
  }

  state.totalItems = Math.min(config.maxItems, results.length);
  state.totalPages = Math.ceil(state.totalItems / config.pageItems);

  callbacks.itemsCount();

  loadNextItems();

  return {
    loadItems,
    totalPages,
    loadedAllItems,
    cancelAll,
  };
}
