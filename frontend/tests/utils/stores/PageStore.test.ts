import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

installMediaCMSGlobal({ notifications: ['Welcome', 42, 'Second'] });

const PageStore = require('../../../src/static/js/utils/stores/PageStore').default;
const PageActions = require('../../../src/static/js/utils/actions/PageActions');

describe('utils/stores', () => {
    describe('PageStore', () => {
        afterAll(() => {
            localStorage.clear();
        });

        test('INIT_PAGE stores current page and emits page_init', () => {
            const listener = jest.fn();
            PageStore.on('page_init', listener);
            PageActions.initPage('home');
            expect(PageStore.get('current-page')).toBe('home');
            expect(listener).toHaveBeenCalledTimes(1);
            PageStore.removeListener('page_init', listener);
        });

        test('Loads only string notifications from the page config and clears them once read', () => {
            expect(PageStore.get('notifications-size')).toBe(2);
            const messages = PageStore.get('notifications');
            expect(messages.map((m: [string, string]) => m[1])).toStrictEqual(['Welcome', 'Second']);
            messages.forEach((m: [string, string]) => expect(typeof m[0]).toBe('string'));
            expect(PageStore.get('notifications-size')).toBe(0);
            expect(PageStore.get('notifications')).toStrictEqual([]);
        });

        test('ADD_NOTIFICATION pushes string messages and emits added_notification', () => {
            const listener = jest.fn();
            PageStore.on('added_notification', listener);

            PageActions.addNotification('Saved', 'n1');
            PageActions.addNotification({ not: 'a string' }, 'n2');

            expect(listener).toHaveBeenCalledTimes(2);
            expect(PageStore.get('notifications-size')).toBe(1);
            expect(PageStore.get('notifications')[0][1]).toBe('Saved');
            PageStore.removeListener('added_notification', listener);
        });

        test('Media auto play defaults to true and toggles with persistence', () => {
            const listener = jest.fn();
            PageStore.on('switched_media_auto_play', listener);

            expect(PageStore.get('media-auto-play')).toBe(true);
            PageActions.toggleMediaAutoPlay();
            expect(PageStore.get('media-auto-play')).toBe(false);
            expect(PageStore.get('browser-cache').get('media-auto-play')).toBe(false);
            PageActions.toggleMediaAutoPlay();
            expect(PageStore.get('media-auto-play')).toBe(true);
            expect(listener).toHaveBeenCalledTimes(2);
            PageStore.removeListener('switched_media_auto_play', listener);
        });

        test('Exposes config sections', () => {
            const { config } = require('../../../src/static/js/utils/settings/config');
            const cfg = config(window.MediaCMS);
            expect(PageStore.get('config-contents')).toBe(cfg.contents);
            expect(PageStore.get('config-enabled')).toBe(cfg.enabled);
            expect(PageStore.get('config-media-item')).toBe(cfg.media.item);
            expect(PageStore.get('config-options')).toBe(cfg.options);
            expect(PageStore.get('config-site')).toBe(cfg.site);
            expect(PageStore.get('api-playlists')).toBe('https://example.com/api/v1/playlists');
            expect(PageStore.get('browser-cache').prefix).toBe('mediacms-test');
            expect(PageStore.get('unknown')).toBeUndefined();
        });

        test('Re-emits browser events', () => {
            const resize = jest.fn();
            const scroll = jest.fn();
            const visibility = jest.fn();
            PageStore.on('window_resize', resize);
            PageStore.on('window_scroll', scroll);
            PageStore.on('document_visibility_change', visibility);

            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
            document.dispatchEvent(new Event('visibilitychange'));

            expect(resize).toHaveBeenCalledTimes(1);
            expect(scroll).toHaveBeenCalledTimes(1);
            expect(visibility).toHaveBeenCalledTimes(1);
            PageStore.removeAllListeners();
        });

        test('Restores auto play preference from browser cache', () => {
            jest.isolateModules(() => {
                const { BrowserCache } = require('../../../src/static/js/utils/classes/BrowserCache');
                BrowserCache('mediacms-test', 60).set('media-auto-play', false);
                const FreshStore = require('../../../src/static/js/utils/stores/PageStore').default;
                expect(FreshStore.get('media-auto-play')).toBe(false);
            });
        });
    });
});
