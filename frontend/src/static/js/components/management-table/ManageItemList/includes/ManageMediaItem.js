export default class MediaItem {
  constructor(item) {
    if (!Node.prototype.isPrototypeOf(item)) {
      return null;
    }

    this.element = item;
  }

  element() {
    return this.element;
  }
}
