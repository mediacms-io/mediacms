import React, { useRef, useState, useEffect } from 'react';
import { useLayout } from '../../utils/hooks/';
import { PageStore } from '../../utils/stores/';
import { SidebarNavigationMenu } from './sidebar/SidebarNavigationMenu';
import { SidebarBelowNavigationMenu } from './sidebar/SidebarBelowNavigationMenu';
import { SidebarBelowThemeSwitcher } from './sidebar/SidebarBelowThemeSwitcher';
import { SidebarThemeSwitcher } from './sidebar/SidebarThemeSwitcher';
import { SidebarBottom } from './sidebar/SidebarBottom';

import './PageSidebar.scss';

export function PageSidebar() {
  const { visibleSidebar, toggleSidebar } = useLayout();

  const containerRef = useRef(null);

  const [isRendered, setIsRendered] = useState(visibleSidebar || 492 > window.innerWidth);
  const [isFixedBottom, setIsFixedBottom] = useState(true);

  let sidebarBottomDom = null;
  let sidebarBottomDomPrevSibling = null;

  let bottomInited = false;

  let isAbsoluteThemeSwitcher = false;

  function initBottom() {
    if (bottomInited || !PageStore.get('config-contents').sidebar.footer) {
      return;
    }

    sidebarBottomDom = document.querySelector('.page-sidebar-bottom');
    sidebarBottomDomPrevSibling = sidebarBottomDom.previousSibling;

    if ('relative' !== getComputedStyle(sidebarBottomDomPrevSibling).position) {
      isAbsoluteThemeSwitcher = true;
    }

    bottomInited = true;

    PageStore.on('window_resize', onWindowResize);

    let cntr = 0;
    let sameCntr = 0;
    let siblingBottomPosition = 0;

    function bottomInitPos() {
      const newSiblingBottomPosition = sidebarBottomDomPrevSibling.offsetTop + sidebarBottomDomPrevSibling.offsetHeight;

      if (newSiblingBottomPosition !== siblingBottomPosition) {
        siblingBottomPosition = newSiblingBottomPosition;
      } else {
        sameCntr += 1;
      }

      cntr += 1;

      // Check every 10ms, until there is no change within 100ms or passed 500ms.

      if (10 > sameCntr && 50 > cntr) {
        setTimeout(bottomInitPos, 10);
      }

      onWindowResize();
    }

    bottomInitPos();
  }

  function onWindowResize() {
    let prevElem = sidebarBottomDomPrevSibling;
    let bottomElHeight = sidebarBottomDom.offsetHeight;

    if (isAbsoluteThemeSwitcher) {
      bottomElHeight += prevElem.offsetHeight;
      prevElem = prevElem.previousSibling;
    }

    setIsFixedBottom(
      !(
        prevElem.offsetTop + prevElem.offsetHeight + bottomElHeight >
        window.innerHeight - containerRef.current.offsetTop
      )
    );
  }

  function onClickSidebarContentOverlay(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    toggleSidebar();
  }

  useEffect(() => {
    setIsRendered(true);
    setTimeout(initBottom, 20); // Must delay at least 20ms.
  }, [visibleSidebar]);

  useEffect(() => {
    if (visibleSidebar || isRendered) {
      initBottom();
    }

    const sidebarContentOverlay = document.querySelector('.page-sidebar-content-overlay');

    if (sidebarContentOverlay) {
      sidebarContentOverlay.addEventListener('click', onClickSidebarContentOverlay);
    }

    return () => {
      if (bottomInited) {
        PageStore.removeListener('window_resize', onWindowResize);
      }
      if (sidebarContentOverlay) {
        sidebarContentOverlay.removeEventListener('click', onClickSidebarContentOverlay);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={'page-sidebar' + (isFixedBottom ? ' fixed-bottom' : '')}>
      <div className="page-sidebar-inner">
        {visibleSidebar || isRendered ? (
          <>
            <SidebarNavigationMenu />
            <SidebarBelowNavigationMenu />
            <SidebarThemeSwitcher />
            <SidebarBelowThemeSwitcher />
            <SidebarBottom />
          </>
        ) : null}
      </div>
    </div>
  );
}
