import MediaItemsList from './MediaItemsList';

var CSS_selectors = {
  mediaItems: '.item',
};

var mediaItemsListInstances = [];

export default function (lists) {
  if (!lists.length) {
    return null;
  }

  let items,
    i = 0;

  while (i < lists.length) {
    items = lists[i].querySelectorAll(CSS_selectors.mediaItems);

    if (items.length) {
      mediaItemsListInstances = mediaItemsListInstances || [];
      mediaItemsListInstances.push(new MediaItemsList(lists[i], items));
    }
    i += 1;
  }

  return mediaItemsListInstances;
}
