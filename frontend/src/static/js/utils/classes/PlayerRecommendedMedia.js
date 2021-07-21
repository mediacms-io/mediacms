import { formatViewsNumber, quickSort, greaterCommonDivision, addClassname, removeClassname } from '../helpers/';
import ItemsInlineSlider from '../../components/item-list/includes/itemLists/ItemsInlineSlider';
import { MediaDurationInfo } from './MediaDurationInfo';

const _MediaDurationInfo = new MediaDurationInfo();

function itemDuration(duration) {
  return '<span class="more-media-duration"><span>' + duration + '</span></span>';
}

function itemThumb(img, duration) {
  return img
    ? '<span class="more-media-item-thumb" style="background-image:url(\'' +
    img +
    '\');">' +
    itemDuration(duration) +
    '</span>'
    : '';
}

function itemTitle(title) {
  return '<span class="more-media-title">' + title + '</span>';
}

function itemAuthor(author) {
  return '<span class="more-media-author">' + author + '</span>';
}

function itemViews(views, hideViews) {
  return hideViews ? '' : '<span class="more-media-views">' + views + '</span>';
}

function itemMeta(author, views, hideViews) {
  return '<span class="more-media-meta">' + itemAuthor(author) + itemViews(views, hideViews) + '</span>';
}

function itemContent(title, author, views, hideViews) {
  return '<span class="more-media-item-content">' + itemTitle(title) + itemMeta(author, views, hideViews) + '</span>';
}

function generateRatiosGrids(columnsArr, rowsArr, itemsLength, viewportWidth, viewportHeight) {
  let i = 0,
    j,
    rw,
    rh,
    gcd,
    ret = {};

  let defaultRatioWidth = 16;
  let defaultRatioheight = 9;

  while (i < columnsArr.length) {
    j = 0;

    while (j < rowsArr.length) {
      rw = defaultRatioWidth * columnsArr[i];
      rh = defaultRatioheight * rowsArr[j];

      gcd = greaterCommonDivision(rw, rh);

      if (1 < gcd) {
        rw = rw / gcd;
        rh = rh / gcd;
      }

      if (columnsArr[i] * (rowsArr[j] - 1) < itemsLength) {
        ret[rw + '/' + rh] = ret[rw + '/' + rh] || { val: rw / rh, grid: [] };
        ret[rw + '/' + rh].grid.push([columnsArr[i], rowsArr[j]]);
      }

      j += 1;
    }

    i += 1;
  }

  return ret;
}

function matchedRatioGrids(ratios, ww, wh, pw, ph, pr, itemWidthBreakpoint) {
  let dist = [],
    pntr = {},
    ret = [];
  let x, k, availableGrids;

  if (3 * itemWidthBreakpoint <= pw) {
    ret = 1.6 < pr ? [4, 3] : [3, 4];
  } else if (1.5 * itemWidthBreakpoint >= pw) {
    if (160 >= ph) {
      ret = [1, 1];
    } else if (320 >= ph) {
      ret = [1, 2];
    } else if (480 >= ph) {
      ret = [1, 3];
    } else if (640 >= ph) {
      ret = [1, 4];
    } else if (800 >= ph) {
      ret = [1, 6];
    } else {
      ret = [1, 6];
    }
  } else if (2.5 * itemWidthBreakpoint >= pw) {
    ret = [2, 1];

    if (160 >= ph) {
      ret = [2, 1];
    } else if (320 >= ph) {
      ret = [2, 2];
    } else if (480 >= ph) {
      ret = [2, 3];
    } else if (640 >= ph) {
      ret = [2, 4];
    } else if (800 >= ph) {
      ret = [2, 5];
    } else {
      ret = [2, 6];
    }
  }

  if (!ret.length) {
    for (k in ratios) {
      if (ratios.hasOwnProperty(k)) {
        x = Math.abs(pr - ratios[k].val);
        dist.push(x);
        pntr[x] = k;
      }
    }

    availableGrids = ratios[pntr[quickSort(dist, 0, dist.length - 1)[0]]].grid;

    if (1 < availableGrids.length) {
      dist = [];
      pntr = {};
      k = 0;
      while (k < availableGrids.length) {
        x = Math.abs(pw - availableGrids[k][0] * itemWidthBreakpoint);
        dist.push(x);
        pntr[x] = k;
        k += 1;
      }
      ret = availableGrids[pntr[quickSort(dist, 0, dist.length - 1)[0]]];
    } else {
      ret = availableGrids[0];
    }

    if (2 * itemWidthBreakpoint >= pw) {
      ret[0] = Math.min(2, ret[0]);
    } else if (3 * itemWidthBreakpoint >= pw) {
      ret[0] = Math.min(3, ret[0]);
    }

    if (390 >= ph) {
      ret[1] = Math.min(2, ret[1]);
    } else if (590 >= ph) {
      ret[1] = Math.min(3, ret[1]);
    }
  }

  return ret;
}

function gridClassname(itemsLength, container) {
  if (!itemsLength || !container || !container.firstChild) {
    return '';
  }
  const ww = window.outerWidth;
  const wh = window.outerHeight;
  const child = container.firstChild;
  const pw = child.offsetWidth;
  const ph = child.offsetHeight;
  const pr = pw / ph;
  let ret = matchedRatioGrids(
    generateRatiosGrids([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], itemsLength, parseInt(ww, 10), parseInt(wh, 10)),
    ww,
    wh,
    pw,
    ph,
    pr,
    250
  );
  return ret.length ? ' grid-col-' + ret[0] + ' grid-row-' + ret[1] : '';
}

function buildItemsElements(itemsData, items, wrapper, inEmbed, hideViews) {
  let i = 0;

  while (i < itemsData.length) {
    _MediaDurationInfo.update(itemsData[i].duration);

    items[i] = document.createElement('div');

    items[i].setAttribute('class', 'more-media-item before-more-media-item-load');
    items[i].setAttribute('style', '--n: ' + i);

    items[i].innerHTML =
      '<a href="' +
      itemsData[i].url +
      '" title="' +
      itemsData[i].title +
      '"' +
      (inEmbed ? 'target="_blank"' : '') +
      '>' +
      itemThumb(itemsData[i].thumbnail_url, _MediaDurationInfo.toString()) +
      itemContent(
        itemsData[i].title,
        itemsData[i].author_name,
        formatViewsNumber(itemsData[i].views) + ' ' + (1 >= itemsData[i].views ? 'view' : 'views'),
        hideViews
      ) +
      '</a>';

    wrapper.appendChild(items[i]);

    i += 1;
  }
}

export function PlayerRecommendedMedia(itemsData, inEmbed, hideViews) {
  inEmbed = inEmbed || false;

  let container = null;

  function updateSlider(afterItemsUpdate) {
    if (!inlineSlider) {
      if (!domElems.contentInner.offsetWidth) {
        return;
      }

      inlineSlider = new ItemsInlineSlider(domElems.contentInner, '.more-media-item');
      disableItemsRevealAnim();
    }

    inlineSlider.updateDataState(itemsData.length, true, true);

    updateSliderButtonsView();
  }

  function disableItemsRevealAnim() {
    setTimeout(function () {
      let i = 0;

      while (i < domElems.items.length) {
        domElems.items[i].setAttribute('class', 'more-media-item');
        domElems.items[i].setAttribute('style', null);
        i += 1;
      }
    }, domElems.items.length * 75 + 200); // NOTE: 200ms is reveal animation duration and 75ms is reveal animation delay (in CSS, with class selector '.before-more-media-item-load' ).
  }

  function updateSliderButtonsView() {
    domElems.prevSlide.style.display = inlineSlider.hasPreviousSlide() ? '' : 'none';
    domElems.nextSlide.style.display = inlineSlider.hasNextSlide() ? '' : 'none';
  }

  function toggleInlineVisibility(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    state.openInlineMoreMedia = !state.openInlineMoreMedia;
    (state.openInlineMoreMedia ? removeClassname : addClassname)(domElems.wrapper, 'hidden-inline-more-media');
    updateSlider(false);
  }

  function clickPreviousBtn(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    inlineSlider.previousSlide();
    updateSliderButtonsView();
    inlineSlider.scrollToCurrentSlide();
  }

  function clickNextBtn(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    inlineSlider.nextSlide();
    updateSliderButtonsView();
    inlineSlider.scrollToCurrentSlide();
  }

  function wrapperClassname() {
    if (null === container) {
      return;
    }

    let ret = 'more-media';

    switch (state.displayType) {
      case 'full':
        ret += ' full-wrapper';
        break;
      case 'inline-small':
        ret += ' inline-slider-small';
        break;
      case 'inline':
        ret += ' inline-slider';
        break;
    }

    ret += state.openInlineMoreMedia ? '' : ' hidden-inline-more-media';

    return ret + gridClassname(itemsData.length, container);
  }

  function updateWrapperParentStyle() {
    switch (state.displayType) {
      case 'full':
        domElems.wrapper.parentNode.style.top = '';
        break;
      case 'inline-small':
      case 'inline':
        domElems.wrapper.parentNode.style.top = 'auto';
        break;
    }
  }

  function updateWrapperClassname() {
    domElems.wrapper.setAttribute('class', wrapperClassname());
  }

  let inlineSlider;

  const domElems = {
    wrapper: document.createElement('div'),
    title: document.createElement('h2'),
    openBtn: document.createElement('button'),
    closeBtn: document.createElement('button'),
    prevSlide: document.createElement('div'),
    nextSlide: document.createElement('div'),
    prevSlideBtn: null,
    nextSlideBtn: null,
    content: document.createElement('div'),
    contentInner: document.createElement('div'),
    items: [],
  };

  const state = {
    isInited: false,
    displayType: 'inline',
    openInlineMoreMedia: true,
  };

  domElems.title.innerHTML = 'More videos';
  domElems.openBtn.innerHTML = 'More videos';
  domElems.prevSlide.innerHTML =
    '<button class="circle-icon-button"><span><span><i class="vjs-icon-navigate-before"></i></span></span></button>';
  domElems.nextSlide.innerHTML =
    '<button class="circle-icon-button"><span><span><i class="vjs-icon-navigate-next"></i></span></span></button>';

  domElems.title.setAttribute('class', 'more-media-wrap-title');
  domElems.openBtn.setAttribute('class', 'open-more-videos');
  domElems.closeBtn.setAttribute('class', 'close-more-videos vjs-icon-close');
  domElems.prevSlide.setAttribute('class', 'prev-slide');
  domElems.nextSlide.setAttribute('class', 'next-slide');

  domElems.content.appendChild(domElems.contentInner);
  domElems.wrapper.appendChild(domElems.title);
  domElems.wrapper.appendChild(domElems.openBtn);
  domElems.wrapper.appendChild(domElems.closeBtn);
  domElems.wrapper.appendChild(domElems.content);
  domElems.content.appendChild(domElems.prevSlide);
  domElems.content.appendChild(domElems.nextSlide);

  domElems.prevSlideBtn = domElems.prevSlide.querySelector('button');
  domElems.nextSlideBtn = domElems.nextSlide.querySelector('button');

  function bindEvents() {
    if (domElems.prevSlideBtn) {
      domElems.prevSlideBtn.addEventListener('click', clickPreviousBtn);
    }

    if (domElems.nextSlideBtn) {
      domElems.nextSlideBtn.addEventListener('click', clickNextBtn);
    }

    domElems.openBtn.addEventListener('click', toggleInlineVisibility);
    domElems.closeBtn.addEventListener('click', toggleInlineVisibility);
  }

  function unbindEvents() {
    if (domElems.prevSlideBtn) {
      domElems.prevSlideBtn.removeEventListener('click', clickPreviousBtn);
    }

    if (domElems.nextSlideBtn) {
      domElems.nextSlideBtn.removeEventListener('click', clickNextBtn);
    }

    domElems.openBtn.removeEventListener('click', toggleInlineVisibility);
    domElems.closeBtn.removeEventListener('click', toggleInlineVisibility);
  }

  this.html = function () {
    return domElems.wrapper;
  };

  this.onResize = function () {
    updateWrapperClassname();

    switch (state.displayType) {
      case 'inline':
        updateSlider(false);
        break;
    }
  };

  this.initWrappers = function (wrapper) {
    container = wrapper;

    updateWrapperParentStyle();
    updateWrapperClassname();
  };

  this.init = function () {
    if (!state.itemsAreBuilt) {
      state.itemsAreBuilt = true;
      buildItemsElements(itemsData, domElems.items, domElems.contentInner, inEmbed, hideViews);
    }

    switch (state.displayType) {
      case 'inline':
        if (inlineSlider) {
          updateSlider(false);
          disableItemsRevealAnim();
        } else {
          updateSlider(true);
        }
        break;
    }
  };

  this.destroy = function () {
    unbindEvents();
  };

  this.updateDisplayType = function (type) {
    let newType, i;

    switch (type) {
      case 'full':
      case 'inline':
      case 'inline-small':
        newType = type;
        break;
    }

    if (newType && newType !== state.displayType) {
      state.displayType = newType;

      updateWrapperParentStyle();
      updateWrapperClassname();

      i = 0;
      while (i < domElems.items.length) {
        domElems.items[i].setAttribute('class', 'more-media-item before-more-media-item-load');
        domElems.items[i].setAttribute('style', '--n: ' + i);
        i += 1;
      }

      switch (newType) {
        case 'full':
          disableItemsRevealAnim();
          break;
      }
    }
  };

  bindEvents();
}
