import EventEmitter from 'events';
import { BrowserCache } from '../classes/';
import { BrowserEvents, exportStore } from '../helpers';
import { config as mediaCmsConfig } from '../settings/config.js';

function uniqid() {
  let a = new Uint32Array(3);
  window.crypto.getRandomValues(a);
  return (
    performance.now().toString(36) +
    Array.from(a)
      .map((A) => A.toString(36))
      .join('')
  ).replace(/./g, '' + Math.random() + Intl.DateTimeFormat().resolvedOptions().timeZone + Date.now());
}

function Notifications(initialNotifications) {
  let stack = [];

  function push(msg) {
    if ('string' === typeof msg) {
      stack.push([uniqid(), msg]);
    }
  }

  function messages() {
    return [...stack];
  }

  function clear() {
    stack = [];
  }

  function size() {
    return stack.length;
  }

  initialNotifications.map(push);

  return {
    size,
    push,
    clear,
    messages,
  };
}

let browserCache;

let page_config = null;
let mediacms_config = null;

const mediacms_api_endpoint_url = (k) => mediacms_config.api[k] || null;

class PageStore extends EventEmitter {
  constructor(page) {
    super();

    mediacms_config = mediaCmsConfig(window.MediaCMS);

    browserCache = new BrowserCache(mediacms_config.site.id, 86400); // Keep cache data "fresh" for one day.

    page_config = {
      mediaAutoPlay: browserCache.get('media-auto-play'),
    };

    page_config.mediaAutoPlay = null !== page_config.mediaAutoPlay ? page_config.mediaAutoPlay : true;

    this.browserEvents = BrowserEvents();
    this.browserEvents.doc(this.onDocumentVisibilityChange.bind(this));
    this.browserEvents.win(this.onWindowResize.bind(this), this.onWindowScroll.bind(this));

    this.notifications = Notifications(
      void 0 !== window.MediaCMS && void 0 !== window.MediaCMS.notifications ? window.MediaCMS.notifications : []
    );
  }

  onDocumentVisibilityChange() {
    this.emit('document_visibility_change');
  }

  onWindowScroll() {
    this.emit('window_scroll');
  }

  onWindowResize() {
    this.emit('window_resize');
  }

  initPage(page) {
    page_config.currentPage = page;
  }

  get(type) {
    let r;

    switch (type) {
      case 'browser-cache':
        r = browserCache;
        break;
      case 'media-auto-play':
        r = page_config.mediaAutoPlay;
        break;
      case 'config-contents':
        r = mediacms_config.contents;
        break;
      case 'config-enabled':
        r = mediacms_config.enabled;
        break;
      case 'config-media-item':
        r = mediacms_config.media.item;
        break;
      case 'config-options':
        r = mediacms_config.options;
        break;
      case 'config-site':
        r = mediacms_config.site;
        break;
      case 'api-playlists':
        r = mediacms_api_endpoint_url(type.split('-')[1]);
        break;
      case 'notifications-size':
        r = this.notifications.size();
        break;
      case 'notifications':
        r = this.notifications.messages();
        this.notifications.clear();
        break;
      case 'current-page':
        r = page_config.currentPage;
        break;
    }
    return r;
  }

  actions_handler(action) {
    switch (action.type) {
      case 'INIT_PAGE':
        this.initPage(action.page);
        this.emit('page_init');
        break;
      case 'TOGGLE_AUTO_PLAY':
        page_config.mediaAutoPlay = !page_config.mediaAutoPlay;
        browserCache.set('media-auto-play', page_config.mediaAutoPlay);
        this.emit('switched_media_auto_play');
        break;
      case 'ADD_NOTIFICATION':
        this.notifications.push(action.notification);
        this.emit('added_notification');
        break;
    }
  }
}

export default exportStore(new PageStore(), 'actions_handler');
