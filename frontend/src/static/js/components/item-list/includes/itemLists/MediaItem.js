import MediaItemPreviewer from './MediaItemPreviewer';

let mediaPreviewerInstance = null;

var CSS_selectors = {
  mediaItemPreviewer: '.item-img-preview',
};

var DataAttributes = {
  mediaPreviewSrc: 'data-src',
  mediaPreviewExt: 'data-ext',
};

export default class MediaItem {
  constructor(item) {
    if (!Node.prototype.isPrototypeOf(item)) {
      return null;
    }

    this.element = item;

    this.previewer = {
      element: item.querySelector(CSS_selectors.mediaItemPreviewer),
    };

    let tmp;

    if (this.previewer.element) {
      tmp = this.previewer.element.getAttribute(DataAttributes.mediaPreviewSrc);

      if (tmp) {
        this.previewer.src = tmp.trim();
      }
    }

    if (this.previewer.src) {
      tmp = this.previewer.element.getAttribute(DataAttributes.mediaPreviewExt);

      if (tmp) {
        this.previewer.extensions = tmp.trim().split(',');
      }
    }

    if (this.previewer.extensions) {
      mediaPreviewerInstance = mediaPreviewerInstance || new MediaItemPreviewer(this.previewer.extensions);
      mediaPreviewerInstance.elementEvents(this.element);
    }
  }

  element() {
    return this.element;
  }
}
