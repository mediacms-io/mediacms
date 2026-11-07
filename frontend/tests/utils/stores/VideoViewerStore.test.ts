import '../../_support/setupMediaCMS';
import { BrowserCache } from '../../../src/static/js/utils/classes/BrowserCache';

function loadStore() {
    let store: any;
    let actions: any;
    jest.isolateModules(() => {
        store = require('../../../src/static/js/utils/stores/VideoViewerStore').default;
        actions = require('../../../src/static/js/utils/actions/VideoViewerActions');
    });
    return { store, actions };
}

describe('utils/stores', () => {
    describe('VideoViewerStore', () => {
        beforeEach(() => {
            localStorage.clear();
        });

        test('Uses defaults when nothing is cached', () => {
            const { store } = loadStore();
            expect(store.get('in-theater-mode')).toBe(false);
            expect(store.get('player-volume')).toBe(1);
            expect(store.get('player-sound-muted')).toBe(false);
            expect(store.get('video-quality')).toBe('Auto');
            expect(store.get('video-playback-speed')).toBe(false);
            expect(store.get('video-data')).toBeUndefined();
            expect(store.get('unknown')).toBeNull();
        });

        test('Restores cached preferences and clamps volume', () => {
            const cache = BrowserCache('mediacms-test', 60) as any;
            cache.set('in-theater-mode', true);
            cache.set('player-volume', 3);
            cache.set('player-sound-muted', true);
            cache.set('video-quality', 720);
            cache.set('video-playback-speed', 1.25);

            const { store } = loadStore();

            expect(store.get('in-theater-mode')).toBe(true);
            expect(store.get('player-volume')).toBe(1);
            expect(store.get('player-sound-muted')).toBe(true);
            expect(store.get('video-quality')).toBe(720);
            expect(store.get('video-playback-speed')).toBe(1.25);
        });

        test('Clamps negative cached volume to zero', () => {
            (BrowserCache('mediacms-test', 60) as any).set('player-volume', -2);
            const { store } = loadStore();
            expect(store.get('player-volume')).toBe(0);
        });

        test.each([
            ['set_viewer_mode', true, 'in-theater-mode', 'in-theater-mode', 'changed_viewer_mode'],
            ['set_player_volume', 0.3, 'player-volume', 'player-volume', 'changed_player_volume'],
            ['set_player_sound_muted', true, 'player-sound-muted', 'player-sound-muted', 'changed_player_sound_muted'],
            ['set_video_quality', 480, 'video-quality', 'video-quality', 'changed_video_quality'],
            ['set_video_playback_speed', 2, 'video-playback-speed', 'video-playback-speed', 'changed_video_playback_speed'],
        ])('%s updates state, cache and emits', (actionName, value, getKey, cacheKey, eventName) => {
            const { store, actions } = loadStore();
            const listener = jest.fn();
            store.on(eventName, listener);

            actions[actionName](value);

            expect(store.get(getKey)).toBe(value);
            expect((BrowserCache('mediacms-test', 60) as any).get(cacheKey)).toBe(value);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('TOGGLE_VIEWER_MODE flips theater mode without caching', () => {
            let store: any;
            let Dispatcher: any;
            jest.isolateModules(() => {
                store = require('../../../src/static/js/utils/stores/VideoViewerStore').default;
                Dispatcher = require('../../../src/static/js/utils/dispatcher');
            });
            const listener = jest.fn();
            store.on('changed_viewer_mode', listener);

            Dispatcher.dispatch({ type: 'TOGGLE_VIEWER_MODE' });

            expect(store.get('in-theater-mode')).toBe(true);
            expect((BrowserCache('mediacms-test', 60) as any).get('in-theater-mode')).toBeNull();
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
