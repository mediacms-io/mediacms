import React, { useContext } from 'react';
import urlParse from 'url-parse';
import { useUser } from '../../../utils/hooks/';
import { PageStore } from '../../../utils/stores/';
import { LinksContext, SidebarContext } from '../../../utils/contexts/';
import { NavigationMenuList } from '../../_shared';
import { getRequest } from '../../../utils/helpers';

export function SidebarNavigationMenu() {
  const { userCan, isAnonymous, pages: userPages } = useUser();

  const links = useContext(LinksContext);
  const sidebar = useContext(SidebarContext);

  const currentUrl = urlParse(window.location.href);
  const currentHostPath = (currentUrl.host + currentUrl.pathname).replace(/\/+$/, '');

  function formatItems(items) {
    return items.map((item) => {
      const url = urlParse(item.link);
      const active = currentHostPath === url.host + url.pathname;

      return Object.assign(item, {
        active,
        itemType: 'link',
        link: item.link || '#',
        icon: item.icon || null,
        iconPos: 'left',
        text: item.text || item.link || '#',
        itemAttr: Object.assign(item.itemAttr || {}, {
          className: item.className || '',
        }),
      });
    });
  }

  function MainMenuFirstSection() {
    const items = [];

    if (!sidebar.hideHomeLink) {
      items.push({
        link: links.home,
        icon: 'home',
        text: 'Home',
        className: 'nav-item-home',
      });
    }
    
    if (window.MediaCMS && window.MediaCMS.site && window.MediaCMS.site.livestream && window.MediaCMS.site.livestream.uri) {
      items.push({
        link: window.MediaCMS.site.livestream.uri,
        icon: 'radio_button_unchecked',
        text: 'Live',
        className: 'nav-item-live',
	itemAttr: {
	  id: 'nav-item-live'
	},
	linkAttr: {
	  target: '_blank'
	}
      });
      switch (window.MediaCMS.site.livestream.backend || null) {
        case 'owncast': {
	  getRequest(window.MediaCMS.site.livestream.uri + "/api/status", !1, (response) => {
            const json = response.data
            const menuItem = document.getElementById('nav-item-live')
            var onlineText = "(Offline)"
            if (json && json.online) {
	      // Change the icon to show it's live.
	      const icons = menuItem.getElementsByClassName('material-icons')
	      if (icons) {
	        icons[0].setAttribute('data-icon', 'radio_button_checked')
	      }

              // Also change the text to show it's online.
	      onlineText = "(Online)"
	    }
	    const spans = menuItem.getElementsByTagName('span')
            const lastSpan = spans[spans.length - 1]
            const smalls = lastSpan.getElementsByTagName("small")
            for (var s = 0; s < smalls.length; ++s) {
              smalls[s].parentNode.removeChild(smalls[s])
	    }
            lastSpan.appendChild(document.createElement("small")).appendChild(document.createTextNode(' ' + onlineText))
	  }, () => {});
	} break;
      }
    }

    if (PageStore.get('config-enabled').pages.featured && PageStore.get('config-enabled').pages.featured.enabled) {
      items.push({
        link: links.featured,
        icon: 'star',
        text: PageStore.get('config-enabled').pages.featured.title,
        className: 'nav-item-featured',
      });
    }

    if (
      PageStore.get('config-enabled').pages.recommended &&
      PageStore.get('config-enabled').pages.recommended.enabled
    ) {
      items.push({
        link: links.recommended,
        icon: 'done_outline',
        text: PageStore.get('config-enabled').pages.recommended.title,
        className: 'nav-item-recommended',
      });
    }

    if (PageStore.get('config-enabled').pages.latest && PageStore.get('config-enabled').pages.latest.enabled) {
      items.push({
        link: links.latest,
        icon: 'new_releases',
        text: PageStore.get('config-enabled').pages.latest.title,
        className: 'nav-item-latest',
      });
    }

    if (
      !sidebar.hideTagsLink &&
      PageStore.get('config-enabled').taxonomies.tags &&
      PageStore.get('config-enabled').taxonomies.tags.enabled
    ) {
      items.push({
        link: links.archive.tags,
        icon: 'local_offer',
        text: PageStore.get('config-enabled').taxonomies.tags.title,
        className: 'nav-item-tags',
      });
    }

    if (
      !sidebar.hideCategoriesLink &&
      PageStore.get('config-enabled').taxonomies.categories &&
      PageStore.get('config-enabled').taxonomies.categories.enabled
    ) {
      items.push({
        link: links.archive.categories,
        icon: 'list_alt',
        text: PageStore.get('config-enabled').taxonomies.categories.title,
        className: 'nav-item-categories',
      });
    }

    if (PageStore.get('config-enabled').pages.members && PageStore.get('config-enabled').pages.members.enabled) {
      items.push({
        link: links.members,
        icon: 'people',
        text: PageStore.get('config-enabled').pages.members.title,
        className: 'nav-item-members',
      });
    }

    const extraItems = PageStore.get('config-contents').sidebar.mainMenuExtra.items;

    extraItems.forEach((navitem) => {
      items.push({
        link: navitem.link,
        icon: navitem.icon,
        text: navitem.text,
        className: navitem.className,
      });
    });

    return items.length ? <NavigationMenuList key="main-first" items={formatItems(items)} /> : null;
  }

  function MainMenuSecondSection() {
    const items = [];

    if (!isAnonymous) {
      if (userCan.addMedia) {
        items.push({
          link: links.user.addMedia,
          icon: 'video_call',
          text: 'Upload media',
          className: 'nav-item-upload-media',
        });

        if (userPages.media) {
          items.push({
            link: userPages.media,
            icon: 'video_library',
            text: 'My media',
            className: 'nav-item-my-media',
          });
        }
      }

      if (userCan.saveMedia) {
        items.push({
          link: userPages.playlists,
          icon: 'playlist_play',
          text: 'My playlists',
          className: 'nav-item-my-playlists',
        });
      }
    }

    return items.length ? <NavigationMenuList key="main-second" items={formatItems(items)} /> : null;
  }

  function UserMenuSection() {
    const items = [];

    if (PageStore.get('config-enabled').pages.history && PageStore.get('config-enabled').pages.history.enabled) {
      items.push({
        link: links.user.history,
        icon: 'history',
        text: PageStore.get('config-enabled').pages.history.title,
        className: 'nav-item-history',
      });
    }

    if (
      userCan.likeMedia &&
      PageStore.get('config-enabled').pages.liked &&
      PageStore.get('config-enabled').pages.liked.enabled
    ) {
      items.push({
        link: links.user.liked,
        icon: 'thumb_up',
        text: PageStore.get('config-enabled').pages.liked.title,
        className: 'nav-item-liked',
      });
    }

    return items.length ? <NavigationMenuList key="user" items={formatItems(items)} /> : null;
  }

  function CustomMenuSection() {
    const items = PageStore.get('config-contents').sidebar.navMenu.items;

    return items.length ? <NavigationMenuList key="custom" items={formatItems(items)} /> : null;
  }

  function AdminMenuSection() {
    const items = [];

    if (userCan.manageMedia) {
      items.push({
        link: links.manage.media,
        icon: 'miscellaneous_services',
        text: 'Manage media',
        className: 'nav-item-manage-media',
      });
    }

    if (userCan.manageUsers) {
      items.push({
        link: links.manage.users,
        icon: 'miscellaneous_services',
        text: 'Manage users',
        className: 'nav-item-manage-users',
      });
    }

    if (userCan.manageComments) {
      items.push({
        link: links.manage.comments,
        icon: 'miscellaneous_services',
        text: 'Manage comments',
        className: 'nav-item-manage-comments',
      });
    }

    return items.length ? <NavigationMenuList key="admin" items={formatItems(items)} /> : null;
  }

  return [MainMenuFirstSection(), MainMenuSecondSection(), UserMenuSection(), CustomMenuSection(), AdminMenuSection()];
}
