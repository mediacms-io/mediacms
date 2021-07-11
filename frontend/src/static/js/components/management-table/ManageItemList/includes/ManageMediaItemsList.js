import ManageMediaItem from './ManageMediaItem';

const _ManageMediaItemsListData = {};

export default class MediaItemsList {
  constructor(listContainer, initialItems) {
    if (!Node.prototype.isPrototypeOf(listContainer)) {
      return null;
    }

    _ManageMediaItemsListData[
      Object.defineProperty(this, 'id', {
        value: 'ManageMediaItemsList_' + Object.keys(_ManageMediaItemsListData).length,
      }).id
    ] = {};

    this.items = [];
    this.container = listContainer;

    this.appendItems(initialItems);
  }

  dataObject() {
    return _ManageMediaItemsListData;
  }

  appendItems(items) {
    var i;
    if (NodeList.prototype.isPrototypeOf(items)) {
      i = 0;
      while (i < items.length) {
        this.items.push(new ManageMediaItem(items[i]));
        i += 1;
      }
    } else if (Node.prototype.isPrototypeOf(items)) {
      this.items.push(new ManageMediaItem(items));
    }
  }
}
