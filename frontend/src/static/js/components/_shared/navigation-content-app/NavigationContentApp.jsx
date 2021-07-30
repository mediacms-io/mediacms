import React, { useState, useEffect, useRef } from 'react';
import { findDOMNode } from 'react-dom';
import PropTypes from 'prop-types';

export function NavigationContentApp(props) {
  const containerRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(null);

  let changePageElements = [];

  function initEvents() {
    let domElem = findDOMNode(containerRef.current);
    let elems = domElem.querySelectorAll(props.pageChangeSelector);

    let i, pageId;

    if (elems.length) {
      i = 0;
      while (i < elems.length) {
        pageId = elems[i].getAttribute(props.pageIdSelectorAttr);
        pageId = pageId ? pageId.trim() : pageId;

        if (pageId) {
          changePageElements[i] = {
            id: pageId,
            elem: elems[i],
          };

          changePageElements[i].listener = (
            (index) => (event) =>
              changePageListener(index, event)
          )(i);
          changePageElements[i].elem.addEventListener('click', changePageElements[i].listener);
        }

        i += 1;
      }
    }

    if (props.focusFirstItemOnPageChange) {
      domElem.focus();
    }
  }

  function clearEvents() {
    let i = 0;
    while (i < changePageElements.length) {
      changePageElements[i].elem.removeEventListener('click', changePageElements[i].listener);
      i += 1;
    }
    changePageElements = [];
  }

  function changePageListener(index, event) {
    event.preventDefault();
    event.stopPropagation();
    changePage(changePageElements[index].id);
  }

  function changePage(newPage) {
    if (void 0 !== props.pages[newPage]) {
      setCurrentPage(newPage);
    }
  }

  useEffect(() => {
    if (void 0 !== props.pages[props.initPage]) {
      setCurrentPage(props.initPage);
    } else if (Object.keys(props.pages).length) {
      setCurrentPage(Object.keys(props.pages)[0]);
    } else {
      setCurrentPage(null);
    }
  }, [props.initPage]);

  useEffect(() => {
    clearEvents();

    if (currentPage) {
      initEvents();

      if ('function' === typeof props.pageChangeCallback) {
        props.pageChangeCallback(currentPage);
      }
    }
  }, [currentPage]);

  return !currentPage ? null : <div ref={containerRef}>{React.cloneElement(props.pages[currentPage])}</div>;
}

NavigationContentApp.propTypes = {
  initPage: PropTypes.string,
  pages: PropTypes.object.isRequired,
  pageChangeSelector: PropTypes.string.isRequired,
  pageIdSelectorAttr: PropTypes.string.isRequired,
  focusFirstItemOnPageChange: PropTypes.bool,
  pageChangeCallback: PropTypes.func,
};

NavigationContentApp.defaultProps = {
  focusFirstItemOnPageChange: true,
};
