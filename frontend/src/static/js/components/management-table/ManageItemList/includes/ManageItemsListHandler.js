import { PageStore } from '../../../../utils/stores/';
import { formatInnerLink, getRequest } from '../../../../utils/helpers/';

export function ManageItemsListHandler(itemsPerPage, maxItems, request_url, itemsCountCallback, loadItemsCallback) {
  const config = {
    maxItems: maxItems || 255,
    pageItems: itemsPerPage ? Math.min(maxItems, itemsPerPage) : 1,
  };

  const state = {
    totalItems: 0,
    totalPages: 0,
    nextRequestUrl: formatInnerLink(request_url, PageStore.get('config-site').url),
  };

  const waiting = {
    pageItems: 0,
    requestResponse: false,
  };

  let firstItemUrl = null;

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
    let itemsToLoad, needExtraRequest;

    itemsLength = !isNaN(itemsLength) ? itemsLength : config.pageItems;

    if (waiting.pageItems && waiting.pageItems <= responseItems.length) {
      itemsToLoad = waiting.pageItems;
      needExtraRequest = false;
      waiting.pageItems = 0;
    } else {
      itemsToLoad = Math.min(itemsLength, responseItems.length);
      needExtraRequest = itemsLength > responseItems.length && !!state.nextRequestUrl;
      waiting.pageItems = needExtraRequest ? itemsLength - responseItems.length : 0;
    }

    if (itemsToLoad) {
      let i = 0;
      while (i < itemsToLoad) {
        items.push(responseItems.shift());
        i += 1;
      }
      callbacks.itemsLoad();
    }

    if (needExtraRequest) {
      runRequest();
    }
  }

  function runRequest(initialRequest) {
    waiting.requestResponse = true;

    function fn(response) {
      waiting.requestResponse = false;

      if (!!!response || !!!response.data) {
        return;
      }

      let data = response.data;
      let results = void 0 !== data.results ? data.results : data; // NOTE: The structure of response data in the case of categories differs from the others.

      // console.log( firstItemUrl );

      let i = 0;
      while (i < results.length && config.maxItems > responseItems.length) {
        if (null === firstItemUrl || firstItemUrl !== results[i].url) {
          responseItems.push(results[i]);
        }
        i += 1;
      }

      state.nextRequestUrl = !!data.next && config.maxItems > responseItems.length ? data.next : null;

      if (initialRequest) {
        // In some cases, (total) 'count' field is missing, but probably doesn't need (eg. in recommended media).
        state.totalItems = !!data.count ? data.count : responseItems.length;
        state.totalItems = Math.min(config.maxItems, state.totalItems);

        state.totalPages = Math.ceil(state.totalItems / config.pageItems);

        callbacks.itemsCount();
      }

      loadNextItems();
    }

    getRequest(state.nextRequestUrl, false, fn);

    state.nextRequestUrl = null;
  }

  function loadItems(itemsLength) {
    if (!waiting.requestResponse && items.length < state.totalItems) {
      loadNextItems(itemsLength);
    }
  }

  function totalPages() {
    return state.totalPages;
  }

  function loadedAllItems() {
    return items.length === state.totalItems;
  }

  runRequest(true);

  return {
    loadItems,
    totalPages,
    loadedAllItems,
  };
}
