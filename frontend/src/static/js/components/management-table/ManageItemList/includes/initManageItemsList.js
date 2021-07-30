import ManageMediaItemsList from './ManageMediaItemsList';

var CSS_selectors = {
  mediaItems: '.item',
};

var ManageMediaItemsListInstances = [];

export default function (lists) {
  if (!lists.length) {
    return null;
  }

  let items,
    i = 0;

  while (i < lists.length) {
    items = lists[i].querySelectorAll(CSS_selectors.mediaItems);

    if (items.length) {
      ManageMediaItemsListInstances = ManageMediaItemsListInstances || [];
      ManageMediaItemsListInstances.push(new ManageMediaItemsList(lists[i], items));
    }
    i += 1;
  }

  return ManageMediaItemsListInstances;
}
