import MediaItem from './MediaItem';
import { hasClassname } from '../../../../utils/helpers/';

const _MediaItemsListData = {};

export default class MediaItemsList {
  constructor(listContainer, initialItems) {
    if (!Node.prototype.isPrototypeOf(listContainer)) {
      return null;
    }

    _MediaItemsListData[
      Object.defineProperty(this, 'id', { value: 'MediaItemsList_' + Object.keys(_MediaItemsListData).length }).id
    ] = {};

    this.items = [];
    this.container = listContainer;
    this.horizontalItems = hasClassname(this.container, 'items-list-hor');

    this.appendItems(initialItems);
  }

  dataObject() {
    return _MediaItemsListData;
  }

  appendItems(items) {
    var i;
    if (NodeList.prototype.isPrototypeOf(items)) {
      i = 0;
      while (i < items.length) {
        this.items.push(new MediaItem(items[i]));
        i += 1;
      }
    } else if (Node.prototype.isPrototypeOf(items)) {
      this.items.push(new MediaItem(items));
    }
  }
}
