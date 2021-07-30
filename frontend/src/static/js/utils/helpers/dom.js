export function supportsSvgAsImg() {
  // @link: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/svg/asimg.js
  return document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Image', '1.1');
}

export function removeClassname(el, cls) {
  if (el.classList) {
    el.classList.remove(cls);
  } else {
    el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
}

export function addClassname(el, cls) {
  if (el.classList) {
    el.classList.add(cls);
  } else {
    el.className += ' ' + cls;
  }
}

export function hasClassname(el, cls) {
  return el.className && new RegExp('(\\s|^)' + cls + '(\\s|$)').test(el.className);
}

export const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;

export const requestAnimationFrame =
  window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

export function BrowserEvents() {
  const callbacks = {
    document: {
      visibility: [],
    },
    window: {
      resize: [],
      scroll: [],
    },
  };

  function onDocumentVisibilityChange() {
    callbacks.document.visibility.map((fn) => fn());
  }

  function onWindowResize() {
    callbacks.window.resize.map((fn) => fn());
  }

  function onWindowScroll() {
    callbacks.window.scroll.map((fn) => fn());
  }

  function windowEvents(resizeCallback, scrollCallback) {
    if ('function' === typeof resizeCallback) {
      callbacks.window.resize.push(resizeCallback);
    }

    if ('function' === typeof scrollCallback) {
      callbacks.window.scroll.push(scrollCallback);
    }
  }

  function documentEvents(visibilityChangeCallback) {
    if ('function' === typeof visibilityChangeCallback) {
      callbacks.document.visibility.push(visibilityChangeCallback);
    }
  }

  document.addEventListener('visibilitychange', onDocumentVisibilityChange);

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('scroll', onWindowScroll);

  return {
    doc: documentEvents,
    win: windowEvents,
  };
}
