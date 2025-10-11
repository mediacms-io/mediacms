import React, { useState, useEffect } from 'react';

import PageStore from '../../../utils/stores/PageStore.js';

import './Notifications.scss';

let visibleNotifications = [];

function NotificationItem(props) {
  const [isHidden, setIsHidden] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  let timeout1 = null;
  let timeout2 = null;

  useEffect(() => {
    timeout1 = setTimeout(function () {
      timeout2 = setTimeout(function () {
        setIsVisible(false);
        timeout2 = null;
      }, 1000);

      timeout1 = null;
      setIsHidden(true);
      props.onHide(props.id);
    }, 5000);

    return () => {
      if (timeout1) {
        clearTimeout(timeout1);
      }

      if (timeout2) {
        clearTimeout(timeout2);
      }
    };
  }, []);

  return !isVisible ? null : (
    <div className={'notification-item' + (isHidden ? ' hidden' : '')}>
      <div>
        <span>{props.children || 'No message'}</span>
      </div>
    </div>
  );
}

export function Notifications() {
  const [notificationsLength, setNotificationsLength] = useState(visibleNotifications.length);

  function onNotificationsUpdate() {
    setNotificationsLength(PageStore.get('notifications-size') + visibleNotifications.length);
  }

  function onNotificationHide(id) {
    const newVisibleNotifications = [];
    visibleNotifications.map((item) => {
      if (item[0] !== id) {
        newVisibleNotifications.push(item);
      }
    });
    visibleNotifications = newVisibleNotifications;
  }

  function notificationsContent() {
    const newItems = PageStore.get('notifications');

    const oldNotifications = visibleNotifications.map((n) => {
      return (
        <NotificationItem key={n[0]} id={n[0]} onHide={onNotificationHide}>
          {n[1]}
        </NotificationItem>
      );
    });

    const newNotifications = newItems.map((n) => {
      visibleNotifications.push(n);
      return (
        <NotificationItem key={n[0]} id={n[0]} onHide={onNotificationHide}>
          {n[1]}
        </NotificationItem>
      );
    });

    return [...oldNotifications, ...newNotifications];
  }

  useEffect(() => {
    onNotificationsUpdate();
    PageStore.on('added_notification', onNotificationsUpdate);
    return () => PageStore.removeListener('added_notification', onNotificationsUpdate);
  }, []);

  return !notificationsLength ? null : (
    <div className="notifications">
      <div>{notificationsContent()}</div>{' '}
    </div>
  );
}
