import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import urlParse from 'url-parse';
import { deleteRequest, csrfToken } from '../../../utils/helpers/';
import { usePopup } from '../../../utils/hooks/';
import { PopupMain } from '../../_shared';
import { PendingItemsList } from '../../item-list/PendingItemsList.jsx';
import { renderManageItems } from './includes/functions';
import initManageItemsList from './includes/initManageItemsList';
import { ManageItemsListHandler } from './includes/ManageItemsListHandler';
import { translateString } from '../../../utils/helpers/';

import './ManageItemList.scss';

function useManageItemList(props, itemsListRef) {
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
        itemsListInstance = initManageItemsList([itemsListRef.current])[0];
      }

      // FIXME: Should get item elements from children components.
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

function useManageItemListSync(props) {
  const itemsListRef = useRef(null);
  const itemsListWrapperRef = useRef(null);

  const [items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems] = useManageItemList(
    { ...props, itemsCountCallback },
    itemsListRef
  );

  const [totalItems, setTotalItems] = useState(null);

  let classname = {
    list: 'manage-items-list',
    listOuter: 'items-list-outer' + ('string' === typeof props.className ? ' ' + props.className.trim() : ''),
  };

  function onClickLoadMore() {
    listHandler.loadItems();
  }

  function itemsCountCallback(itemsSumm) {
    setTotalItems(itemsSumm);
  }

  function afterItemsLoad() {}

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
    totalItems,
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

function pageUrlQuery(baseQuery, pageNumber) {
  let queryParams = [];
  let pos = 0;

  if ('' !== baseQuery) {
    queryParams = baseQuery.split('?')[1].split('&');

    let param;

    let i = 0;

    while (i < queryParams.length) {
      param = queryParams[i].split('=');

      if ('page' === param[0]) {
        pos = i;
        break;
      }

      i += 1;
    }
  }

  queryParams[pos] = 'page=' + pageNumber;

  return '?' + queryParams.join('&');
}

function pageUrl(parsedUrl, query) {
  return parsedUrl.set('query', query).href;
}

function BulkActions(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [selectedBulkAction, setSelectedBulkAction] = useState('');
  const [selectedItemsSize, setSelectedItemsSize] = useState(props.selectedItemsSize);

  function onBulkActionSelect(ev) {
    setSelectedBulkAction(ev.currentTarget.value);
  }

  function onClickProceed() {
    if ('function' === typeof props.onProceedRemoval) {
      props.onProceedRemoval();
    }

    popupContentRef.current.tryToHide();
  }

  function onClickCancel() {
    popupContentRef.current.tryToHide();
  }

  useEffect(() => {
    setSelectedItemsSize(props.selectedItemsSize);
  }, [props.selectedItemsSize]);

  return (
    <div className="manage-items-bulk-action">
      <select value={selectedBulkAction} onChange={onBulkActionSelect}>
        <option value="">Bulk actions</option>
        <option value="delete">Delete selected</option>
      </select>

      {!selectedItemsSize || !selectedBulkAction ? null : (
        <PopupTrigger contentRef={popupContentRef}>
          <button>Apply</button>
        </PopupTrigger>
      )}

      <PopupContent contentRef={popupContentRef}>
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Bulk removal</span>
            <span className="popup-message-main">You're willing to remove selected items permanently?</span>
          </div>
          <hr />
          <span className="popup-message-bottom">
            <button className="button-link cancel-profile-removal" onClick={onClickCancel}>
              CANCEL
            </button>
            <button className="button-link proceed-profile-removal" onClick={onClickProceed}>
              PROCEED
            </button>
          </span>
        </PopupMain>
      </PopupContent>
    </div>
  );
}

function ManageItemsOptions(props) {
  return (
    <div className={props.className}>
      <BulkActions selectedItemsSize={props.items.length} onProceedRemoval={props.onProceedRemoval} />
      {1 === props.pagesSize ? null : (
        <div className="manage-items-pagination">
          <PaginationButtons
            totalItems={props.totalItems}
            pageItems={props.pageItems}
            onPageButtonClick={props.onPageButtonClick}
            query={props.query}
          />
        </div>
      )}
    </div>
  );
}

function PaginationButtons(props) {
  const buttons = [];

  let i;

  let maxPagin = 11;

  const newPagesNumber = {
    last: Math.ceil(props.totalItems / props.pageItems),
    current: 1,
  };

  if ('' !== props.query) {
    const queryParams = props.query.split('?')[1].split('&');

    let param;

    let i = 0;
    while (i < queryParams.length) {
      param = queryParams[i].split('=');
      if ('page' === param[0]) {
        newPagesNumber.current = parseInt(param[1], 10);
        break;
      }
      i += 1;
    }
  }

  const paginButtonsData = paginationButtonsList(maxPagin, newPagesNumber);

  i = 0;
  while (i < paginButtonsData.length) {
    if ('button' === paginButtonsData[i].type) {
      buttons.push(
        <button
          key={i + '[button]'}
          onClick={props.onPageButtonClick}
          page={paginButtonsData[i].number}
          className={newPagesNumber.current === paginButtonsData[i].number ? 'active' : ''}
        >
          {paginButtonsData[i].number}
        </button>
      );
    } else if ('dots' === paginButtonsData[i].type) {
      buttons.push(
        <span key={i + '[dots]'} className="pagination-dots">
          ...
        </span>
      );
    }

    i += 1;
  }

  return buttons;
}

function paginationButtonsList(maxPagin, pagesNumber) {
  if (3 > maxPagin) {
    maxPagin = 3;
  }

  let i;

  let maxCurr;
  let maxEdge = 1;

  if (maxPagin >= pagesNumber.last) {
    maxPagin = pagesNumber.last;
    maxCurr = pagesNumber.last;
    maxEdge = 0;
  } else {
    if (5 < maxPagin) {
      if (7 >= maxPagin) {
        maxEdge = 2;
      } else {
        maxEdge = Math.floor(maxPagin / 4);
      }
    }

    maxCurr = maxPagin - 2 * maxEdge;
  }

  const currentArr = [];
  const firstArr = [];
  const lastArr = [];

  if (pagesNumber.current <= maxCurr + maxEdge - pagesNumber.current) {
    i = 1;

    while (i <= maxCurr + maxEdge) {
      currentArr.push(i);
      i += 1;
    }

    i = pagesNumber.last - maxPagin + currentArr.length + 1;

    while (i <= pagesNumber.last) {
      lastArr.push(i);
      i += 1;
    }
  } else if (pagesNumber.current > pagesNumber.last - (maxCurr + maxEdge - 1)) {
    i = pagesNumber.last - (maxCurr + maxEdge - 1);

    while (i <= pagesNumber.last) {
      currentArr.push(i);
      i += 1;
    }

    i = 1;
    while (i <= maxPagin - currentArr.length) {
      firstArr.push(i);
      i += 1;
    }
  } else {
    currentArr.push(pagesNumber.current);

    i = 1;
    while (maxCurr > currentArr.length) {
      currentArr.push(pagesNumber.current + i);

      if (maxCurr === currentArr.length) {
        break;
      }

      currentArr.unshift(pagesNumber.current - i);

      i += 1;
    }

    i = 1;
    while (i <= maxEdge) {
      firstArr.push(i);
      i += 1;
    }

    i = pagesNumber.last - (maxPagin - (firstArr.length + currentArr.length) - 1);
    while (i <= pagesNumber.last) {
      lastArr.push(i);
      i += 1;
    }
  }

  const ret = [];

  i = 0;
  while (i < firstArr.length) {
    ret.push({
      type: 'button',
      number: firstArr[i],
    });
    i += 1;
  }

  if (firstArr.length && currentArr.length && firstArr[firstArr.length - 1] + 1 < currentArr[0]) {
    ret.push({
      type: 'dots',
    });
  }

  i = 0;
  while (i < currentArr.length) {
    ret.push({
      type: 'button',
      number: currentArr[i],
    });
    i += 1;
  }

  if (currentArr.length && lastArr.length && currentArr[currentArr.length - 1] + 1 < lastArr[0]) {
    ret.push({
      type: 'dots',
    });
  }

  i = 0;
  while (i < lastArr.length) {
    ret.push({
      type: 'button',
      number: lastArr[i],
    });
    i += 1;
  }

  return ret;
}

export function ManageItemList(props) {
  const [
    countedItems,
    totalItems,
    items,
    listHandler,
    setListHandler,
    classname,
    itemsListWrapperRef,
    itemsListRef,
    onItemsCount,
    onItemsLoad,
  ] = useManageItemListSync(props);

  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedAllItems, setSelectedAllItems] = useState(false);

  const [parsedRequestUrl, setParsedRequestUrl] = useState(null);
  const [parsedRequestUrlQuery, setParsedRequestUrlQuery] = useState(null);

  function onPageButtonClick(ev) {
    const clickedPageUrl = pageUrl(
      parsedRequestUrl,
      pageUrlQuery(parsedRequestUrlQuery, ev.currentTarget.getAttribute('page'))
    );

    if ('function' === typeof props.onPageChange) {
      props.onPageChange(clickedPageUrl, ev.currentTarget.getAttribute('page'));
    }
  }

  function onBulkItemsRemoval() {
    deleteSelectedItems();
  }

  function onAllRowsCheck(selectedAllRows, tableType) {
    const newSelected = [];

    if (selectedAllRows) {
      if (items.length !== selectedItems.length) {
        let entry;

        if ('media' === tableType) {
          for (entry of items) {
            newSelected.push(entry.friendly_token);
          }
        } else if ('users' === tableType) {
          for (entry of items) {
            newSelected.push(entry.username);
          }
        } else if ('comments' === tableType) {
          for (entry of items) {
            newSelected.push(entry.uid);
          }
        }
      }
    }

    setSelectedItems(newSelected);
    setSelectedAllItems(newSelected.length === items.length);
  }

  function onRowCheck(token, isSelected) {
    if (void 0 !== token) {
      let newSelected;

      if (-1 === selectedItems.indexOf(token)) {
        if (isSelected) {
          newSelected = [...selectedItems, token];

          setSelectedItems(newSelected);
          setSelectedAllItems(newSelected.length === items.length);
        }
      } else {
        if (!isSelected) {
          newSelected = [];

          let entry;
          for (entry of selectedItems) {
            if (token !== entry) {
              newSelected.push(entry);
            }
          }

          setSelectedItems(newSelected);
          setSelectedAllItems(newSelected.length === items.length);
        }
      }
    }
  }

  function removeBulkMediaResponse(response) {
    if (response && 204 === response.status) {
      setSelectedItems([]);
      setSelectedAllItems(false);

      if ('function' === typeof props.onRowsDelete) {
        props.onRowsDelete(true);
      }
    }
  }

  function removeBulkMediaFail() {
    if ('function' === typeof props.onRowsDeleteFail) {
      props.onRowsDeleteFail(true);
    }
  }

  function deleteItem(token, isManageComments) {
    deleteRequest(
      props.requestUrl.split('?')[0] + ('comments' === props.manageType ? '?comment_ids=' : '?tokens=') + token,
      {
        headers: {
          'X-CSRFToken': csrfToken(),
        },
        tokens: token,
      },
      false,
      removeMediaResponse,
      removeMediaFail
    );
  }

  function deleteSelectedItems() {
    deleteRequest(
      props.requestUrl.split('?')[0] +
        ('comments' === props.manageType ? '?comment_ids=' : '?tokens=') +
        selectedItems.join(','),
      {
        headers: {
          'X-CSRFToken': csrfToken(),
        },
      },
      false,
      removeBulkMediaResponse,
      removeBulkMediaFail
    );
  }

  function removeMediaResponse(response) {
    if (response && 204 === response.status) {
      props.onRowsDelete(false);
    }
  }

  function removeMediaFail() {
    props.onRowsDeleteFail(false);
  }

  useEffect(() => {
    if (parsedRequestUrl) {
      setParsedRequestUrlQuery(parsedRequestUrl.query);
    }
  }, [parsedRequestUrl]);

  useEffect(() => {
    setParsedRequestUrl(urlParse(props.requestUrl));
  }, [props.requestUrl]);

  useEffect(() => {
    setListHandler(
      new ManageItemsListHandler(props.pageItems, props.maxItems, props.requestUrl, onItemsCount, onItemsLoad)
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
      <ManageItemsOptions
        totalItems={totalItems}
        pageItems={props.pageItems}
        onPageButtonClick={onPageButtonClick}
        query={parsedRequestUrlQuery || ''}
        className="manage-items-options"
        items={selectedItems}
        pagesSize={listHandler.totalPages()}
        onProceedRemoval={onBulkItemsRemoval}
      />

      <div ref={itemsListWrapperRef} className="items-list-wrap">
        <div ref={itemsListRef} className={classname.list}>
          {renderManageItems(items, {
            ...props,
            onAllRowsCheck: onAllRowsCheck,
            onRowCheck: onRowCheck,
            selectedItems: selectedItems,
            selectedAllItems: selectedAllItems,
            onDelete: deleteItem,
          })}
        </div>
      </div>

      <ManageItemsOptions
        totalItems={totalItems}
        pageItems={props.pageItems}
        onPageButtonClick={onPageButtonClick}
        query={parsedRequestUrlQuery || ''}
        className="manage-items-options popup-on-top"
        items={selectedItems}
        pagesSize={listHandler.totalPages()}
        onProceedRemoval={onBulkItemsRemoval}
      />
    </div>
  );
}

ManageItemList.defaultProps = {
  itemsCountCallback: PropTypes.func,
  maxItems: PropTypes.number.isRequired,
  pageItems: PropTypes.number.isRequired,
  requestUrl: PropTypes.string.isRequired,
  onPageChange: PropTypes.func,
  onRowsDelete: PropTypes.func,
  onRowsDeleteFail: PropTypes.func,
  pageItems: 24,
};

ManageItemList.defaultProps = {
  maxItems: 99999,
  pageItems: 24,
  requestUrl: null,
};
