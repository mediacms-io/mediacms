import { dispatcher } from '../dispatcher';

export function initPage(page: string) {
    dispatcher.dispatch({ type: 'INIT_PAGE', page });
}

export function toggleMediaAutoPlay() {
    dispatcher.dispatch({ type: 'TOGGLE_AUTO_PLAY' });
}

export function addNotification(notification: string, notificationId: string) {
    dispatcher.dispatch({ type: 'ADD_NOTIFICATION', notification, notificationId });
}
