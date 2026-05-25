import { BrowserCache } from '../../../src/static/js/utils/classes';
import store from '../../../src/static/js/utils/stores/PageStore';

import { sampleMediaCMSConfig } from '../../tests-constants';

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: (key: string) => (key === 'media-auto-play' ? false : undefined),
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    BrowserEvents: jest.fn().mockImplementation(() => ({
        doc: jest.fn(),
        win: jest.fn(),
    })),
    exportStore: jest.fn((store) => store),
}));

describe('utils/store', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    describe('PageStore', () => {
        const handler = store.actions_handler.bind(store);

        const onInit = jest.fn();
        const onToggleAutoPlay = jest.fn();
        const onAddNotification = jest.fn();

        store.on('page_init', onInit);
        store.on('switched_media_auto_play', onToggleAutoPlay);
        store.on('added_notification', onAddNotification);

        test('Validate initial values', () => {
            // BrowserCache mock
            expect(store.get('browser-cache').get('media-auto-play')).toBe(false);
            expect(store.get('browser-cache').get('ANY')).toBe(undefined);

            // Autoplay media files
            expect(store.get('media-auto-play')).toBe(false);

            // Configuration
            expect(store.get('config-contents')).toStrictEqual(sampleMediaCMSConfig.contents);
            expect(store.get('config-enabled')).toStrictEqual(sampleMediaCMSConfig.enabled);
            expect(store.get('config-media-item')).toStrictEqual(sampleMediaCMSConfig.media.item);
            expect(store.get('config-options')).toStrictEqual(sampleMediaCMSConfig.options);
            expect(store.get('config-site')).toStrictEqual(sampleMediaCMSConfig.site);

            // Playlists API path
            expect(store.get('api-playlists')).toStrictEqual(sampleMediaCMSConfig.api.playlists);

            // Notifications
            expect(store.get('notifications')).toStrictEqual([]);
            expect(store.get('notifications-size')).toBe(0);

            expect(store.get('current-page')).toBe(undefined);
        });

        test('Trigger and validate browser events behavior', () => {
            const docVisChange = jest.fn();
            const winScroll = jest.fn();
            const winResize = jest.fn();

            store.on('document_visibility_change', docVisChange);
            store.on('window_scroll', winScroll);
            store.on('window_resize', winResize);

            store.onDocumentVisibilityChange();
            store.onWindowScroll();
            store.onWindowResize();

            expect(docVisChange).toHaveBeenCalled();
            expect(winScroll).toHaveBeenCalled();
            expect(winResize).toHaveBeenCalledTimes(1);
        });

        describe('Trigger and validate actions behavior', () => {
            test('Action type: "INIT_PAGE"', () => {
                handler({ type: 'INIT_PAGE', page: 'home' });
                expect(onInit).toHaveBeenCalledTimes(1);
                expect(store.get('current-page')).toBe('home');

                handler({ type: 'INIT_PAGE', page: 'about' });
                expect(onInit).toHaveBeenCalledTimes(2);
                expect(store.get('current-page')).toBe('about');

                handler({ type: 'INIT_PAGE', page: 'profile' });
                expect(onInit).toHaveBeenCalledTimes(3);
                expect(store.get('current-page')).toBe('profile');

                expect(onInit).toHaveBeenCalledWith();

                expect(onToggleAutoPlay).toHaveBeenCalledTimes(0);
                expect(onAddNotification).toHaveBeenCalledTimes(0);
            });

            test('Action type: "TOGGLE_AUTO_PLAY"', () => {
                const browserCacheInstance = (BrowserCache as jest.Mock).mock.results[0].value;
                const browserCacheSetSpy = browserCacheInstance.set;

                const initialValue = store.get('media-auto-play');

                handler({ type: 'TOGGLE_AUTO_PLAY' });

                expect(onToggleAutoPlay).toHaveBeenCalledWith();
                expect(onToggleAutoPlay).toHaveBeenCalledTimes(1);

                expect(store.get('media-auto-play')).toBe(!initialValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('media-auto-play', !initialValue);

                browserCacheSetSpy.mockRestore();
            });

            test('Action type: "ADD_NOTIFICATION"', () => {
                const notificationMsg1 = 'NOTIFICATION_MSG_1';
                const notificationMsg2 = 'NOTIFICATION_MSG_2';
                const invalidNotification = 44;

                // Add notification
                handler({ type: 'ADD_NOTIFICATION', notification: notificationMsg1 });
                expect(onAddNotification).toHaveBeenCalledWith();
                expect(onAddNotification).toHaveBeenCalledTimes(1);
                expect(store.get('notifications-size')).toBe(1);

                const currentNotifications = store.get('notifications');
                expect(currentNotifications.length).toBe(1);
                expect(typeof currentNotifications[0][0]).toBe('string');
                expect(currentNotifications[0][1]).toBe(notificationMsg1);

                expect(store.get('notifications-size')).toBe(0);
                expect(store.get('notifications')).toStrictEqual([]);

                // Add another notification
                handler({ type: 'ADD_NOTIFICATION', notification: notificationMsg2 });

                expect(onAddNotification).toHaveBeenCalledWith();
                expect(onAddNotification).toHaveBeenCalledTimes(2);

                expect(store.get('notifications-size')).toBe(1);
                expect(store.get('notifications')[0][1]).toBe(notificationMsg2);

                expect(store.get('notifications-size')).toBe(0);
                expect(store.get('notifications')).toStrictEqual([]);

                // Add invalid notification
                handler({ type: 'ADD_NOTIFICATION', notification: invalidNotification });
                expect(onAddNotification).toHaveBeenCalledWith();
                expect(onAddNotification).toHaveBeenCalledTimes(3);

                expect(store.get('notifications-size')).toBe(0);
                expect(store.get('notifications')).toStrictEqual([]);
            });
        });
    });
});
