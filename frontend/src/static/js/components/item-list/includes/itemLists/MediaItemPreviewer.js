import { PageStore } from '../../../../utils/stores/';
import { cancelAnimationFrame, requestAnimationFrame, addClassname } from '../../../../utils/helpers/';

Array.isArray =
  Array.isArray ||
  function (arg) {
    'use strict';
    return Object.prototype.toString.call(arg) === '[object Array]';
  };

var hoverTimeoutID, requestAnimationFrameID;

var CSS_selectors = {
  mediaItemPreviewer: '.item-img-preview',
};

var DataAttributes = {
  mediaPreviewSrc: 'data-src',
};

export default class MediaItemPreviewer {
  constructor(extensions) {
    if (!Array.isArray(extensions)) {
      return null;
    }

    this.extensions = {};

    function onImageLoad(ins, evt) {
      requestAnimationFrameID = requestAnimationFrame(function () {
        if (ins.wrapperItem) {
          addClassname(ins.wrapperItem, 'on-hover-preview');
          requestAnimationFrameID = void 0;
          ins.wrapperItem = void 0;
        }
      });
    }

    const fallback_ext = ['png', 'jpg', 'jpeg']; // NOTE: Keep extentions order.
    let i, x;

    this.element = null;

    if (-1 < extensions.indexOf('webp')) {
      x = document.createElement('source');
      x.type = 'image/webp';
      this.extensions.anim = this.extensions.anim || [];
      this.extensions.anim.push({ elem: x, type: 'webp' });
      if (1 === extensions.length) {
        this.extensions.fallback = { elem: document.createElement('img'), type: 'webp' };
      }
    }

    if (-1 < extensions.indexOf('gif')) {
      x = document.createElement('source');
      x.type = 'image/gif';
      this.extensions.anim = this.extensions.anim || [];
      this.extensions.anim.push({ elem: x, type: 'gif' });
      this.extensions.fallback = { elem: document.createElement('img'), type: 'gif' };
    }

    if (-1 < extensions.indexOf('jpg')) {
      x = document.createElement('source');
      x.type = 'image/jpg';
      this.extensions.anim = this.extensions.anim || [];
      this.extensions.anim.push({ elem: x, type: 'jpg' });
      this.extensions.fallback = { elem: document.createElement('img'), type: 'jpg' };
    }

    if (-1 < extensions.indexOf('jpeg')) {
      x = document.createElement('source');
      x.type = 'image/jpeg';
      this.extensions.anim = this.extensions.anim || [];
      this.extensions.anim.push({ elem: x, type: 'jpeg' });
      this.extensions.fallback = { elem: document.createElement('img'), type: 'jpeg' };
    }

    if (!this.extensions.fallback.elem) {
      i = 0;
      while (i < fallback_extensions.length) {
        if (-1 < extensions.indexOf(fallback_ext[i])) {
          this.extensions.fallback = { elem: document.createElement('img'), type: fallback_ext[i] };
          break;
        }
        i += 1;
      }
    }

    if (this.extensions.anim.length || this.extensions.fallback.elem) {
      this.element = document.createElement('picture');

      if (this.extensions.anim.length) {
        i = 0;
        while (i < this.extensions.anim.length) {
          this.element.appendChild(this.extensions.anim[i].elem);
          i += 1;
        }
      }

      if (this.extensions.fallback.elem) {
        this.element.appendChild(this.extensions.fallback.elem);
      }

      this.image = this.element.querySelector('img');
      this.image.addEventListener('load', onImageLoad.bind(null, this));
    }
  }

  elementEvents(el) {
    el.addEventListener('mouseenter', this.onMediaItemMouseEnter.bind(null, this));
    el.addEventListener('mouseleave', this.onMediaItemMouseLeave.bind(null, this));
  }

  newImage(src, width, height, item) {
    let i;

    if (void 0 !== hoverTimeoutID) {
      clearTimeout(hoverTimeoutID);
    }

    if (void 0 !== requestAnimationFrameID) {
      cancelAnimationFrame(requestAnimationFrameID);
    }

    /*
     * Set source (src).
     */

    if (this.extensions.anim.length) {
      i = 0;
      while (i < this.extensions.anim.length) {
        this.extensions.anim[i].elem.setAttribute('srcset', src + '.' + this.extensions.anim[i].type);
        i += 1;
      }
    }
    if (this.extensions.fallback.elem) {
      this.extensions.fallback.elem.setAttribute('src', src + '.' + this.extensions.fallback.type);
    }

    /*
     * Set dimensions (src).
     */

    if (this.extensions.fallback.elem) {
      this.extensions.fallback.elem.setAttribute('width', width + 'px');
      this.extensions.fallback.elem.setAttribute('height', height + 'px');
    }

    /*
     * Append previewer.
     */

    item.querySelector(CSS_selectors.mediaItemPreviewer).appendChild(this.element);

    /*
     * Set previewer's container element.
     */

    this.wrapperItem = item;
  }

  onMediaItemMouseEnter(ins, evt) {
    var elem, src;

    if (ins.image) {
      elem = evt.target.querySelector(CSS_selectors.mediaItemPreviewer);
      src =
        PageStore.get('config-site').url + '/' + elem.getAttribute(DataAttributes.mediaPreviewSrc).replace(/^\//g, '');

      hoverTimeoutID = setTimeout(function () {
        ins.newImage(src, 1 + elem.offsetWidth, 1 + elem.offsetHeight, evt.target);
      }, 100); // NOTE: Avoid loading unnecessary media, when mouse is moving fast over dom items.
    }
  }

  onMediaItemMouseLeave(ins, evt) {
    if (void 0 !== hoverTimeoutID) {
      clearTimeout(hoverTimeoutID);
    }

    if (void 0 !== requestAnimationFrameID) {
      cancelAnimationFrame(requestAnimationFrameID);
    }

    ins.wrapperItem = void 0;
  }
}
