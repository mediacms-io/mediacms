import React from 'react';
import { LinksContext } from '../../utils/contexts/';
import { PageStore } from '../../utils/stores/';
import { MediaItemAudio as AudioItem } from './MediaItemAudio';
import { MediaItemVideo as VideoItem } from './MediaItemVideo';
import { MediaItem as ImageItem } from './MediaItem';
import { MediaItem as PdfItem } from './MediaItem';
import { MediaItem as AttachmentItem } from './MediaItem';
import { PlaylistItem } from './PlaylistItem';
import { TaxonomyItem } from './TaxonomyItem';
import { UserItem } from './UserItem';

function extractPlaylistId() {
  let playlistId = null;

  const getParamsString = window.location.search;

  if ('' !== getParamsString) {
    let tmp = getParamsString.split('?');

    if (2 === tmp.length) {
      tmp = tmp[1].split('&');

      let x;

      let i = 0;
      while (i < tmp.length) {
        x = tmp[i].split('=');

        if ('pl' === x[0]) {
          if (2 === x.length) {
            playlistId = x[1];
          }

          break;
        }

        i += 1;
      }
    }
  }

  return playlistId;
}

function itemPageLink(props, item) {
  if (props.inCategoriesList) {
    return LinksContext._currentValue.search.category + item.title.replace(' ', '%20');
  }

  if (props.inTagsList) {
    return LinksContext._currentValue.search.tag + item.title.replace(' ', '%20');
  }

  const playlistId = extractPlaylistId();

  if (props.inPlaylistView && playlistId) {
    return item.url + '&pl=' + playlistId;
  }

  if (void 0 !== props.playlistId && null !== props.playlistId) {
    return item.url + '&pl=' + props.playlistId;
  }

  return item.url;
}

export function listItemProps(props, item, index) {
  const isArchiveItem = props.inCategoriesList || props.inTagsList;
  const isUserItem = !isArchiveItem && void 0 !== item.username;
  const isPlaylistItem =
    !isArchiveItem &&
    !isUserItem &&
    ('playlist' === item.media_type || (void 0 !== item.url && -1 < item.url.indexOf('playlists'))); // TODO: Improve this.
  const isMediaItem = !isArchiveItem && !isUserItem && !isPlaylistItem;
  const isSearchItem = 'search-results' === PageStore.get('current-page'); // TODO: Improve this.

  const url = {
    view: itemPageLink(props, item),
    edit: props.canEdit ? item.url.replace('view?m=', 'edit?m=') : null,
    publish: props.canEdit ? item.url.replace('view?m=', 'publish?m=') : null,
  };

  if (window.MediaCMS.site.devEnv && -1 < url.view.indexOf('view?')) {
    url.view = '/media.html?' + url.view.split('view?')[1];
  }

  const thumbnail = item.thumbnail_url || '';
  const previewThumbnail = item.preview_url || '';

  let type, title, date, description, meta_description;

  title =
    void 0 !== item.username && 'string' === typeof item.username
      ? item.username
      : void 0 !== item.title && 'string' === typeof item.title
      ? item.title
      : null;

  date =
    void 0 !== item.date_added && 'string' === typeof item.date_added
      ? item.date_added
      : void 0 !== item.add_date && 'string' === typeof item.add_date
      ? item.add_date
      : null;

  // description = props.preferSummary && 'string' === typeof props.summary ? props.summary.trim() : ( 'string' === typeof item.description ? item.description.trim() : null );
  // description = null === description ? description : description.replace(/(<([^>]+)>)/ig,"");

  if (isUserItem) {
    type = 'user';
  } else if (isPlaylistItem) {
    type = 'playlist';
  } else if (isMediaItem) {
    type = item.media_type;
  }

  const taxonomyPage = {
    current: false,
    type: null,
  };

  const playlistPage = {
    current: props.inPlaylistPage,
    id: props.playlistId,
    hideOptions: props.hidePlaylistOptions || false,
    hideOrderNumber: props.hidePlaylistOrderNumber || false,
  };

  const playlistPlayback = {
    current: props.inPlaylistView,
    id: props.playlistId,
    activeItem: props.playlistActiveItem || false,
    hideOrderNumber: props.hidePlaylistOrderNumber || false,
  };

  if (isArchiveItem) {
    if (props.inCategoriesList) {
      taxonomyPage.type = 'categories';
    } else if (props.inTagsList) {
      taxonomyPage.type = 'tags';
    }

    if (null !== taxonomyPage.type) {
      taxonomyPage.current = true;
    }
  }

  const author = {
    name: item.author_name || item.user,
    url: item.author_profile ? item.author_profile.replace(' ', '%20') : null,
  };

  const stats = {
    views: item.views || null,
  };

  const hide = {
    allMeta: props.hideAllMeta || false,
  };

  let args = {
    order: index + 1,
    type,
    title,
    date,
    url,
    author,
    stats,
    thumbnail,
    taxonomyPage,
    playlistPage,
    playlistPlayback,
    canEdit: null !== url.edit,
    singleLinkContent: props.singleLinkContent || false,
    hasMediaViewer: 0 === index && 'video' === item.media_type && !!props.firstItemViewer,
    hasMediaViewerDescr: false,
  };

  args.hasMediaViewerDescr = args.hasMediaViewer && !!props.firstItemDescr;

  if (!args.hasMediaViewerDescr) {
    description =
      props.preferSummary && 'string' === typeof props.summary
        ? props.summary.trim()
        : 'string' === typeof item.description
        ? item.description.trim()
        : null;
    description = null === description ? description : description.replace(/(<([^>]+)>)/gi, '');

    if (isSearchItem || props.inCategoriesList || 'user' === type) {
      args.description = description;
    } else {
      args.meta_description = description;
    }
  } else {
    if (!!props.firstItemViewer) {
      description = 'string' === typeof props.summary ? props.summary.trim() : null;
    } else {
      description = 'string' === typeof item.description ? item.description.trim() : null;
    }

    description = null === description ? description : description.replace(/(<([^>]+)>)/gi, '');

    args.description = description;

    // TODO: Improve this.
    if (props.summary) {
      meta_description = props.summary.trim();
      meta_description = null === meta_description ? meta_description : meta_description.replace(/(<([^>]+)>)/gi, '');
      args.meta_description = meta_description;
    }
  }

  if ('video' === type) {
    args.previewThumbnail = previewThumbnail;
  }

  if ('video' === type || 'audio' === type) {
    args.duration = item.duration;
  }

  if ((isArchiveItem || isPlaylistItem) && !isNaN(item.media_count)) {
    args.media_count = parseInt(item.media_count, 10);
  }

  if (isMediaItem) {
    hide.date = props.hideDate || false;
    hide.views = props.hideViews || false;
    hide.author = props.hideAuthor || false;
  }

  args = { ...args, hide };

  return args;
}

export function ListItem(props) {
  let isMediaItem = false;

  const handleCheckboxChange = (event) => {
    if (props.onSelectionChange && props.mediaId) {
      props.onSelectionChange(props.mediaId, event.target.checked);
    }
  };

  const args = {
    order: props.order,
    title: props.title,
    link: props.url.view,
    thumbnail: props.thumbnail,
    publish_date: props.date,
    singleLinkContent: props.singleLinkContent,
    hasMediaViewer: props.hasMediaViewer,
    hasMediaViewerDescr: props.hasMediaViewerDescr,
    showSelection: props.showSelection,
    hasAnySelection: props.hasAnySelection,
    isSelected: props.isSelected,
    onCheckboxChange: handleCheckboxChange,
  };

  switch (props.type) {
    case 'user':
      break;
    case 'playlist':
      break;
    case 'video':
      isMediaItem = true;
      args.duration = props.duration;
      args.preview_thumbnail = props.previewThumbnail;
      break;
    case 'audio':
      isMediaItem = true;
      args.duration = props.duration;
      break;
    case 'image':
      isMediaItem = true;
      break;
    case 'pdf':
      isMediaItem = true;
      break;
  }

  if (void 0 !== props.description) {
    args.description = props.description;
  }

  if (void 0 !== props.meta_description) {
    args.meta_description = props.meta_description;
  }

  if ((props.taxonomyPage.current || 'playlist' === props.type) && !isNaN(props.media_count)) {
    args.media_count = props.media_count;
  }

  args.hideAllMeta = props.hide.allMeta;

  if (isMediaItem) {
    args.views = props.stats.views;

    args.author_name = props.author.name;
    args.author_link = props.author.url;

    args.hideDate = props.hide.date;
    args.hideViews = props.hide.views;
    args.hideAuthor = props.hide.author;
  }

  if (props.playlistPage.current || props.playlistPlayback.current) {
    args.playlistOrder = props.order;

    if (props.playlistPlayback.current) {
      args.playlist_id = props.playlistPlayback.id;
      args.playlistActiveItem = props.playlistPlayback.activeItem;
      args.hidePlaylistOrderNumber = props.playlistPlayback.hideOrderNumber;
    } else {
      args.playlist_id = props.playlistPage.id;
      args.hidePlaylistOptions = props.playlistPage.hideOptions;
      args.hidePlaylistOrderNumber = props.playlistPage.hideOrderNumber;
    }
  }

  if (props.canEdit) {
    args.editLink = props.url.edit;
    args.publishLink = props.url.publish;
  }

  if (props.taxonomyPage.current) {
    switch (props.taxonomyPage.type) {
      case 'categories':
        return <TaxonomyItem {...args} type="category" />;
      case 'tags':
        return <TaxonomyItem {...args} type="tag" />;
    }
  }

  switch (props.type) {
    case 'user':
      return <UserItem {...args} />;
    case 'playlist':
      if (window.MediaCMS.site.devEnv) {
        args.link = args.link.replace('/playlists/', 'playlist.html?pl=');
      }
      return <PlaylistItem {...args} />;
    case 'video':
      return <VideoItem {...args} />;
    case 'audio':
      return <AudioItem {...args} />;
    case 'image':
      return <ImageItem {...args} type="image" />;
    case 'pdf':
      return <PdfItem {...args} type="pdf" />;
  }

  return <AttachmentItem {...args} type="attachment" />;
}
