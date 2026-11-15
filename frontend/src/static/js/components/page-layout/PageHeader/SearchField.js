import React, { useState, useEffect, useRef } from 'react';
import { useLayout, usePopup, useUser } from '../../../utils/hooks/';
import { linksConfig } from '../../../utils/contexts/';
import { PageStore, SearchFieldStore } from '../../../utils/stores/';
import { SearchFieldActions } from '../../../utils/actions/';
import { MaterialIcon, PopupMain } from '../../_shared';
import { translateString } from '../../../utils/helpers/';

import './SearchField.scss';

function indexesOf(source, find, caseSensitive) {
  let i,
    result = [];
  caseSensitive = !!caseSensitive;
  for (i = 0; i < source.length; ++i) {
    if (caseSensitive) {
      if (source.substring(i, i + find.length) === find) {
        result.push(i);
      }
    } else {
      if (source.substring(i, i + find.length).toLowerCase() === find.toLowerCase()) {
        result.push(i);
      }
    }
  }
  return result;
}

function SearchPredictionItemList(props) {
  const maxHeightValue = () => window.innerHeight - 1.75 * 56;
  const onWindowResize = () => setMaxHeight(maxHeightValue());

  const [maxHeight, setMaxHeight] = useState(maxHeightValue());

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    return () => PageStore.removeListener('window_resize', onWindowResize);
  });

  return (
    <div className="search-predictions-list" style={{ maxHeight: maxHeight + 'px' }}>
      {props.children || null}
    </div>
  );
}

function SearchPredictionItem(props) {
  const containerRef = useRef(null);

  function onKeydown(ev) {
    let item;

    switch (ev.keyCode || ev.charCode) {
      case 13: // Enter/Select.
        onClick();
        break;
      case 38: // Arrow Up.
        item = props.itemsDomArray(props.previousIndex);
        break;
      case 40: // Arrow Down.
        item = props.itemsDomArray(props.nextIndex);
        break;
    }

    if (void 0 !== item) {
      item.focus();
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  function onFocus(ev) {
    ev.target.onkeydown = onKeydown;
  }

  function onBlur(ev) {
    ev.target.onkeydown = null;
  }

  function onClick() {
    if (props.onSelect instanceof Function) {
      props.onSelect(props.value);
    }
  }

  useEffect(() => {
    props.onPredictionItemLoad(props.index, containerRef.current);
  });

  return (
    <div
      ref={containerRef}
      tabIndex="0"
      className="search-predictions-item"
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
    >
      <span dangerouslySetInnerHTML={{ __html: props.children || '' }} />
    </div>
  );
}

function trimmedPath(path) {
  return (path || '').replace(/\/+$/, '');
}

function pageSearchScopes(canSearchAuthors) {
  const path = trimmedPath(window.location.pathname);
  const media = { id: 'media', title: 'Media', action: linksConfig.search.base, name: 'q', placeholder: 'Search', predictions: true };

  if (path === trimmedPath(linksConfig.members)) {
    return canSearchAuthors
      ? [media, { id: 'members', title: 'Members', action: linksConfig.members, name: 'q', placeholder: 'Search members' }]
      : [];
  }
  if (path === trimmedPath(linksConfig.archive.categories)) {
    return [media, { id: 'categories', title: 'Category', action: linksConfig.archive.categories, name: 'q', placeholder: 'Search categories' }];
  }
  if (path === trimmedPath(linksConfig.archive.tags)) {
    return [media, { id: 'tags', title: 'Tags', action: linksConfig.archive.tags, name: 'q', placeholder: 'Search tags' }];
  }
  if (linksConfig.manage.media && path === trimmedPath(linksConfig.manage.media)) {
    return [
      { id: 'media', title: 'Media', action: linksConfig.manage.media, name: 'q', placeholder: 'Search media' },
      { id: 'members', title: 'Members', action: linksConfig.manage.users, name: 'q', placeholder: 'Search members' },
      { id: 'owner', title: 'Owner', action: linksConfig.manage.media, name: 'owner', placeholder: 'Search owners' },
    ];
  }
  return [];
}

function scopeQuery(scope) {
  return SearchFieldStore.get('owner' === scope.name ? 'search-owner' : 'search-query');
}

function defaultScope(scopes) {
  const path = trimmedPath(window.location.pathname);
  const onPage = scopes.filter((scope) => trimmedPath(scope.action) === path);
  return onPage.find((scope) => '' !== scopeQuery(scope)) || onPage[0] || scopes[0];
}

function SearchScopeFilter(props) {
  return (
    <div className={'search-field-filters' + (props.scopes[0] === props.scope ? '' : ' active')}>
      <button type="button" className="search-field-filters-button" aria-label={translateString('Search filters')} aria-haspopup="true">
        <MaterialIcon type="filter_list" />
      </button>

      <div className="search-field-filters-popup">
        <div className="search-field-filters-options" role="radiogroup" aria-label={translateString('Search in')}>
          {props.scopes.map((option) => (
            <label key={option.id}>
              <input type="radio" checked={option === props.scope} onChange={() => props.onScopeChange(option)} />
              <span>{translateString(option.title)}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SearchField(props) {
  const searchInputRef = useRef(null);
  const formRef = useRef(null);

  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [itemsDomRef, setItemsDomRef] = useState([]);

  const { visibleMobileSearch } = useLayout();
  const { userCan } = useUser();

  const [scopes] = useState(() => pageSearchScopes(!!userCan.canSearchAuthors));
  const [scope, setScope] = useState(() => (scopes.length ? defaultScope(scopes) : null));
  const isFirstScope = useRef(true);

  const [predictionItems, setPredictionItems] = useState([]);
  const [queryVal, setQueryVal] = useState(scope ? scopeQuery(scope) : SearchFieldStore.get('search-query'));

  function getItemsArr(index) {
    return -1 === index ? searchInputRef.current : itemsDomRef[index];
  }

  function onInputFocus() {
    if (predictionItems.length) {
      searchInputRef.current.onkeydown = searchInputRef.current.onkeydown || onKeydown;
    }
  }

  function onInputBlur() {
    searchInputRef.current.onkeydown = null;
  }

  function onKeydown(e) {
    const key = e.keyCode || e.charCode;

    let found = false;

    switch (key) {
      case 38: // Up Arrow.
        found = getItemsArr(predictionItems.length - 1);
        break;
      case 40: // Down Arrow.
        found = getItemsArr(0);
        break;
    }

    if (found) {
      found.focus();
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onQueryChange(ev) {
    let val = ev.target.value;

    val = 'string' !== typeof val ? val.toString() : val;

    setQueryVal(val);

    if ('' !== val.trim() && (!scope || scope.predictions)) {
      SearchFieldActions.requestPredictions(val.trim());
    }
  }

  function onPredictionSelect(val) {
    setPredictionItems([]);
    setQueryVal(val);

    setTimeout(function () {
      formRef.current.submit();
    }, 50);
  }

  function onPredictionItemLoad(index, domItem) {
    const items = itemsDomRef;
    items[index] = domItem;
    setItemsDomRef(items);
  }

  function onLoadPredictions(val, arr) {
    let i, j, useItems, itemTxt, pos;
    let prevItem, nextItem;

    let items = [];

    if (val) {
      useItems = [];

      i = 0;
      while (i < arr.length) {
        itemTxt = arr[i];
        pos = indexesOf(arr[i], val, false);

        // NOTE: Disabled to allow display results that don't include the query string (eg. found by tag name).
        /*if( ! pos.length ){
          i+=1;
          continue;
        }*/

        if (pos.length) {
          j = pos.length - 1;
          while (j >= 0) {
            itemTxt =
              itemTxt.substring(0, pos[j]) +
              '<b>' +
              itemTxt.substring(pos[j], pos[j] + val.length) +
              '</b>' +
              itemTxt.substring(pos[j] + val.length);
            j--;
          }
        }

        useItems.push([arr[i], itemTxt]);
        i += 1;
      }

      i = 0;
      while (i < useItems.length) {
        if (0 === i) {
          prevItem = -1;
          nextItem = i + 1;
        } else if (i === useItems.length - 1) {
          prevItem = i - 1;
          nextItem = -1;
        } else {
          prevItem = i - 1;
          nextItem = i + 1;
        }

        items.push(
          <SearchPredictionItem
            key={i}
            index={i}
            onPredictionItemLoad={onPredictionItemLoad}
            value={useItems[i][0]}
            onSelect={onPredictionSelect}
            itemsDomArray={getItemsArr}
            nextIndex={nextItem}
            previousIndex={prevItem}
          >
            {useItems[i][1]}
          </SearchPredictionItem>
        );
        i += 1;
      }
    }

    setPredictionItems(items);
  }

  function onFormSubmit(ev) {
    if ('' === searchInputRef.current.value.trim()) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  useEffect(() => {
    if (isFirstScope.current) {
      isFirstScope.current = false;
      return;
    }
    setPredictionItems([]);
    if ('' !== searchInputRef.current.value.trim()) {
      formRef.current.submit();
    }
  }, [scope]);

  function onPopupHide() {
    setPredictionItems([]);
  }

  useEffect(() => {
    if (visibleMobileSearch) {
      searchInputRef.current.focus();
    }
  }, [visibleMobileSearch]);

  useEffect(() => {
    if (predictionItems.length) {
      searchInputRef.current.onkeydown = searchInputRef.current.onkeydown || onKeydown;
      popupContentRef.current.tryToShow();
    } else {
      searchInputRef.current.onkeydown = null;
      popupContentRef.current.tryToHide();
    }
  }, [predictionItems]);

  useEffect(() => {
    SearchFieldStore.on('load_predictions', onLoadPredictions);

    return () => {
      SearchFieldStore.removeListener('load_predictions', onLoadPredictions);
    };
  }, []);

  return (
    <div className="search-field-wrap">
      <div>
        <form
          ref={formRef}
          method="get"
          action={scope ? scope.action : linksConfig.search.base}
          autoComplete="off"
          onSubmit={onFormSubmit}
        >
          <div>
            <div className="text-field-wrap">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={translateString(scope ? scope.placeholder : 'Search')}
                aria-label="Search"
                name={scope ? scope.name : 'q'}
                value={queryVal}
                onChange={onQueryChange}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />

              {scope ? <SearchScopeFilter scopes={scopes} scope={scope} onScopeChange={setScope} /> : null}

              <PopupContent contentRef={popupContentRef} hideCallback={onPopupHide}>
                <PopupMain>
                  <SearchPredictionItemList>{predictionItems}</SearchPredictionItemList>
                </PopupMain>
              </PopupContent>
            </div>
            <button type="submit" aria-label="Search">
              <MaterialIcon type="search" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
