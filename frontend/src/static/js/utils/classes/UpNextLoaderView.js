import { addClassname, removeClassname } from '../helpers/';
import { translateString } from '../../utils/helpers/';

export function UpNextLoaderView(nextItemData) {
  var timerTimeout;

  var onTimerComplete = function () {
    window.location.href = nextItemData.url;
  };

  var showView = function () {
    removeClassname(this.vjsPlayerElem, 'vjs-mediacms-up-next-hidden');
  }.bind(this);

  var hideView = function () {
    this.cancelTimer();
    addClassname(this.vjsPlayerElem, 'vjs-mediacms-up-next-hidden');
  }.bind(this);

  var domElems = {
    nextMediaPoster: document.createElement('div'),
    wrapper: document.createElement('div'),
    inner: document.createElement('div'),
    innerContent: document.createElement('div'),
    upNextLabel: document.createElement('div'),
    nextMediaTitle: document.createElement('div'),
    nextMediaAuthor: document.createElement('div'),
    cancelNext: document.createElement('div'),
    cancelNextButton: document.createElement('button'),
    goNext: document.createElement('div'),
  };

  domElems.nextMediaPoster.setAttribute('class', 'next-media-poster');
  domElems.wrapper.setAttribute('class', 'up-next-loader');
  domElems.inner.setAttribute('class', 'up-next-loader-inner');
  domElems.goNext.setAttribute('class', 'go-next');
  domElems.cancelNext.setAttribute('class', 'up-next-cancel');

  domElems.upNextLabel.setAttribute('class', 'up-next-label');
  domElems.nextMediaTitle.setAttribute('class', 'next-media-title');
  domElems.nextMediaAuthor.setAttribute('class', 'next-media-author');

  domElems.upNextLabel.innerHTML = translateString('Up Next');
  domElems.nextMediaTitle.innerHTML = nextItemData.title;
  domElems.nextMediaAuthor.innerHTML = nextItemData.author_name;

  domElems.goNext.innerHTML =
    '<a href="' +
    nextItemData.url +
    '"><svg class="radial-timer"><circle r="30" cx="32" cy="32"></circle><circle r="25" cx="28" cy="28"></circle></svg><span></span><i class="material-icons">skip_next</i></a>';

  domElems.cancelNextButton.innerHTML = 'CANCEL';

  domElems.cancelNextButton.addEventListener('click', hideView);

  domElems.nextMediaPoster.style.backgroundImage = "url('" + nextItemData.thumbnail_url + "')";

  domElems.cancelNext.appendChild(domElems.cancelNextButton);

  domElems.innerContent.appendChild(domElems.upNextLabel);
  domElems.innerContent.appendChild(domElems.nextMediaTitle);
  domElems.innerContent.appendChild(domElems.nextMediaAuthor);
  domElems.innerContent.appendChild(domElems.goNext);
  domElems.innerContent.appendChild(domElems.cancelNext);

  domElems.inner.appendChild(domElems.innerContent);

  domElems.wrapper.appendChild(domElems.nextMediaPoster);
  domElems.wrapper.appendChild(domElems.inner);

  var pauseTimerOnScroll = false;

  function onScrollHandler() {
    var rect = this.vjsPlayerElem.getBoundingClientRect();
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (0 >= this.vjsPlayerElem.offsetHeight - 56 + rect.top) {
      // NOTE: 56 pixels is the value of pages header bar height.
      if (!pauseTimerOnScroll) {
        this.cancelTimer(true);
      }
      pauseTimerOnScroll = true;
    } else {
      if (pauseTimerOnScroll) {
        this.startTimer();
      }
      pauseTimerOnScroll = false;
    }
  }

  onScrollHandler = onScrollHandler.bind(this);

  function startOnScrollHandler() {
    window.addEventListener('scroll', onScrollHandler);
  }

  function stopOnScrollHandler() {
    window.removeEventListener('scroll', onScrollHandler);
  }

  this.vjsPlayerElem = null;

  this.html = function () {
    return domElems.wrapper;
  };

  this.startTimer = function () {
    showView();
    timerTimeout = setTimeout(onTimerComplete, 10 * 1000);
    if (this.vjsPlayerElem) removeClassname(this.vjsPlayerElem, 'vjs-mediacms-canceled-next');
    startOnScrollHandler();
  };

  this.cancelTimer = function (onScrollPause) {
    onScrollPause = !!onScrollPause;
    if (!onScrollPause) {
      stopOnScrollHandler();
    }
    clearTimeout(timerTimeout);
    timerTimeout = null;
    if (this.vjsPlayerElem) addClassname(this.vjsPlayerElem, 'vjs-mediacms-canceled-next');
  };

  this.setVideoJsPlayerElem = function (el) {
    if (!el) return;
    this.vjsPlayerElem = el;
    addClassname(this.vjsPlayerElem, 'vjs-mediacms-has-up-next-view');
  };

  this.showTimerView = function (beginTimer) {
    beginTimer = !!beginTimer;
    if (beginTimer) {
      this.startTimer();
    } else {
      showView();
    }
  };

  this.hideTimerView = function () {
    hideView();
  };
}
